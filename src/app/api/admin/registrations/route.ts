import { NextRequest, NextResponse } from "next/server";
import { connection } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getCurrentAdmin, isNextPrerenderInterruption } from "@/lib/auth/session";
import Employee from "@/models/Employee";
import Registration from "@/models/Registration";
import Attendee from "@/models/Attendee";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const allowedStatuses = [
  "PENDING_ADMIN_APPROVAL",
  "APPROVED",
  "REJECTED",
  "CORRECTION_REQUESTED",
  "CANCELLED",
];

export async function GET(request: NextRequest) {
  await connection();

  try {

    // Protect this endpoint with the existing admin session.
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
        { success: false, message: "You do not have permission to access registrations." },
        { status: 403 }
      );
    }

    await connectDB();

    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") || "";
    const attendanceType = searchParams.get("attendanceType") || "";

    const page = Math.max(
      1,
      Number.parseInt(searchParams.get("page") || "1", 10) || 1
    );

    const limit = Math.min(
      100,
      Math.max(
        1,
        Number.parseInt(searchParams.get("limit") || "10", 10) || 10
      )
    );

    const filter: Record<string, unknown> = {};

    // Registration status filter
    if (status && allowedStatuses.includes(status)) {
      filter.status = status;
    }

    // Single / Couple filter
    if (attendanceType === "SINGLE" || attendanceType === "COUPLE") {
      filter.attendanceType = attendanceType;
    }

    // Search employee information
    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), "i");

      const matchingEmployees = await Employee.find({
        $or: [
          { fullName: searchRegex },
          { officialEmail: searchRegex },
          { employeeId: searchRegex },
        ],
      })
        .select("_id")
        .lean();

      filter.employee = {
        $in: matchingEmployees.map((employee) => employee._id),
      };
    }

    // Overall registration statistics
    const [
      totalRegistrations,
      pendingRegistrations,
      approvedRegistrations,
      rejectedRegistrations,
      correctionRegistrations,
      totalCouples,
      totalSingles,
    ] = await Promise.all([
      Registration.countDocuments(),
      Registration.countDocuments({
        status: "PENDING_ADMIN_APPROVAL",
      }),
      Registration.countDocuments({ status: "APPROVED" }),
      Registration.countDocuments({ status: "REJECTED" }),
      Registration.countDocuments({
        status: "CORRECTION_REQUESTED",
      }),
      Registration.countDocuments({ attendanceType: "COUPLE" }),
      Registration.countDocuments({ attendanceType: "SINGLE" }),
    ]);

    const [total, registrations] = await Promise.all([
      Registration.countDocuments(filter),

      Registration.find(filter)
        .populate(
          "employee",
          "fullName officialEmail phoneNumber employeeId"
        )
        .sort({ submittedAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    const registrationIds = registrations.map((item) => item._id);

    const attendees = await Attendee.find({
      registration: { $in: registrationIds },
    })
      .select("registration attendeeType fullName title")
      .lean();

    const attendeeMap = new Map<string, typeof attendees>();

    for (const attendee of attendees) {
      const registrationId = attendee.registration.toString();

      const existing = attendeeMap.get(registrationId) || [];
      existing.push(attendee);

      attendeeMap.set(registrationId, existing);
    }

    const data = registrations.map((registration) => ({
      ...registration,
      attendees:
        attendeeMap.get(registration._id.toString()) || [],
    }));

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      statistics: {
        totalRegistrations,
        pendingRegistrations,
        approvedRegistrations,
        rejectedRegistrations,
        correctionRegistrations,
        totalCouples,
        totalSingles,
      },
    });
  } catch (error) {
    if (isNextPrerenderInterruption(error)) throw error;
    console.error("Admin registration listing error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to fetch registrations.",
      },
      { status: 500 }
    );
  }
}
