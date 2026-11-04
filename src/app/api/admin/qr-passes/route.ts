import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { connection } from "next/server";
import { Types } from "mongoose";

import { connectDB } from "@/lib/mongodb";
import { getCurrentAdmin, isNextPrerenderInterruption } from "@/lib/auth/session";

import Attendee from "@/models/Attendee";
import PartnerDocument from "@/models/PartnerDocument";
import QRPass from "@/models/QRPass";

const REGISTRATION_STATUSES = [
  "PENDING_ADMIN_APPROVAL",
  "APPROVED",
  "REJECTED",
  "CORRECTION_REQUESTED",
  "CANCELLED",
];

const PASS_STATUSES = ["ACTIVE", "REVOKED", "NOT_ISSUED"];

// Types to satisfy TypeScript when using .populate().lean()
type PopulatedEmployee = {
  _id: Types.ObjectId;
  fullName: string;
  officialEmail: string;
  employeeId: string;
};

type PopulatedRegistration = {
  _id: Types.ObjectId;
  attendanceType: string;
  status: string;
  employee?: PopulatedEmployee;
};

type PopulatedAttendee = {
  _id: Types.ObjectId;
  fullName: string;
  attendeeType: "EMPLOYEE" | "PARTNER";
  registration?: PopulatedRegistration;
};

export async function GET(request: NextRequest) {
  await connection();

  try {

    // 1. Authenticate admin
    const admin = await getCurrentAdmin(request);

    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // FIX: Allow both SUPER_ADMIN and REGISTRATION_ADMIN
    const allowedRoles = ["SUPER_ADMIN", "REGISTRATION_ADMIN"];
    if (!allowedRoles.includes(admin.role)) {
      return NextResponse.json(
        { success: false, message: "Insufficient permissions" },
        { status: 403 }
      );
    }

    await connectDB();

    // 2. Read filters and pagination
    const searchParams = request.nextUrl.searchParams;

    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const registrationStatus = searchParams.get("registrationStatus") || "ALL";
    const passStatus = searchParams.get("passStatus") || "ALL";
    const attendanceType = searchParams.get("attendanceType") || "ALL";

    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number(searchParams.get("limit")) || 10)
    );

    if (
      registrationStatus !== "ALL" &&
      !REGISTRATION_STATUSES.includes(registrationStatus)
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid registration status filter" },
        { status: 400 }
      );
    }

    if (passStatus !== "ALL" && !PASS_STATUSES.includes(passStatus)) {
      return NextResponse.json(
        { success: false, message: "Invalid QR pass status filter" },
        { status: 400 }
      );
    }
    if (attendanceType !== "ALL" && attendanceType !== "SINGLE" && attendanceType !== "COUPLE") {
      return NextResponse.json({ success: false, message: "Invalid attendance type filter" }, { status: 400 });
    }

    // 3. Fetch attendees and their registration/employee details
    const attendees = (await Attendee.find()
      .populate({
        path: "registration",
        select: "attendanceType status employee",
        populate: {
          path: "employee",
          select: "fullName officialEmail employeeId",
        },
      })
      .sort({ createdAt: -1 })
      .lean()) as unknown as PopulatedAttendee[];

    const attendeeIds = attendees.map((attendee) => attendee._id);

    // 4. Fetch partner document verification statuses
    const partnerDocuments = await PartnerDocument.find({
      attendee: { $in: attendeeIds },
    })
      .select("attendee verificationStatus")
      .lean();

    const partnerDocumentMap = new Map<string, string>();
    for (const document of partnerDocuments) {
      if (document.attendee) {
        partnerDocumentMap.set(
          document.attendee.toString(),
          document.verificationStatus
        );
      }
    }

    // 5. Fetch existing QR pass metadata
    const qrPasses = await QRPass.find({
      attendee: { $in: attendeeIds },
    })
      .select("attendee status issuedAt")
      .lean();

    const qrPassMap = new Map<
      string,
      { status: string; issuedAt: Date | null }
    >();

    for (const pass of qrPasses) {
      if (pass.attendee) {
        qrPassMap.set(pass.attendee.toString(), {
          status: pass.status,
          issuedAt: pass.issuedAt || null,
        });
      }
    }

    // 6. Build attendee records with eligibility
    const rows = attendees.map((attendee) => {
      const registration = attendee.registration;
      const employee = registration?.employee;

      const attendeeId = attendee._id.toString();

      const partnerDocumentStatus =
        attendee.attendeeType === "PARTNER"
          ? partnerDocumentMap.get(attendeeId) || "MISSING"
          : null;

      const existingPass = qrPassMap.get(attendeeId);

      const registrationApproved = registration?.status === "APPROVED";

      const partnerApproved =
        attendee.attendeeType !== "PARTNER" ||
        partnerDocumentStatus === "APPROVED";

      const eligible = Boolean(registrationApproved && partnerApproved);

      return {
        attendeeId,
        attendeeName: attendee.fullName,
        attendeeType: attendee.attendeeType,

        employee: employee
          ? {
              fullName: employee.fullName,
              officialEmail: employee.officialEmail,
              employeeId: employee.employeeId,
            }
          : null,

        registrationId: registration?._id?.toString() || null,
        registrationStatus: registration?.status || "UNKNOWN",
        attendanceType: registration?.attendanceType || null,

        partnerDocumentStatus,
        eligible,

        qrPassStatus: existingPass?.status || "NOT_ISSUED",
        issuedAt: existingPass?.issuedAt || null,
      };
    });

    // Show one pass row per registration; couple details stay together.
    const registrationRows = rows
      .filter((row) => row.attendeeType === "EMPLOYEE")
      .map((row) => {
        const partner = attendees.find((item) => item.registration?._id.toString() === row.registrationId && item.attendeeType === "PARTNER");
        return {
          ...row,
          partnerName: partner?.fullName || null,
          partnerDocumentStatus: partner ? partnerDocumentMap.get(partner._id.toString()) || "MISSING" : null,
          eligible: row.eligible && (!partner || partnerDocumentMap.get(partner._id.toString()) === "APPROVED"),
        };
      });

    // 7. Apply type and search filters
    let filteredRows = registrationRows;

    if (attendanceType !== "ALL") {
      filteredRows = filteredRows.filter((row) => row.attendanceType === attendanceType);
    }

    if (search) {
      filteredRows = filteredRows.filter((row) => {
        const searchableValues = [
          row.attendeeName,
          row.partnerName,
          row.employee?.fullName,
          row.employee?.officialEmail,
          row.employee?.employeeId,
        ];

        return searchableValues.some((value) =>
          value?.toLowerCase().includes(search)
        );
      });
    }

    // 8. Apply registration status filter
    if (registrationStatus !== "ALL") {
      filteredRows = filteredRows.filter(
        (row) => row.registrationStatus === registrationStatus
      );
    }

    // 9. Apply QR pass status filter
    if (passStatus !== "ALL") {
      filteredRows = filteredRows.filter(
        (row) => row.qrPassStatus === passStatus
      );
    }

    // 10. Calculate statistics
    const statistics = {
      totalAttendees: registrationRows.length,
      eligibleAttendees: registrationRows.filter((row) => row.eligible).length,
      notEligibleAttendees: registrationRows.filter((row) => !row.eligible).length,
      employeeAttendees: registrationRows.filter((row) => row.attendanceType === "SINGLE").length,
      partnerAttendees: registrationRows.filter((row) => row.attendanceType === "COUPLE").length,
      issuedPasses: registrationRows.filter((row) => row.qrPassStatus === "ACTIVE").length,
      revokedPasses: registrationRows.filter((row) => row.qrPassStatus === "REVOKED").length,
      notIssuedPasses: registrationRows.filter((row) => row.qrPassStatus === "NOT_ISSUED").length,
    };

    // 11. Paginate
    const total = filteredRows.length;
    const totalPages = Math.ceil(total / limit);

    const startIndex = (page - 1) * limit;

    const paginatedRows = filteredRows.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      success: true,
      data: paginatedRows,
      statistics,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    if (isNextPrerenderInterruption(error)) throw error;
    console.error("QR Pass listing error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to fetch QR passes. Please try again.",
      },
      { status: 500 }
    );
  }
}
