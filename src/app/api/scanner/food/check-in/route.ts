import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";

import { connectDB } from "@/lib/mongodb";
import { getCurrentAdmin } from "@/lib/auth/session";
import { hashQrToken } from "@/lib/security/qr-token";
import { recordScannerScan } from "@/lib/scanner/record-scan";

import QRPass from "@/models/QRPass";
import Attendee from "@/models/Attendee";
import Registration from "@/models/Registration";
import PartnerDocument from "@/models/PartnerDocument";
import Employee from "@/models/Employee";

type FoodScanResult =
  | "COLLECTED"
  | "ALREADY_COLLECTED"
  | "ENTRY_REQUIRED"
  | "INVALID_QR"
  | "REVOKED"
  | "NOT_APPROVED"
  | "PARTNER_NOT_APPROVED"
  | "SCAN_CONFLICT"
  | "ATTENDEE_NOT_FOUND";

interface ScanDetails {
  qrPass?: {
    _id: Types.ObjectId;
    registration: Types.ObjectId;
  } | null;
  registration?: {
    _id: Types.ObjectId;
  } | null;
  attendee?: {
    _id: Types.ObjectId;
    fullName: string;
    attendeeType: "EMPLOYEE" | "PARTNER";
  } | null;
  attendees?: Array<{ _id: Types.ObjectId; fullName: string; attendeeType: "EMPLOYEE" | "PARTNER" }>;
  employeeId?: string | null;
}

// FIX 2: Shared helper for consistent no-cache JSON responses
function jsonResponse(
  body: Record<string, unknown>,
  status: number
): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication and role authorization
    const admin = await getCurrentAdmin(request);

    if (!admin) {
      return jsonResponse(
        {
          success: false,
          status: "UNAUTHORIZED",
          message: "Please log in.",
        },
        401
      );
    }

    if (admin.role !== "FOOD_SCANNER") {
      return jsonResponse(
        {
          success: false,
          status: "FORBIDDEN",
          message: "You are not authorized to use the Food Scanner.",
        },
        403
      );
    }

    await connectDB();

    // 2. Shared response and scan-history helper
    const finish = async (
      status: FoodScanResult,
      message: string,
      httpStatus = 400,
      details: ScanDetails = {}
    ) => {
      const scanAttendees = details.attendees ?? (details.attendee ? [details.attendee] : []);
      if (scanAttendees.length) await Promise.all(scanAttendees.map((attendee) => recordScannerScan({
        scannerType: "FOOD",
        result: status,
        scannedBy: admin._id,
        qrPass: details.qrPass?._id ?? null,
        registration:
          details.registration?._id ??
          details.qrPass?.registration ??
          null,
        attendee: attendee._id,
        attendeeName: attendee.fullName,
        employeeId: details.employeeId ?? null,
        attendeeType: attendee.attendeeType,
        message,
      })));

      return jsonResponse(
        {
          success: status === "COLLECTED",
          status,
          message,
          ...(details.attendee
            ? {
                attendee: {
                  fullName: details.attendee.fullName,
                  attendeeType: details.attendee.attendeeType,
                },
              }
            : {}),
          ...(details.attendees ? { attendees: details.attendees.map(({ fullName, attendeeType }) => ({ fullName, attendeeType })) } : {}),
        },
        httpStatus
      );
    };

    // 3. Safely parse request (handles null, arrays, primitives)
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return finish("INVALID_QR", "Invalid request body.", 400);
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return finish("INVALID_QR", "Invalid request body.", 400);
    }

    const token = (body as { token?: unknown }).token;

    if (
      typeof token !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(token)
    ) {
      return finish("INVALID_QR", "Invalid QR code.", 400);
    }

    // 4. Find QR pass using its token hash
    // FIX 1: If the document is found, the hash matches — no need for timingSafeEqual
    const tokenHash = hashQrToken(token);

    const qrPass = await QRPass.findOne({ tokenHash });

    if (!qrPass) {
      return finish("INVALID_QR", "QR code not recognized.", 404);
    }

    // 5. Check pass status
    if (qrPass.status !== "ACTIVE") {
      return finish(
        "REVOKED",
        "This QR pass has been revoked.",
        403,
        { qrPass }
      );
    }

    // 6. Check registration approval
    const registration = await Registration.findById(
      qrPass.registration
    ).select("status employee");

    if (!registration || registration.status !== "APPROVED") {
      return finish(
        "NOT_APPROVED",
        "This registration has not been approved.",
        403,
        { qrPass, registration }
      );
    }

    // 7. Get attendee details
    const attendees = await Attendee.find({ registration: qrPass.registration }).select("fullName attendeeType");
    const attendee = attendees.find((item) => item._id.toString() === qrPass.attendee.toString()) ?? attendees[0];

    if (!attendee) {
      return finish(
        "ATTENDEE_NOT_FOUND",
        "Attendee record not found.",
        404,
        { qrPass, registration }
      );
    }

    const employee = await Employee.findById(
      registration.employee
    ).select("employeeId");

    const details: ScanDetails = {
      qrPass,
      registration,
      attendee,
      attendees,
      employeeId: employee?.employeeId ?? null,
    };

    if (!qrPass.entryCheckedInAt) {
      return finish(
        "ENTRY_REQUIRED",
        "Entry check-in is required before food can be collected.",
        403,
        details
      );
    }

    // 8. Partner document approval
    for (const groupAttendee of attendees.filter((item) => item.attendeeType === "PARTNER")) {
      const partnerDocument = await PartnerDocument.findOne({
        attendee: groupAttendee._id,
      }).select("verificationStatus");

      if (
        !partnerDocument ||
        partnerDocument.verificationStatus !== "APPROVED"
      ) {
        return finish(
          "PARTNER_NOT_APPROVED",
          "Partner document has not been approved.",
          403,
          details
        );
      }
    }

    // 9. Atomic first-time food collection
    const groupPasses = await QRPass.find({ registration: qrPass.registration, status: "ACTIVE", entryCheckedInAt: { $ne: null }, attendee: { $in: attendees.map((item) => item._id) } });
    const collected = await Promise.all(groupPasses.map((pass) => QRPass.findOneAndUpdate(
      { _id: pass._id, status: "ACTIVE", entryCheckedInAt: { $ne: null }, foodCollectedAt: null },
      { $set: { foodCollectedAt: new Date(), foodCollectedBy: admin._id } },
      { new: true }
    )));
    if (collected.some(Boolean)) {
      return finish(
        "COLLECTED",
        "Food collection recorded successfully.",
        200,
        details
      );
    }

    // 10. Determine why the atomic update did not succeed
    const latestPass = await QRPass.findById(qrPass._id).select(
      "status entryCheckedInAt foodCollectedAt"
    );

    if (!latestPass || latestPass.status !== "ACTIVE") {
      return finish(
        "REVOKED",
        "This QR pass has been revoked.",
        403,
        details
      );
    }

    if (!latestPass.entryCheckedInAt) {
      return finish(
        "ENTRY_REQUIRED",
        "Entry check-in is required before food can be collected.",
        403,
        details
      );
    }

    if (latestPass.foodCollectedAt) {
      return finish(
        "ALREADY_COLLECTED",
        "Food has already been collected for this attendee.",
        409,
        details
      );
    }

    return finish(
      "SCAN_CONFLICT",
      "Unable to process this scan. Please try again.",
      409,
      details
    );
  } catch (error) {
    console.error("Food check-in API error:", error);

    return jsonResponse(
      {
        success: false,
        status: "SERVER_ERROR",
        message: "Something went wrong. Please try again.",
      },
      500
    );
  }
}
