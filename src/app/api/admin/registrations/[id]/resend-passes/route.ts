import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import QRCode from "qrcode";
import sharp from "sharp";
import { connectDB } from "@/lib/mongodb";
import { getCurrentAdmin } from "@/lib/auth/session";
import Registration from "@/models/Registration";
import Employee from "@/models/Employee";
import Attendee from "@/models/Attendee";
import PartnerDocument from "@/models/PartnerDocument";
import QRPass from "@/models/QRPass";
import { decryptQrToken } from "@/lib/security/qr-token";
import { buildQrTicketSvg, buildSharedCoupleQrTicketSvg } from "@/lib/qr-ticket";
import { sendEmail } from "@/lib/email";
import { withBasePath } from "@/config/base-path";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const admin = await getCurrentAdmin(request);
    if (!admin) return NextResponse.json({ success: false, message: "Unauthorized access." }, { status: 401 });
    if (admin.role !== "SUPER_ADMIN" && admin.role !== "REGISTRATION_ADMIN") return NextResponse.json({ success: false, message: "You do not have permission to resend QR passes." }, { status: 403 });
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ success: false, message: "Invalid registration ID." }, { status: 400 });
    await connectDB();
    const registration = await Registration.findById(id);
    if (!registration || registration.status !== "APPROVED") return NextResponse.json({ success: false, message: "Only approved registrations can resend QR passes." }, { status: 409 });
    if (registration.attendanceType === "SINGLE") {
      const [employee, attendee] = await Promise.all([
        Employee.findById(registration.employee).select("fullName officialEmail employeeId"),
        Attendee.findOne({ registration: registration._id, attendeeType: "EMPLOYEE" }),
      ]);
      if (!employee || !attendee) return NextResponse.json({ success: false, message: "Employee attendee details were not found." }, { status: 404 });
      const pass = await QRPass.findOne({ attendee: attendee._id, registration: registration._id, status: "ACTIVE" }).select("+encryptedToken");
      if (!pass) return NextResponse.json({ success: false, message: "No active QR pass exists for this registration." }, { status: 409 });
      const token = decryptQrToken(pass.encryptedToken);
      const qr = await QRCode.toDataURL(token, { width: 420, margin: 2, errorCorrectionLevel: "H" });
      const ticket = await sharp(Buffer.from(buildQrTicketSvg(attendee.fullName, employee.employeeId, qr))).png().toBuffer();
      const downloadUrl = new URL(withBasePath(`/api/employee/qr-download?token=${encodeURIComponent(token)}`), request.nextUrl.origin).toString();
      await QRPass.updateOne({ _id: pass._id }, { $inc: { emailAttempts: 1 }, $set: { emailLastAttemptAt: new Date(), emailStatus: "PENDING" } });
      const sent = await sendEmail({
        to: employee.officialEmail,
        subject: "Your Seasia Gala Event QR Pass",
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#222"><h2>Your event pass</h2><p>Employee: ${employee.fullName}</p><img src="cid:couple-passes" alt="Seasia Gala event pass" style="display:block;width:100%;max-width:460px;height:auto;margin:20px auto"/><p><a href="${downloadUrl}">Download your SVG pass</a></p></div>`,
        text: `Your Seasia Gala QR pass for ${employee.fullName} is ready. Download your SVG pass: ${downloadUrl}`,
        attachments: [{ content: ticket.toString("base64"), filename: `Seasia-Gala-${employee.employeeId}-Event-Pass.png`, type: "image/png", disposition: "inline", content_id: "couple-passes" }],
      });
      await QRPass.updateOne({ _id: pass._id }, { $set: { emailStatus: "SENT", emailSentAt: new Date(), emailProviderMessageId: sent.messageId || null, emailLastError: null } });
      return NextResponse.json({ success: true, message: `QR pass emailed to ${employee.officialEmail}.` });
    }
    const [employee, employeeAttendee, partnerAttendee] = await Promise.all([
      Employee.findById(registration.employee).select("fullName officialEmail employeeId"),
      Attendee.findOne({ registration: registration._id, attendeeType: "EMPLOYEE" }),
      Attendee.findOne({ registration: registration._id, attendeeType: "PARTNER" }),
    ]);
    if (!employee || !employeeAttendee || !partnerAttendee) return NextResponse.json({ success: false, message: "Both attendee records are required." }, { status: 404 });
    const document = await PartnerDocument.findOne({ attendee: partnerAttendee._id });
    if (document?.verificationStatus !== "APPROVED") return NextResponse.json({ success: false, message: "The partner document must be approved first." }, { status: 409 });
    await QRPass.updateMany({ attendee: partnerAttendee._id, registration: registration._id, status: "ACTIVE" }, { $set: { status: "REVOKED", revokedAt: new Date(), revokedBy: admin._id, revocationReason: "Replaced by shared couple pass." } });
    let pass = await QRPass.findOne({ attendee: employeeAttendee._id, registration: registration._id, status: "ACTIVE" }).select("+encryptedToken");
    if (!pass) return NextResponse.json({ success: false, message: "The shared QR pass has not been issued yet." }, { status: 409 });
    const token = decryptQrToken(pass.encryptedToken);
    const qr = await QRCode.toDataURL(token, { width: 420, margin: 2, errorCorrectionLevel: "H" });
    const ticket = await sharp(Buffer.from(buildSharedCoupleQrTicketSvg(employee.fullName, partnerAttendee.fullName, employee.employeeId, qr))).png().toBuffer();
    const downloadUrl = new URL(withBasePath(`/api/employee/couple-qr-download?token=${encodeURIComponent(token)}`), request.nextUrl.origin).toString();
    await QRPass.updateOne({ _id: pass._id }, { $inc: { emailAttempts: 1 }, $set: { emailLastAttemptAt: new Date(), emailStatus: "PENDING" } });
    const buttonStyles = [
      "display:inline-block",
      "padding:12px 24px",
      "background-color:#7c3aed",       // purple (violet-600)
      "color:#ffffff",
      "font-family:Arial,sans-serif",
      "font-size:14px",
      "font-weight:bold",
      "text-decoration:none",
      "border-radius:6px",
  ].join(";");
  
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#222">
      <h2>Your shared event pass</h2>
      <p>
          <strong>Employee:</strong> ${employee.fullName}<br/>
          <strong>Partner:</strong> ${partnerAttendee.fullName}
      </p>
      <img src="cid:couple-passes" alt="Shared couple event pass"
           style="display:block;width:100%;max-width:460px;height:auto;margin:20px auto"/>
      <p>Show this one QR at event entry and food collection.</p>
      <p style="text-align:center;margin:28px 0">
          <a href="${downloadUrl}" style="${buttonStyles}">Download your event pass</a>
      </p>
  </div>`;
  
  const sent = await sendEmail({
      to: employee.officialEmail,
      subject: "Your Seasia Gala Shared Event Pass",
      html,
      text: `Your shared Seasia Gala QR pass is for ${employee.fullName} and ${partnerAttendee.fullName}. Use it for entry and food collection. Download: ${downloadUrl}`,
      attachments: [
          {
              content: ticket.toString("base64"),
              filename: `Seasia-Gala-${employee.employeeId}-Event-Pass.png`,
              type: "image/png",
              disposition: "inline",
              content_id: "couple-passes",
          },
      ],
  });
    await QRPass.updateOne({ _id: pass._id }, { $set: { emailStatus: "SENT", emailSentAt: new Date(), emailProviderMessageId: sent.messageId || null, emailLastError: null } });
    return NextResponse.json({ success: true, message: `Shared QR pass emailed to ${employee.officialEmail}.` });
  } catch (error) {
    console.error("Resend shared couple QR pass error:", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Unable to resend QR pass." }, { status: 500 });
  }
}
