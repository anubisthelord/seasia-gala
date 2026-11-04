
import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { getCurrentAdmin } from "@/lib/auth/session";

import Registration from "@/models/Registration";
import Attendee from "@/models/Attendee";
import PartnerDocument from "@/models/PartnerDocument";
import QRPass from "@/models/QRPass";
import Employee from "@/models/Employee";
import EmailOtp from "@/models/EmailOtp";
import RegistrationAudit from "@/models/RegistrationAudit";
import ScannerScanLog from "@/models/ScannerScanLog";
import { deletePartnerDocument } from "@/lib/storage/partner-documents";
import path from "node:path";

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

    const qrPasses = await QRPass.find({ registration: registration._id })
      .select("attendee status emailStatus issuedAt emailSentAt")
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        ...registration,
        employee: registration.employee,
        attendees,
        partnerDocument,
        qrPasses,
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

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const admin = await getCurrentAdmin(request);
    if (!admin) return NextResponse.json({ success: false, message: "Unauthorized access." }, { status: 401 });
    if (admin.role !== "SUPER_ADMIN" && admin.role !== "REGISTRATION_ADMIN") {
      return NextResponse.json({ success: false, message: "You do not have permission to delete registrations." }, { status: 403 });
    }

    const { id } = await params;
    if (!/^[a-fA-F0-9]{24}$/.test(id)) return NextResponse.json({ success: false, message: "Invalid registration ID." }, { status: 400 });
    await connectDB();

    const registration = await Registration.findById(id).select("employee");
    if (!registration) return NextResponse.json({ success: false, message: "Registration not found." }, { status: 404 });

    const employee = await Employee.findById(registration.employee).select("officialEmail");
    const attendees = await Attendee.find({ registration: registration._id }).select("_id").lean();
    const attendeeIds = attendees.map((attendee) => attendee._id);
    const documents = await PartnerDocument.find({ attendee: { $in: attendeeIds } }).select("storageKey").lean();
    const storageRoot = path.resolve(process.cwd(), "storage", "private");

    await Promise.all([
      QRPass.deleteMany({ registration: registration._id }),
      ScannerScanLog.deleteMany({ registration: registration._id }),
      RegistrationAudit.deleteMany({ registration: registration._id }),
      PartnerDocument.deleteMany({ attendee: { $in: attendeeIds } }),
      Attendee.deleteMany({ registration: registration._id }),
      employee ? EmailOtp.deleteOne({ officialEmail: employee.officialEmail }) : Promise.resolve(),
    ]);
    await Registration.deleteOne({ _id: registration._id });
    await Employee.deleteOne({ _id: registration.employee });

    await Promise.all(documents.map(async ({ storageKey }) => {
      const filePath = path.resolve(storageRoot, storageKey);
      if (filePath.startsWith(`${storageRoot}${path.sep}`)) await deletePartnerDocument(filePath);
    }));

    return NextResponse.json({ success: true, message: "Registration and its related records were deleted." });
  } catch (error) {
    console.error("Registration delete API error:", error);
    return NextResponse.json({ success: false, message: "Unable to delete this registration." }, { status: 500 });
  }
}
