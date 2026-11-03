import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

import { connectDB } from "@/lib/mongodb";
import QRPass from "@/models/QRPass";
import Attendee from "@/models/Attendee";
import Registration from "@/models/Registration";
import Employee from "@/models/Employee";
import { hashQrToken } from "@/lib/security/qr-token";
import { buildQrTicketSvg } from "@/lib/qr-ticket";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token || token.length > 200) {
    return NextResponse.json(
      { success: false, message: "Invalid QR download link." },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    const qrPass = await QRPass.findOne({
      tokenHash: hashQrToken(token),
      status: "ACTIVE",
    }).select("attendee registration").lean();

    if (!qrPass) {
      return NextResponse.json(
        { success: false, message: "This QR pass is invalid or no longer active." },
        { status: 404 }
      );
    }

    const [attendee, registration] = await Promise.all([
      Attendee.findById(qrPass.attendee).select("fullName").lean(),
      Registration.findById(qrPass.registration).select("employee").lean(),
    ]);
    const employee = registration
      ? await Employee.findById(registration.employee).select("employeeId").lean()
      : null;

    if (!attendee || !employee) {
      return NextResponse.json(
        { success: false, message: "Ticket details could not be found." },
        { status: 404 }
      );
    }

    const qrImage = await QRCode.toDataURL(token, {
      width: 400,
      margin: 2,
      errorCorrectionLevel: "M",
    });
    const ticketSvg = buildQrTicketSvg(
      attendee.fullName,
      employee.employeeId,
      qrImage
    );

    return new NextResponse(ticketSvg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Disposition": 'attachment; filename="Seasia-Gala-Ticket.svg"',
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("QR image download error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to download the QR pass right now." },
      { status: 500 }
    );
  }
}
