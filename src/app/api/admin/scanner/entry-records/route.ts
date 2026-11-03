import { NextRequest, NextResponse } from "next/server";
import { connection } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { getCurrentAdmin, isNextPrerenderInterruption } from "@/lib/auth/session";
import ScannerScanLog, {
  ScannerResult,
} from "@/models/ScannerScanLog";
import QRPass from "@/models/QRPass";
import { createScannerCsvResponse } from "@/lib/scanner/export-csv";

const ALLOWED_RESULTS: ScannerResult[] = [
  "CHECKED_IN",
  "INVALID_QR",
  "REVOKED",
  "NOT_APPROVED",
  "PARTNER_NOT_APPROVED",
  "SCAN_CONFLICT",
  "ATTENDEE_NOT_FOUND",
];

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: NextRequest) {
  await connection();

  try {

    // 1. Authentication
    const admin = await getCurrentAdmin(request);

    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Unauthorized access." },
        { status: 401 }
      );
    }

    // 2. Role authorization
    if (
      admin.role !== "SUPER_ADMIN" &&
      admin.role !== "REGISTRATION_ADMIN"
    ) {
      return NextResponse.json(
        { success: false, message: "You cannot access Entry Scanner records." },
        { status: 403 }
      );
    }

    await connectDB();

    const { searchParams } = new URL(request.url);

    // 3. Pagination
    const requestedPage = Number(searchParams.get("page") || "1");

    const page =
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1;

    const requestedLimit = Number.parseInt(
      searchParams.get("limit") || "20",
      10
    );

    const limit = Math.min(
      100,
      Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : 20)
    );

    const skip = (page - 1) * limit;

    // 4. Build filters using a flexible type
    const filter: Record<string, unknown> = {
      scannerType: "ENTRY",
      result: { $ne: "ALREADY_CHECKED_IN" },
    };

    const result = searchParams.get("result");

    if (result && result !== "ALL") {
      if (!ALLOWED_RESULTS.includes(result as ScannerResult)) {
        return NextResponse.json(
          { success: false, message: "Invalid scan result filter." },
          { status: 400 }
        );
      }

      filter.result = result as ScannerResult;
    }

    // 5. Date filters
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (from || to) {
      const dateFilter: { $gte?: Date; $lte?: Date } = {};

      if (from) {
        const fromDate = new Date(from);

        if (Number.isNaN(fromDate.getTime())) {
          return NextResponse.json(
            { success: false, message: "Invalid start date." },
            { status: 400 }
          );
        }

        dateFilter.$gte = fromDate;
      }

      if (to) {
        const toDate = new Date(to);

        if (Number.isNaN(toDate.getTime())) {
          return NextResponse.json(
            { success: false, message: "Invalid end date." },
            { status: 400 }
          );
        }

        dateFilter.$lte = toDate;
      }

      if (
        dateFilter.$gte &&
        dateFilter.$lte &&
        dateFilter.$gte > dateFilter.$lte
      ) {
        return NextResponse.json(
          { success: false, message: "Start date cannot be after end date." },
          { status: 400 }
        );
      }

      filter.scannedAt = dateFilter;
    }

    // 6. Search attendee name or Employee ID
    const search = searchParams.get("search")?.trim();

    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), "i");

      filter.$or = [
        { attendeeName: searchRegex },
        { employeeId: searchRegex },
      ];
    }

    // Handle CSV export before pagination
    if (searchParams.get("export") === "csv") {
      const exportCount = await ScannerScanLog.countDocuments(filter);

      if (exportCount > 10000) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Too many records to export at once. Narrow your filters and try again.",
          },
          { status: 413 }
        );
      }

      const exportRecords = (await ScannerScanLog.find(filter)
        .select(
          "result attendeeName employeeId attendeeType message scannedAt scannedBy"
        )
        .populate("scannedBy", "fullName email")
        .sort({ scannedAt: -1, _id: -1 })
        .limit(10000)
        .lean()) as unknown as Parameters<typeof createScannerCsvResponse>[0];

      return createScannerCsvResponse(
        exportRecords,
        "entry-scanner-records.csv"
      );
    }

    // 7. Fetch records and total count
    const [records, total, successful] = await Promise.all([
      ScannerScanLog.find(filter)
        .select(
          "scannerType result scannedBy qrPass registration attendee attendeeName employeeId attendeeType message scannedAt"
        )
        .populate("scannedBy", "fullName email")
        .sort({ scannedAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      ScannerScanLog.countDocuments(filter),

      ScannerScanLog.countDocuments({
        ...filter,
        result: "CHECKED_IN",
      }),

    ]);

    const passIds = records.flatMap((record) =>
      record.qrPass ? [record.qrPass] : []
    );
    const passStates = await QRPass.find({ _id: { $in: passIds } })
      .select("_id entryCheckedInAt foodCollectedAt")
      .lean();
    const passStateMap = new Map(
      passStates.map((pass) => [pass._id.toString(), pass])
    );
    const recordsWithCounts = records.map((record) => {
      const pass = record.qrPass
        ? passStateMap.get(record.qrPass.toString())
        : null;
      return {
        ...record,
        entryCount: pass?.entryCheckedInAt ? 1 : 0,
        foodCount: pass?.foodCollectedAt ? 1 : 0,
      };
    });

    // 8. Calculate the stats object
    const stats = {
      total,
      successful,
      failed: total - successful,
    };

    return NextResponse.json(
      {
        success: true,
        data: {
          records: recordsWithCounts,
          stats,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNextPage: page * limit < total,
            hasPreviousPage: page > 1,
          },
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    if (isNextPrerenderInterruption(error)) throw error;
    console.error("Entry scanner records API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to retrieve Entry Scanner records.",
      },
      { status: 500 }
    );
  }
}
