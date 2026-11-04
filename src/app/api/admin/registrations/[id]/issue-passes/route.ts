import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import sharp from "sharp";
import { buildQrTicketSvg, buildSharedCoupleQrTicketSvg } from "@/lib/qr-ticket";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { getCurrentAdmin } from "@/lib/auth/session";
import Registration from "@/models/Registration";
import Employee from "@/models/Employee";
import Attendee from "@/models/Attendee";
import PartnerDocument from "@/models/PartnerDocument";
import QRPass from "@/models/QRPass";
import { generateQrToken, hashQrToken, encryptQrToken } from "@/lib/security/qr-token";
import { sendEmail } from "@/lib/email";
import { withBasePath } from "@/config/base-path";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const admin = await getCurrentAdmin(request);
    if (!admin) return NextResponse.json({ success: false, message: "Unauthorized access." }, { status: 401 });
    if (admin.role !== "SUPER_ADMIN" && admin.role !== "REGISTRATION_ADMIN") {
      return NextResponse.json({ success: false, message: "You do not have permission to issue QR passes." }, { status: 403 });
    }
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ success: false, message: "Invalid registration ID." }, { status: 400 });
    await connectDB();

    const registration = await Registration.findById(id);
    if (!registration || registration.status !== "APPROVED") {
      return NextResponse.json({ success: false, message: "Approve the registration before issuing QR passes." }, { status: 409 });
    }
    const [employee, attendees] = await Promise.all([
      Employee.findById(registration.employee).select("fullName officialEmail employeeId"),
      Attendee.find({ registration: registration._id }).sort({ attendeeType: 1 }),
    ]);
    if (!employee) return NextResponse.json({ success: false, message: "Registration employee was not found." }, { status: 404 });
    const partner = attendees.find((attendee) => attendee.attendeeType === "PARTNER");
    if (registration.attendanceType === "COUPLE") {
      if (!partner) return NextResponse.json({ success: false, message: "Partner attendee was not found." }, { status: 409 });
      const document = await PartnerDocument.findOne({ attendee: partner._id });
      if (!document || document.verificationStatus !== "APPROVED") {
        return NextResponse.json({ success: false, message: "Approve the partner document before issuing QR passes." }, { status: 409 });
      }
      await QRPass.updateMany(
        { attendee: partner._id, registration: registration._id, status: "ACTIVE" },
        { $set: { status: "REVOKED", revokedAt: new Date(), revokedBy: admin._id, revocationReason: "Replaced by shared couple pass." } }
      );
    }

    const employeeAttendee = attendees.find((attendee) => attendee.attendeeType === "EMPLOYEE");
    if (!employeeAttendee) return NextResponse.json({ success: false, message: "Employee attendee was not found." }, { status: 409 });
    const issueAttendees = registration.attendanceType === "COUPLE" ? [employeeAttendee] : attendees;
    const issued: Array<{ attendee: (typeof attendees)[number]; token: string; passId: Types.ObjectId }> = [];
    for (const attendee of issueAttendees) {
      const prior = await QRPass.findOne({ attendee: attendee._id }).select("+tokenHash +encryptedToken");
      if (prior?.status === "ACTIVE") {
        return NextResponse.json({ success: false, message: "An active pass already exists. Use QR Passes to resend or manage it." }, { status: 409 });
      }
      const token = generateQrToken();
      const passData = {
        registration: registration._id,
        tokenHash: hashQrToken(token),
        encryptedToken: encryptQrToken(token),
        status: "ACTIVE" as const,
        issuedAt: new Date(),
        issuedBy: admin._id,
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
      if (prior) {
        const updated = await QRPass.findOneAndUpdate({ _id: prior._id, status: prior.status, tokenHash: prior.tokenHash }, { $set: passData }, { new: true });
        if (!updated) throw new Error("A QR pass changed concurrently. Please retry.");
      } else {
        const created = await QRPass.create({ attendee: attendee._id, ...passData });
        issued.push({ attendee, token, passId: created._id });
        continue;
      }
      issued.push({ attendee, token, passId: prior._id });
    }

    if (registration.attendanceType === "COUPLE" && (!partner || issued.length !== 1)) {
      throw new Error("Couple pass issuance requires both attendees and one shared pass.");
    }

    const qr = await QRCode.toDataURL(issued[0].token, { width: 420, margin: 2, errorCorrectionLevel: "H" });
    const ticketSvg = registration.attendanceType === "COUPLE" && partner
      ? buildSharedCoupleQrTicketSvg(employee.fullName, partner.fullName, employee.employeeId, qr)
      : buildQrTicketSvg(employee.fullName, employee.employeeId, qr);
    const combinedPass = await sharp(Buffer.from(ticketSvg)).png().toBuffer();
    const combinedPassBase64 = combinedPass.toString("base64");
    const coupleDownloadUrl = registration.attendanceType === "COUPLE"
      ? new URL(withBasePath(`/api/employee/couple-qr-download?token=${encodeURIComponent(issued[0].token)}`), request.nextUrl.origin).toString()
      : null;
    const attemptAt = new Date();
    await QRPass.updateMany({ _id: { $in: issued.map(({ passId }) => passId) }, status: "ACTIVE" }, { $inc: { emailAttempts: 1 }, $set: { emailLastAttemptAt: attemptAt } });
    try {
      const emailResult = await sendEmail({
        to: employee.officialEmail,
        subject: "Your Seasia Gala Event QR Passes",
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#222"><h2>Your Seasia Gala event pass is ready</h2><p>Hello ${employee.fullName.replace(/[&<>"']/g, "")},</p><p>This single QR pass is valid for both attendees:</p><p><strong>Employee:</strong> ${employee.fullName.replace(/[&<>"']/g, "")}<br/><strong>Partner:</strong> ${partner?.fullName.replace(/[&<>"']/g, "") || "—"}</p><img src="cid:couple-passes" alt="Seasia Gala shared couple pass" style="display:block;width:100%;max-width:460px;height:auto;margin:20px auto"/><p>Show this same QR at the event entry and food collection.</p><p>Regards,<br/>Seasia Gala Event Team</p></div>`,
        text: `Your Seasia Gala shared pass is ready for ${employee.fullName}${partner ? ` and ${partner.fullName}` : ""}. This one QR code is valid for entry and food collection.${coupleDownloadUrl ? ` Download the pass: ${coupleDownloadUrl}` : ""}`,
        attachments: [{ content: combinedPassBase64, filename: `Seasia-Gala-${employee.employeeId}-Event-Pass.png`, type: "image/png", disposition: "inline", content_id: "couple-passes" }],
      });
      await QRPass.updateMany({ registration: registration._id, status: "ACTIVE" }, { $set: { emailStatus: "SENT", emailSentAt: new Date(), emailProviderMessageId: emailResult.messageId || null, emailLastError: null } });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 1000) : "Email delivery failed.";
      await QRPass.updateMany({ registration: registration._id, status: "ACTIVE" }, { $set: { emailStatus: "FAILED", emailLastError: message } });
      return NextResponse.json({ success: true, message: `QR passes were generated, but email to ${employee.officialEmail} failed. Resend from QR Passes.`, emailSent: false });
    }
    return NextResponse.json({ success: true, message: `QR passes generated and emailed to ${employee.officialEmail}.`, emailSent: true });
  } catch (error) {
    console.error("Registration QR issuance error:", error);
    return NextResponse.json({ success: false, message: "Unable to issue QR passes. Please retry." }, { status: 500 });
  }
}
