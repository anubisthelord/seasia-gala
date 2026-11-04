import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import QRCode from "qrcode";

import { connectDB } from "@/lib/mongodb";
import { getCurrentAdmin } from "@/lib/auth/session";

import Attendee from "@/models/Attendee";
import PartnerDocument from "@/models/PartnerDocument";
import QRPass from "@/models/QRPass";
import { sendEmail } from "@/lib/email";
import Employee from "@/models/Employee";
import { buildSharedCoupleQrTicketSvg, qrTicketDataUrl } from "@/lib/qr-ticket";

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
    let attendee = await Attendee.findById(attendeeId).populate({
      path: "registration",
      select: "status employee attendanceType",
    });

    if (!attendee) {
      return NextResponse.json(
        { success: false, message: "Attendee not found." },
        { status: 404 }
      );
    }

    const registration = attendee.registration as unknown as { _id: Types.ObjectId; status: string; employee: Types.ObjectId; attendanceType: "SINGLE" | "COUPLE" } | null;

    // 4. Verify registration approval
    if (registration?.status !== "APPROVED") {
      return NextResponse.json(
        { success: false, message: "Registration is not approved." },
        { status: 400 }
      );
    }

    const requestedAttendee = attendee;
    let partnerName: string | null = null;
    if (registration.attendanceType === "COUPLE") {
      const [employeeAttendee, partnerAttendee] = await Promise.all([
        Attendee.findOne({ registration: registration._id, attendeeType: "EMPLOYEE" }),
        Attendee.findOne({ registration: registration._id, attendeeType: "PARTNER" }),
      ]);
      if (!employeeAttendee || !partnerAttendee) return NextResponse.json({ success: false, message: "Both couple attendees are required." }, { status: 409 });
      const partnerDocument = await PartnerDocument.findOne({ attendee: partnerAttendee._id });
      if (partnerDocument?.verificationStatus !== "APPROVED") return NextResponse.json({ success: false, message: "Partner document is not approved." }, { status: 400 });
      attendee = employeeAttendee;
      partnerName = partnerAttendee.fullName;
      await QRPass.updateMany({ attendee: partnerAttendee._id, registration: registration._id, status: "ACTIVE" }, { $set: { status: "REVOKED", revokedAt: new Date(), revokedBy: admin._id, revocationReason: "Replaced by shared couple pass." } });
    }

    // 5. Verify partner document approval
    if (requestedAttendee.attendeeType === "PARTNER") {
      const document = await PartnerDocument.findOne({
        attendee: requestedAttendee._id,
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

    const employee = await Employee.findById(registration.employee).select("fullName officialEmail employeeId");

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
        const ticketImage = partnerName && employee
          ? qrTicketDataUrl(buildSharedCoupleQrTicketSvg(employee.fullName, partnerName, employee.employeeId, qrImage))
          : qrImage;

        return NextResponse.json({
          success: true,
          data: {
            attendeeName: partnerName ? `${attendee.fullName} & ${partnerName}` : attendee.fullName,
            attendeeType: partnerName ? "COUPLE" : attendee.attendeeType,
            qrImage: ticketImage,
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
      } catch (error: unknown) {
        // Handle simultaneous issuance requests
        if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
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

    let emailSent = false;
    let emailMessage = "QR pass generated.";
    if (employee?.officialEmail) {
      const emailAttemptAt = new Date();
      await QRPass.updateOne({ _id: qrPass._id }, { $inc: { emailAttempts: 1 }, $set: { emailLastAttemptAt: emailAttemptAt } });
      try {
        const emailResult = await sendEmail({
          to: employee.officialEmail,
          subject: "Your Seasia Gala Event QR Pass",
          html: `<div style="font-family:Arial,sans-serif"><h2>Your event QR pass is ready</h2><p><strong>Employee:</strong> ${employee.fullName?.replace(/[&<>"']/g, "") || attendee.fullName.replace(/[&<>"']/g, "")}${partnerName ? `<br/><strong>Partner:</strong> ${partnerName.replace(/[&<>"']/g, "")}` : ""}</p><img src="cid:attendee-qr" width="320" height="320" alt="QR pass" /></div>`,
          text: `Your Seasia Gala QR pass is for ${employee.fullName || attendee.fullName}${partnerName ? ` and ${partnerName}` : ""}.`,
          attachments: [{ content: (await QRCode.toBuffer(rawToken, { type: "png", width: 420, margin: 2, errorCorrectionLevel: "H" })).toString("base64"), filename: `Seasia-Gala-${employee.employeeId}-QR.png`, type: "image/png", disposition: "inline", content_id: "attendee-qr" }],
        });
        await QRPass.updateOne({ _id: qrPass._id }, { $set: { emailStatus: "SENT", emailSentAt: new Date(), emailProviderMessageId: emailResult.messageId || null, emailLastError: null } });
        emailSent = true;
        emailMessage = `QR pass generated and emailed to ${employee.officialEmail}.`;
      } catch (emailError) {
        await QRPass.updateOne({ _id: qrPass._id }, { $set: { emailStatus: "FAILED", emailLastError: emailError instanceof Error ? emailError.message.slice(0, 1000) : "Email delivery failed." } });
        emailMessage = `QR pass generated, but email to ${employee.officialEmail} failed.`;
      }
    }

    // Return the rendered pass image for immediate display in the admin modal.
    return NextResponse.json({
      success: true,
      message: emailMessage,
      emailSent,
      data: {
        attendeeName: partnerName ? `${attendee.fullName} & ${partnerName}` : attendee.fullName,
        attendeeType: partnerName ? "COUPLE" : attendee.attendeeType,
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
