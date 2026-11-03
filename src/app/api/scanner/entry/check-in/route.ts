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

type EntryScanResult =
  | "CHECKED_IN"
  | "ALREADY_CHECKED_IN"
  | "INVALID_QR"
  | "REVOKED"
  | "NOT_APPROVED"
  | "PARTNER_NOT_APPROVED"
  | "SCAN_CONFLICT"
  | "ATTENDEE_NOT_FOUND";

interface EntryScanDetails {
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
  employeeId?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin(request);

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          status: "UNAUTHORIZED",
          message: "Please log in.",
        },
        { status: 401 }
      );
    }

    if (admin.role !== "ENTRY_SCANNER") {
      return NextResponse.json(
        {
          success: false,
          status: "FORBIDDEN",
          message: "Entry Scanner access is required.",
        },
        { status: 403 }
      );
    }

    await connectDB();

    const finish = async (
      status: EntryScanResult,
      message: string,
      httpStatus = 400,
      details: EntryScanDetails = {}
    ) => {
      await recordScannerScan({
        scannerType: "ENTRY",
        result: status,
        scannedBy: admin._id,
        qrPass: details.qrPass?._id ?? null,
        registration: details.registration?._id ?? null,
        attendee: details.attendee?._id ?? null,
        attendeeName: details.attendee?.fullName ?? null,
        employeeId: details.employeeId ?? null,
        attendeeType: details.attendee?.attendeeType ?? null,
        message,
      });

      // FIX 3: Add explicit no-cache headers to every scanner response
      const response = NextResponse.json(
        {
          success: status === "CHECKED_IN",
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
        },
        { status: httpStatus }
      );

      response.headers.set("Cache-Control", "no-store");

      return response;
    };

    // Safely validate the request body
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return finish("INVALID_QR", "Invalid request body.");
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return finish("INVALID_QR", "Invalid request body.");
    }

    const token = (body as { token?: unknown }).token;

    if (
      typeof token !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(token)
    ) {
      return finish("INVALID_QR", "Invalid QR code.");
    }

    // Find the pass using its token hash.
    // FIX 1: The MongoDB lookup IS the comparison — no need for timingSafeEqual.
    const tokenHash = hashQrToken(token);

    const qrPass = await QRPass.findOne({ tokenHash });

    if (!qrPass) {
      return finish("INVALID_QR", "QR code not recognized.", 404);
    }

    // Load attendee and registration details for validation and reporting.
    const [attendee, registration] = await Promise.all([
      Attendee.findById(qrPass.attendee).select("fullName attendeeType"),
      Registration.findById(qrPass.registration).select("status employee"),
    ]);

    if (!attendee) {
      return finish("ATTENDEE_NOT_FOUND", "Attendee record not found.", 404, {
        qrPass,
        registration,
      });
    }

    const employee = registration
      ? await Employee.findById(registration.employee).select("employeeId")
      : null;

    const details: EntryScanDetails = {
      qrPass,
      registration,
      attendee,
      employeeId: employee?.employeeId ?? null,
    };

    if (qrPass.status !== "ACTIVE") {
      return finish("REVOKED", "This QR pass has been revoked.", 403, details);
    }

    if (!registration || registration.status !== "APPROVED") {
      return finish(
        "NOT_APPROVED",
        "This registration has not been approved.",
        403,
        details
      );
    }

    if (attendee.attendeeType === "PARTNER") {
      const partnerDocument = await PartnerDocument.findOne({
        attendee: attendee._id,
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

    // Atomically allow only the first entry check-in.
    const updatedPass = await QRPass.findOneAndUpdate(
      {
        _id: qrPass._id,
        tokenHash,
        status: "ACTIVE",
        entryCheckedInAt: null,
      },
      {
        $set: {
          entryCheckedInAt: new Date(),
          entryCheckedInBy: admin._id,
        },
      },
      { new: true }
    );

    if (updatedPass) {
      return finish(
        "CHECKED_IN",
        "Entry check-in successful.",
        200,
        details
      );
    }

    // Determine why the atomic update did not succeed.
    const latestPass = await QRPass.findById(qrPass._id).select(
      "status entryCheckedInAt"
    );

    if (!latestPass || latestPass.status !== "ACTIVE") {
      return finish(
        "REVOKED",
        "This QR pass has been revoked.",
        403,
        details
      );
    }

    if (latestPass.entryCheckedInAt) {
      return finish(
        "ALREADY_CHECKED_IN",
        "This attendee has already checked in.",
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
    console.error("Entry check-in API error:", error);

    const response = NextResponse.json(
      {
        success: false,
        status: "SERVER_ERROR",
        message: "Something went wrong. Please try again.",
      },
      { status: 500 }
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}