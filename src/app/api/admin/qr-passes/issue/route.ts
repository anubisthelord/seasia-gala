import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import QRCode from "qrcode";

import { connectDB } from "@/lib/mongodb";
import { getCurrentAdmin } from "@/lib/auth/session";

import Attendee from "@/models/Attendee";
import PartnerDocument from "@/models/PartnerDocument";
import QRPass from "@/models/QRPass";

import {
  generateQrToken,
  hashQrToken,
  encryptQrToken,
  decryptQrToken,
} from "@/lib/security/qr-token";

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate admin
    const admin = await getCurrentAdmin(request);

    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Unauthorized access." },
        { status: 401 }
      );
    }

    if (
      admin.role !== "SUPER_ADMIN" &&
      admin.role !== "REGISTRATION_ADMIN"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "You do not have permission to issue QR passes.",
        },
        { status: 403 }
      );
    }

    await connectDB();

    // 2. Validate request body safely
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid request body." },
        { status: 400 }
      );
    }

    const attendeeId =
      typeof body === "object" && body !== null && "attendeeId" in body
        ? (body as { attendeeId: unknown }).attendeeId
        : null;

    if (
      typeof attendeeId !== "string" ||
      !Types.ObjectId.isValid(attendeeId)
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid attendee ID." },
        { status: 400 }
      );
    }

    // 3. Fetch attendee and registration
    const attendee = await Attendee.findById(attendeeId).populate({
      path: "registration",
      select: "status",
    });

    if (!attendee) {
      return NextResponse.json(
        { success: false, message: "Attendee not found." },
        { status: 404 }
      );
    }

    const registration = attendee.registration as any;

    // 4. Verify registration approval
    if (registration?.status !== "APPROVED") {
      return NextResponse.json(
        { success: false, message: "Registration is not approved." },
        { status: 400 }
      );
    }

    // 5. Verify partner document approval
    if (attendee.attendeeType === "PARTNER") {
      const document = await PartnerDocument.findOne({
        attendee: attendee._id,
      });

      if (!document || document.verificationStatus !== "APPROVED") {
        return NextResponse.json(
          {
            success: false,
            message: "Partner document is not approved.",
          },
          { status: 400 }
        );
      }
    }

    // 6. Check whether a QR pass already exists
    const existingPass = await QRPass.findOne({
      attendee: attendee._id,
    }).select("+tokenHash +encryptedToken");

    // If an active pass exists, reuse its token
    if (existingPass?.status === "ACTIVE") {
      let existingToken: string | null = null;

      try {
        existingToken = decryptQrToken(existingPass.encryptedToken);
      } catch {
        // Support migration from the previous implementation,
        // which stored the raw token in encryptedToken.
        const legacyToken = existingPass.encryptedToken;

        if (
          legacyToken &&
          hashQrToken(legacyToken) === existingPass.tokenHash
        ) {
          const migrationResult = await QRPass.updateOne(
            {
              _id: existingPass._id,
              tokenHash: existingPass.tokenHash,
              status: "ACTIVE",
            },
            {
              $set: {
                encryptedToken: encryptQrToken(legacyToken),
              },
            }
          );

          if (migrationResult.modifiedCount !== 1) {
            return NextResponse.json(
              {
                success: false,
                message: "The QR pass was changed by another request. Please refresh and try again.",
              },
              { status: 409 }
            );
          }

          existingToken = legacyToken;
        }
      }

      if (existingToken) {
        const qrImage = await QRCode.toDataURL(existingToken, {
          width: 420,
          margin: 2,
          errorCorrectionLevel: "H",
        });

        return NextResponse.json({
          success: true,
          data: {
            attendeeName: attendee.fullName,
            attendeeType: attendee.attendeeType,
            qrImage,
            issuedAt: existingPass.issuedAt.toISOString(),
          },
        });
      }
    }

    // 7. Generate a new secure token
    const rawToken = generateQrToken();
    const tokenHash = hashQrToken(rawToken);
    const encryptedToken = encryptQrToken(rawToken);

    const passData = {
      registration: registration._id,
      tokenHash,
      encryptedToken,
      status: "ACTIVE" as const,
      issuedAt: new Date(),
      issuedBy: admin._id,
      revokedAt: null,
      revokedBy: null,
      revocationReason: null,
    };

    let qrPass;

    if (existingPass) {
      // Reissue a revoked pass or replace an unreadable active pass.
      // The old token hash must still match to prevent overwriting
      // a pass that another request has just updated.
      qrPass = await QRPass.findOneAndUpdate(
        {
          _id: existingPass._id,
          tokenHash: existingPass.tokenHash,
          status: existingPass.status,
        },
        { $set: passData },
        { new: true }
      );

      if (!qrPass) {
        return NextResponse.json(
          {
            success: false,
            message: "The QR pass was updated by another request. Please try again.",
          },
          { status: 409 }
        );
      }
    } else {
      // Create a new pass
      try {
        qrPass = await QRPass.create({
          attendee: attendee._id,
          ...passData,
        });
      } catch (error: any) {
        // Handle simultaneous issuance requests
        if (error.code === 11000) {
          return NextResponse.json(
            {
              success: false,
              message: "A QR pass was created simultaneously. Please refresh and try again.",
            },
            { status: 409 }
          );
        }

        throw error;
      }
    }

    const qrImage = await QRCode.toDataURL(rawToken, {
      width: 420,
      margin: 2,
      errorCorrectionLevel: "H",
    });

    // Return the rendered pass image for immediate display in the admin modal.
    return NextResponse.json({
      success: true,
      data: {
        attendeeName: attendee.fullName,
        attendeeType: attendee.attendeeType,
        qrImage,
        issuedAt: qrPass.issuedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("QR generation error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to generate QR pass. Please try again.",
      },
      { status: 500 }
    );
  }
}
