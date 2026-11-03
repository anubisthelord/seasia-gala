import { NextRequest, NextResponse } from "next/server";
import { connection } from "next/server";
import { Types } from "mongoose";

import { connectDB } from "@/lib/mongodb";
import { getCurrentAdmin, isNextPrerenderInterruption } from "@/lib/auth/session";

import Registration from "@/models/Registration";
import Employee from "@/models/Employee";
import Attendee from "@/models/Attendee";
import PartnerDocument from "@/models/PartnerDocument";

// Shape of the populated employee after `.populate(...).lean()`
type PopulatedEmployee = {
  fullName: string;
  officialEmail: string;
  employeeId: string;
};

// Type guard: distinguishes a populated Employee doc from an ObjectId ref
function isPopulatedEmployee(value: unknown): value is PopulatedEmployee {
  return (
    typeof value === "object" &&
    value !== null &&
    !(value instanceof Types.ObjectId) &&
    typeof (value as PopulatedEmployee).fullName === "string"
  );
}

export async function GET(request: NextRequest) {
  await connection();

  try {

    // 1. Authenticate admin
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
          message: "You do not have permission to view partner verification records.",
        },
        { status: 403 }
      );
    }

    await connectDB();

    // 2. Read filters
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") || "ALL";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number(searchParams.get("limit")) || 10)
    );

    const validStatuses = ["ALL", "PENDING", "APPROVED", "REJECTED"];

    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, message: "Invalid verification status." },
        { status: 400 }
      );
    }

    // 3. Find Couple registrations
    const registrations = await Registration.find({
      attendanceType: "COUPLE",
    })
      .select("_id employee status submittedAt")
      .populate({
        path: "employee",
        model: Employee,
        select: "fullName officialEmail employeeId",
      })
      .lean();

    const registrationIds = registrations.map((item) => item._id);

    // Short-circuit when there are no couple registrations
    if (registrationIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        statistics: {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          missingDocument: 0,
        },
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
    }

    // O(1) lookup for registrations
    const registrationMap = new Map(
      registrations.map((item) => [item._id.toString(), item])
    );

    // 4. Find partner attendees
    const partners = await Attendee.find({
      registration: { $in: registrationIds },
      attendeeType: "PARTNER",
    })
      .select("_id registration fullName title")
      .lean();

    const partnerIds = partners.map((item) => item._id);

    // 5. Find partner document metadata
    const documents = await PartnerDocument.find({
      attendee: { $in: partnerIds },
    })
      .select(
        "attendee documentType verificationStatus reviewedAt rejectionReason createdAt"
      )
      .lean();

    const documentMap = new Map(
      documents.map((document) => [document.attendee.toString(), document])
    );

    // 6. Combine records
    const allResults = partners.map((partner) => {
      const registration = registrationMap.get(
        partner.registration.toString()
      );

      const employee =
        registration && isPopulatedEmployee(registration.employee)
          ? registration.employee
          : null;

      const document = documentMap.get(partner._id.toString());

      return {
        _id: partner._id.toString(),
        partnerName: partner.fullName,
        partnerTitle: partner.title,
        registrationId: partner.registration.toString(),

        employee: employee
          ? {
              fullName: employee.fullName,
              officialEmail: employee.officialEmail,
              employeeId: employee.employeeId,
            }
          : null,

        registrationStatus: registration?.status || "UNKNOWN",

        document: document
          ? {
              documentType: document.documentType,
              verificationStatus: document.verificationStatus,
              reviewedAt: document.reviewedAt,
              rejectionReason: document.rejectionReason,
              uploadedAt: document.createdAt,
            }
          : null,
      };
    });

    // 7. Statistics — computed on the FULL dataset (before status/search)
    const statistics = {
      total: allResults.length,
      pending: allResults.filter(
        (item) => item.document?.verificationStatus === "PENDING"
      ).length,
      approved: allResults.filter(
        (item) => item.document?.verificationStatus === "APPROVED"
      ).length,
      rejected: allResults.filter(
        (item) => item.document?.verificationStatus === "REJECTED"
      ).length,
      missingDocument: allResults.filter((item) => !item.document).length,
    };

    // 8. Filter by document verification status
    let results = allResults.filter((item) => {
      if (status === "ALL") return true;
      return item.document?.verificationStatus === status;
    });

    // 9. Search
    if (search) {
      const normalizedSearch = search.toLowerCase();

      results = results.filter((item) => {
        return (
          item.partnerName.toLowerCase().includes(normalizedSearch) ||
          !!item.employee?.fullName
            ?.toLowerCase()
            .includes(normalizedSearch) ||
          !!item.employee?.officialEmail
            ?.toLowerCase()
            .includes(normalizedSearch) ||
          !!item.employee?.employeeId
            ?.toLowerCase()
            .includes(normalizedSearch)
        );
      });
    }

    // 10. Pagination
    const total = results.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;

    const paginatedResults = results.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      success: true,
      data: paginatedResults,
      statistics,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    if (isNextPrerenderInterruption(error)) throw error;
    console.error("Partner verification API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to fetch partner verification records.",
      },
      { status: 500 }
    );
  }
}
