import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import QRCode from "qrcode";
import { connectDB } from "@/lib/mongodb";
import { getCurrentAdmin } from "@/lib/auth/session";
import Registration from "@/models/Registration";
import Attendee from "@/models/Attendee";
import Employee from "@/models/Employee";
import PartnerDocument from "@/models/PartnerDocument";
import QRPass from "@/models/QRPass";
import { decryptQrToken } from "@/lib/security/qr-token";
import { buildSharedCoupleQrTicketSvg } from "@/lib/qr-ticket";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const admin = await getCurrentAdmin(request);
  if (!admin) return NextResponse.json({ success: false, message: "Unauthorized access." }, { status: 401 });
  if (admin.role !== "SUPER_ADMIN" && admin.role !== "REGISTRATION_ADMIN") {
    return NextResponse.json({ success: false, message: "You do not have permission to download QR passes." }, { status: 403 });
  }

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) return NextResponse.json({ success: false, message: "Invalid registration ID." }, { status: 400 });

  try {
    await connectDB();
    const registration = await Registration.findById(id).select("status attendanceType employee").lean();
    if (!registration || registration.status !== "APPROVED" || registration.attendanceType !== "COUPLE") {
      return NextResponse.json({ success: false, message: "An approved couple registration is required." }, { status: 404 });
    }

    const [employee, employeeAttendee, partnerAttendee] = await Promise.all([
      Employee.findById(registration.employee).select("employeeId").lean(),
      Attendee.findOne({ registration: registration._id, attendeeType: "EMPLOYEE" }).select("fullName").lean(),
      Attendee.findOne({ registration: registration._id, attendeeType: "PARTNER" }).select("fullName").lean(),
    ]);
    if (!employee || !employeeAttendee || !partnerAttendee) {
      return NextResponse.json({ success: false, message: "Couple attendee details could not be found." }, { status: 404 });
    }
    const [pass, document] = await Promise.all([
      QRPass.findOne({ registration: registration._id, attendee: employeeAttendee._id, status: "ACTIVE" }).select("+encryptedToken").lean(),
      PartnerDocument.findOne({ attendee: partnerAttendee._id }).select("verificationStatus").lean(),
    ]);
    if (!pass || document?.verificationStatus !== "APPROVED") {
      return NextResponse.json({ success: false, message: "The shared QR pass is not active and approved." }, { status: 404 });
    }

    const token = decryptQrToken(pass.encryptedToken);
    const qr = await QRCode.toDataURL(token, { width: 800, margin: 2, errorCorrectionLevel: "H" });
    const svg = buildSharedCoupleQrTicketSvg(employeeAttendee.fullName, partnerAttendee.fullName, employee.employeeId, qr);
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="Seasia-Gala-${employee.employeeId}-Event-Pass.svg"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Admin shared couple pass download error:", error);
    return NextResponse.json({ success: false, message: "Unable to download the shared couple pass." }, { status: 500 });
  }
}
