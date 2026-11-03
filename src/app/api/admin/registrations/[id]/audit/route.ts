
import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { getCurrentAdmin } from "@/lib/auth/session";

import Registration from "@/models/Registration";
import RegistrationAudit from "@/models/RegistrationAudit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
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
          message: "You do not have permission to view audit history.",
        },
        { status: 403 }
      );
    }

    const { id } = await params;

    if (!/^[a-fA-F0-9]{24}$/.test(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid registration ID." },
        { status: 400 }
      );
    }

    await connectDB();

    const registrationExists = await Registration.exists({
      _id: id,
    });

    if (!registrationExists) {
      return NextResponse.json(
        { success: false, message: "Registration not found." },
        { status: 404 }
      );
    }

    const history = await RegistrationAudit.find({
      registration: id,
    })
      .populate("admin", "fullName email")
      .populate("attendee", "fullName attendeeType")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return NextResponse.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error("Registration audit API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to fetch registration audit history.",
      },
      { status: 500 }
    );
  }
}
