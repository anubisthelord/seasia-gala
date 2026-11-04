import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { connectDB } from "@/lib/mongodb";
import Registration from "@/models/Registration";
import Employee from "@/models/Employee";
import Attendee from "@/models/Attendee";
import PartnerDocument from "@/models/PartnerDocument";
import QRPass from "@/models/QRPass";
import { hashQrToken } from "@/lib/security/qr-token";
import { buildSharedCoupleQrTicketSvg } from "@/lib/qr-ticket";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token || token.length > 200) {
    return NextResponse.json({ success: false, message: "Invalid couple ticket download link." }, { status: 400 });
  }

  try {
    await connectDB();
    const pass = await QRPass.findOne({ tokenHash: hashQrToken(token), status: "ACTIVE" }).select("attendee registration").lean();
    if (!pass) {
      return NextResponse.json({ success: false, message: "This couple pass is invalid or no longer active." }, { status: 404 });
    }

    const registration = await Registration.findById(pass.registration).select("status attendanceType employee").lean();
    if (!registration || registration.status !== "APPROVED" || registration.attendanceType !== "COUPLE") {
      return NextResponse.json({ success: false, message: "This couple registration is not approved." }, { status: 404 });
    }
    const [employeeAttendee, partnerAttendee, employee] = await Promise.all([
      Attendee.findOne({ registration: registration._id, attendeeType: "EMPLOYEE" }).select("fullName").lean(),
      Attendee.findOne({ registration: registration._id, attendeeType: "PARTNER" }).select("fullName").lean(),
      Employee.findById(registration.employee).select("employeeId").lean(),
    ]);
    const document = partnerAttendee
      ? await PartnerDocument.findOne({ attendee: partnerAttendee._id }).select("verificationStatus").lean()
      : null;
    if (!employeeAttendee || !partnerAttendee || !employee || document?.verificationStatus !== "APPROVED") {
      return NextResponse.json({ success: false, message: "Approved couple ticket details could not be found." }, { status: 404 });
    }

    const qr = await QRCode.toDataURL(token, { width: 800, margin: 2, errorCorrectionLevel: "H" });
    const svg = buildSharedCoupleQrTicketSvg(employeeAttendee.fullName, partnerAttendee.fullName, employee.employeeId, qr);
    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="Seasia-Gala-${employee.employeeId}-Event-Pass.svg"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Couple QR ticket download error:", error);
    return NextResponse.json({ success: false, message: "Unable to download couple QR tickets." }, { status: 500 });
  }
}
