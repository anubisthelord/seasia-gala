
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getCurrentAdmin } from "@/lib/auth/session";

import Registration from "@/models/Registration";
import Attendee from "@/models/Attendee";
import PartnerDocument from "@/models/PartnerDocument";
import RegistrationAudit from "@/models/RegistrationAudit";
import { sendEmail } from "@/lib/email";
import QRCode from "qrcode";
import sharp from "sharp";
import QRPass from "@/models/QRPass";
import Employee from "@/models/Employee";
import { generateQrToken, hashQrToken, encryptQrToken, decryptQrToken } from "@/lib/security/qr-token";
import { buildQrTicketSvg, buildSharedCoupleQrTicketSvg } from "@/lib/qr-ticket";
import { withBasePath } from "@/config/base-path";

interface RouteContext {
  params: Promise<{ id: string }>;
}

type ReviewAction =
  | "APPROVE_REGISTRATION"
  | "REJECT_REGISTRATION"
  | "REQUEST_CORRECTION"
  | "APPROVE_PARTNER_DOCUMENT"
  | "REJECT_PARTNER_DOCUMENT";

const VALID_ACTIONS: ReviewAction[] = [
  "APPROVE_REGISTRATION",
  "REJECT_REGISTRATION",
  "REQUEST_CORRECTION",
  "APPROVE_PARTNER_DOCUMENT",
  "REJECT_PARTNER_DOCUMENT",
];

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
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
          message: "You do not have permission to perform this review action.",
        },
        { status: 403 }
      );
    }

    // 2. Validate registration ID
    const { id } = await params;

    if (!/^[a-fA-F0-9]{24}$/.test(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid registration ID." },
        { status: 400 }
      );
    }

    // 3. Validate request body
    const body = await request.json();

    const action = body.action as ReviewAction;
    const reason =
      typeof body.reason === "string" ? body.reason.trim() : "";

    if (!VALID_ACTIONS.includes(action)) {
      return NextResponse.json(
        { success: false, message: "Invalid review action." },
        { status: 400 }
      );
    }

    if (reason.length > 1000) {
      return NextResponse.json(
        { success: false, message: "Reason cannot exceed 1000 characters." },
        { status: 400 }
      );
    }

    const requiresReason = [
      "REJECT_REGISTRATION",
      "REQUEST_CORRECTION",
      "REJECT_PARTNER_DOCUMENT",
    ].includes(action);

    if (requiresReason && !reason) {
      return NextResponse.json(
        {
          success: false,
          message: "A reason is required for this action.",
        },
        { status: 400 }
      );
    }

    await connectDB();

    const adminId = admin._id;

    // 4. Find registration
    const registration = await Registration.findById(id);

    if (!registration) {
      return NextResponse.json(
        { success: false, message: "Registration not found." },
        { status: 404 }
      );
    }

    // 5. Handle employee registration decisions
    const isRegistrationAction = ["APPROVE_REGISTRATION", "REJECT_REGISTRATION", "REQUEST_CORRECTION"].includes(action);
    if (isRegistrationAction) {
      const registrationAction = action as Exclude<ReviewAction, "APPROVE_PARTNER_DOCUMENT" | "REJECT_PARTNER_DOCUMENT">;
      if (registration.status !== "PENDING_ADMIN_APPROVAL") {
        return NextResponse.json(
          {
            success: false,
            message: `This registration cannot be reviewed because its current status is ${registration.status}.`,
          },
          { status: 409 }
        );
      }

      const previousStatus = registration.status;

      const newStatus =
        registrationAction === "APPROVE_REGISTRATION"
          ? "APPROVED"
          : registrationAction === "REJECT_REGISTRATION"
            ? "REJECTED"
            : "CORRECTION_REQUESTED";

      const reviewedAt = new Date();

      const updatedRegistration =
        await Registration.findOneAndUpdate(
          {
            _id: id,
            status: "PENDING_ADMIN_APPROVAL",
          },
          {
            $set: {
              status: newStatus,
              reviewedBy: adminId,
              reviewedAt,
              rejectionReason:
                registrationAction === "REJECT_REGISTRATION" ? reason : null,
              correctionReason:
                registrationAction === "REQUEST_CORRECTION" ? reason : null,
            },
          },
          { new: true }
        );

      if (!updatedRegistration) {
        return NextResponse.json(
          {
            success: false,
            message: "Registration was already reviewed. Refresh and try again.",
          },
          { status: 409 }
        );
      }

      // 6. Save audit record
      try {
        await RegistrationAudit.create({
          registration: registration._id,
          admin: adminId,
          action: registrationAction,
          previousStatus,
          newStatus,
          attendee: null,
          reason: reason || null,
        });
      } catch (auditError) {
        // Compensate if the audit record could not be saved.
        await Registration.findOneAndUpdate(
          {
            _id: id,
            status: newStatus,
            reviewedBy: adminId,
            reviewedAt,
          },
          {
            $set: {
              status: previousStatus,
              reviewedBy: null,
              reviewedAt: null,
              rejectionReason: null,
              correctionReason: null,
            },
          }
        );

        throw auditError;
      }

      let qrEmailMessage: string | null = null;
      let qrEmailSent: boolean | null = null;
      if (registrationAction === "APPROVE_REGISTRATION") {
        const [currentRegistration, employee, attendees, partner] = await Promise.all([
          Registration.findById(id),
          Employee.findById(registration.employee).select("fullName officialEmail employeeId"),
          Attendee.find({ registration: registration._id }).sort({ attendeeType: 1 }),
          Attendee.findOne({ registration: registration._id, attendeeType: "PARTNER" }),
        ]);
        const partnerDoc = partner ? await PartnerDocument.findOne({ attendee: partner._id }) : null;
        const allApproved = currentRegistration?.status === "APPROVED" &&
          (currentRegistration.attendanceType === "SINGLE" || partnerDoc?.verificationStatus === "APPROVED");

        if (allApproved && employee) {
          try {
            if (attendees.length !== (currentRegistration.attendanceType === "COUPLE" ? 2 : 1)) {
              throw new Error("Required attendee records are missing.");
            }
            const employeeAttendee = attendees.find((item) => item.attendeeType === "EMPLOYEE");
            const partnerAttendee = attendees.find((item) => item.attendeeType === "PARTNER");
            if (!employeeAttendee) throw new Error("Employee attendee record is missing.");
            const passAttendees = currentRegistration.attendanceType === "COUPLE" ? [employeeAttendee] : [employeeAttendee];
            if (currentRegistration.attendanceType === "COUPLE" && partnerAttendee) {
              await QRPass.updateMany(
                { attendee: partnerAttendee._id, registration: registration._id, status: "ACTIVE" },
                { $set: { status: "REVOKED", revokedAt: new Date(), revokedBy: adminId, revocationReason: "Replaced by shared couple pass." } }
              );
            }
            const issued: Array<{ attendee: (typeof attendees)[number]; token: string }> = [];
            for (const attendee of passAttendees) {
              const previousPass = await QRPass.findOne({ attendee: attendee._id }).select("+tokenHash +encryptedToken status emailStatus");
              if (previousPass?.status === "ACTIVE" && previousPass.emailStatus === "SENT") continue;
              if (previousPass?.status === "ACTIVE") {
                const token = decryptQrToken(previousPass.encryptedToken);
                issued.push({ attendee, token });
                continue;
              }
              const token = generateQrToken();
              const passData = {
                registration: registration._id,
                tokenHash: hashQrToken(token),
                encryptedToken: encryptQrToken(token),
                status: "ACTIVE" as const,
                issuedAt: new Date(),
                issuedBy: adminId,
                revokedAt: null,
                revokedBy: null,
                revocationReason: null,
                emailStatus: "PENDING" as const,
                emailAttempts: 0,
                emailLastAttemptAt: null,
                emailSentAt: null,
                emailProviderMessageId: null,
                emailLastError: null,
              };
              if (previousPass) {
                const updated = await QRPass.findOneAndUpdate({ _id: previousPass._id, status: previousPass.status, tokenHash: previousPass.tokenHash }, { $set: passData }, { new: true });
                if (!updated) throw new Error("Pass was changed concurrently; retry from QR Passes.");
              } else {
                await QRPass.create({ attendee: attendee._id, ...passData });
              }
              issued.push({ attendee, token });
            }

            const ticketImages = await Promise.all(issued.map(async ({ attendee, token }) => {
              const qr = await QRCode.toDataURL(token, { width: 420, margin: 2, errorCorrectionLevel: "H" });
              const ticket = currentRegistration.attendanceType === "COUPLE" && partnerAttendee
                ? buildSharedCoupleQrTicketSvg(employee.fullName, partnerAttendee.fullName, employee.employeeId, qr)
                : buildQrTicketSvg(employee.fullName, employee.employeeId, qr);
              return sharp(Buffer.from(ticket)).png().toBuffer();
            }));
            if (issued.length === 0) {
              qrEmailMessage = `QR passes were already sent to ${employee.officialEmail}.`;
              qrEmailSent = true;
            } else {
            const combined = ticketImages[0];
            const employeePass = issued[0];
            const coupleDownloadUrl = new URL(withBasePath(`/api/employee/couple-qr-download?token=${encodeURIComponent(employeePass.token)}`), request.nextUrl.origin);
            const emailResult = await sendEmail({
              to: employee.officialEmail,
              subject: "Your Seasia Gala Event Pass",
              html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#222"><h2>Your Seasia Gala event pass is ready</h2><p>Hello ${employee.fullName.replace(/[&<>"']/g, "")},</p><p>This single QR pass is valid for both attendees:</p><p><strong>Employee:</strong> ${employee.fullName.replace(/[&<>"']/g, "")}<br/><strong>Partner:</strong> ${partnerAttendee?.fullName.replace(/[&<>"']/g, "") || "—"}</p><img src="cid:couple-passes" alt="Shared event pass" style="display:block;width:100%;max-width:460px;height:auto;margin:20px auto"/><p>Show the same QR at entry and food collection.</p><div style="text-align:center;margin:28px 0;">
  <a href="${coupleDownloadUrl}"
     style="display:inline-block;
            background-color:#7C3AED;
            color:#FFFFFF;
            text-decoration:none;
            font-family:Arial,sans-serif;
            font-size:15px;
            font-weight:700;
            padding:14px 28px;
            border-radius:8px;
            border:1px solid #7C3AED;">
    Download Event Pass
  </a>
</div></div>`,
              text: `Your Seasia Gala shared pass is ready for ${employee.fullName}${partnerAttendee ? ` and ${partnerAttendee.fullName}` : ""}. This one QR is valid for entry and food collection. Download: ${coupleDownloadUrl.toString()}`,
              attachments: [{ content: combined.toString("base64"), filename: `Seasia-Gala-${employee.employeeId}-QR-Passes.png`, type: "image/png", disposition: "inline", content_id: "couple-passes" }],
            });
            await QRPass.updateMany({ attendee: employeeAttendee._id, status: "ACTIVE" }, { $set: { emailStatus: "SENT", emailSentAt: new Date(), emailProviderMessageId: emailResult.messageId || null, emailLastError: null, emailLastAttemptAt: new Date() }, $inc: { emailAttempts: 1 } });
            qrEmailMessage = `QR passes generated and emailed to ${employee.officialEmail}.`;
            qrEmailSent = true;
            }
          } catch (issueError) {
            console.error("Automatic QR pass issuance failed:", issueError);
            await QRPass.updateMany({ registration: registration._id, status: "ACTIVE" }, { $set: { emailStatus: "FAILED", emailLastError: issueError instanceof Error ? issueError.message.slice(0, 1000) : "Pass generation or email failed.", emailLastAttemptAt: new Date() }, $inc: { emailAttempts: 1 } }).catch((trackingError) => console.error("Unable to track automatic QR email failure:", trackingError));
            qrEmailMessage = "Approval saved, but QR pass generation or email failed. Please retry from QR Passes.";
            qrEmailSent = false;
          }
        } else if (currentRegistration?.attendanceType === "COUPLE") {
          qrEmailMessage = "Registration approved. QR passes will be generated and emailed after the partner document is approved.";
        }
      }

      return NextResponse.json({
        success: true,
        message: qrEmailMessage || `Registration ${newStatus.toLowerCase().replaceAll("_", " ")} successfully.`,
        data: {
          registrationId: updatedRegistration._id,
          status: updatedRegistration.status,
          reviewedAt: updatedRegistration.reviewedAt,
          qrEmailSent,
        },
      });
    }

    // 7. Handle partner document decisions
    if (registration.attendanceType !== "COUPLE") {
      return NextResponse.json(
        {
          success: false,
          message: "Partner document review is only available for Couple registrations.",
        },
        { status: 400 }
      );
    }

    const partnerAttendee = await Attendee.findOne({
      registration: registration._id,
      attendeeType: "PARTNER",
    });

    if (!partnerAttendee) {
      return NextResponse.json(
        { success: false, message: "Partner attendee not found." },
        { status: 404 }
      );
    }

    const partnerDocument = await PartnerDocument.findOne({
      attendee: partnerAttendee._id,
    });

    if (!partnerDocument) {
      return NextResponse.json(
        { success: false, message: "Partner document not found." },
        { status: 404 }
      );
    }

    if (partnerDocument.verificationStatus !== "PENDING") {
      return NextResponse.json(
        {
          success: false,
          message: `This document has already been reviewed. Current status: ${partnerDocument.verificationStatus}.`,
        },
        { status: 409 }
      );
    }

    const previousStatus = partnerDocument.verificationStatus;

    const newStatus =
      action === "APPROVE_PARTNER_DOCUMENT"
        ? "APPROVED"
        : "REJECTED";

    const reviewedAt = new Date();

    const updatedDocument =
      await PartnerDocument.findOneAndUpdate(
        {
          _id: partnerDocument._id,
          verificationStatus: "PENDING",
        },
        {
          $set: {
            verificationStatus: newStatus,
            reviewedBy: adminId,
            reviewedAt,
            rejectionReason:
              action === "REJECT_PARTNER_DOCUMENT" ? reason : null,
          },
        },
        { new: true }
      );

    if (!updatedDocument) {
      return NextResponse.json(
        {
          success: false,
          message: "Partner document was already reviewed. Refresh and try again.",
        },
        { status: 409 }
      );
    }

    // 8. Save partner document audit record
    try {
      await RegistrationAudit.create({
        registration: registration._id,
        admin: adminId,
        action,
        previousStatus,
        newStatus,
        attendee: partnerAttendee._id,
        reason: reason || null,
      });
    } catch (auditError) {
      // Compensate if the audit record could not be saved.
      await PartnerDocument.findOneAndUpdate(
        {
          _id: partnerDocument._id,
          verificationStatus: newStatus,
          reviewedBy: adminId,
          reviewedAt,
        },
        {
          $set: {
            verificationStatus: previousStatus,
            reviewedBy: null,
            reviewedAt: null,
            rejectionReason: null,
          },
        }
      );

      throw auditError;
    }

    return NextResponse.json({
      success: true,
      message: `Partner document ${newStatus.toLowerCase()} successfully.`,
      data: {
        registrationId: registration._id,
        attendeeId: partnerAttendee._id,
        verificationStatus: updatedDocument.verificationStatus,
        reviewedAt: updatedDocument.reviewedAt,
      },
    });
  } catch (error) {
    console.error("Admin registration review error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to process the review action.",
      },
      { status: 500 }
    );
  }
}
