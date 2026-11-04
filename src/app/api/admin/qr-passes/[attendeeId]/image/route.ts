import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import sharp from "sharp";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { getCurrentAdmin } from "@/lib/auth/session";
import QRPass from "@/models/QRPass";
import Registration from "@/models/Registration";
import Attendee from "@/models/Attendee";
import Employee from "@/models/Employee";
import { decryptQrToken } from "@/lib/security/qr-token";
import { buildSharedCoupleQrTicketSvg } from "@/lib/qr-ticket";

type Context = { params: Promise<{ attendeeId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const admin = await getCurrentAdmin(request);
  if (!admin) return NextResponse.json({ success: false, message: "Unauthorized access." }, { status: 401 });
  if (admin.role !== "SUPER_ADMIN" && admin.role !== "REGISTRATION_ADMIN") return NextResponse.json({ success: false, message: "You do not have permission to view QR passes." }, { status: 403 });
  const { attendeeId } = await params;
  if (!Types.ObjectId.isValid(attendeeId)) return NextResponse.json({ success: false, message: "Invalid attendee ID." }, { status: 400 });
  try {
    await connectDB();
    const pass = await QRPass.findOne({ attendee: attendeeId, status: "ACTIVE" }).select("+encryptedToken");
    if (!pass) return NextResponse.json({ success: false, message: "Active QR pass not found." }, { status: 404 });
    const token = decryptQrToken(pass.encryptedToken);
    const registration = await Registration.findById(pass.registration).select("attendanceType employee");
    if (registration?.attendanceType === "COUPLE") {
      const [employee, employeeAttendee, partnerAttendee] = await Promise.all([
        Employee.findById(registration.employee).select("fullName employeeId"),
        Attendee.findOne({ registration: registration._id, attendeeType: "EMPLOYEE" }).select("fullName"),
        Attendee.findOne({ registration: registration._id, attendeeType: "PARTNER" }).select("fullName"),
      ]);
      if (!employee || !employeeAttendee || !partnerAttendee) return NextResponse.json({ success: false, message: "Couple attendee details not found." }, { status: 404 });
      const qrDataUrl = await QRCode.toDataURL(token, { width: 420, margin: 2, errorCorrectionLevel: "H" });
      const ticket = buildSharedCoupleQrTicketSvg(employeeAttendee.fullName, partnerAttendee.fullName, employee.employeeId, qrDataUrl);
      const image = await sharp(Buffer.from(ticket)).png().toBuffer();
      return new NextResponse(new Uint8Array(image), { headers: { "Content-Type": "image/png", "Content-Disposition": 'inline; filename="shared-couple-qr-pass.png"', "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
    }
    const image = await QRCode.toBuffer(token, { type: "png", width: 420, margin: 2, errorCorrectionLevel: "H" });
    return new NextResponse(new Uint8Array(image), { headers: { "Content-Type": "image/png", "Content-Disposition": 'inline; filename="qr-pass.png"', "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    console.error("Admin QR image error:", error);
    return NextResponse.json({ success: false, message: "Unable to display QR pass." }, { status: 500 });
  }
}
