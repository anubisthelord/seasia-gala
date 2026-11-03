
import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { getCurrentAdmin } from "@/lib/auth/session";

import Registration from "@/models/Registration";
import Attendee from "@/models/Attendee";
import PartnerDocument from "@/models/PartnerDocument";

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
          message: "You do not have permission to view registration details.",
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

    const registration = await Registration.findById(id)
      .populate(
        "employee",
        "fullName officialEmail phoneNumber employeeId emailVerifiedAt"
      )
      .lean();

    if (!registration) {
      return NextResponse.json(
        { success: false, message: "Registration not found." },
        { status: 404 }
      );
    }

    const attendees = await Attendee.find({
      registration: registration._id,
    })
      .select("attendeeType fullName title createdAt")
      .sort({ attendeeType: 1 })
      .lean();

    // Find partner attendee and retrieve safe document metadata.
    const partnerAttendee = attendees.find(
      (attendee) => attendee.attendeeType === "PARTNER"
    );

    let partnerDocument = null;

    if (partnerAttendee) {
      const document = await PartnerDocument.findOne({
        attendee: partnerAttendee._id,
      })
        .select(
          "documentType verificationStatus reviewedAt rejectionReason createdAt"
        )
        .lean();

      if (document) {
        partnerDocument = {
          documentType: document.documentType,
          verificationStatus: document.verificationStatus,
          reviewedAt: document.reviewedAt,
          rejectionReason: document.rejectionReason,
          uploadedAt: document.createdAt,
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...registration,
        employee: registration.employee,
        attendees,
        partnerDocument,
      },
    });
  } catch (error) {
    console.error("Registration details API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to fetch registration details.",
      },
      { status: 500 }
    );
  }
}
