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
  "COLLECTED",
  "ENTRY_REQUIRED",
  "INVALID_QR",
  "REVOKED",
  "NOT_APPROVED",
  "PARTNER_NOT_APPROVED",
  "SCAN_CONFLICT",
  "ATTENDEE_NOT_FOUND",
];

// Canonical regex escaping
function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Strict YYYY-MM-DD date validation with UTC consistency
function parseDate(value: string, endOfDay = false): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  if (endOfDay) {
    date.setUTCHours(23, 59, 59, 999);
  }

  return date;
}

// Shared no-cache JSON response helper
function jsonResponse(
  body: Record<string, unknown>,
  status: number
): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: NextRequest) {
  await connection();

  try {

    const admin = await getCurrentAdmin(request);

    if (!admin) {
      return jsonResponse(
        { success: false, message: "Unauthorized access." },
        401
      );
    }

    if (
      admin.role !== "SUPER_ADMIN" &&
      admin.role !== "REGISTRATION_ADMIN"
    ) {
      return jsonResponse(
        {
          success: false,
          message: "You cannot access Food Scanner records.",
        },
        403
      );
    }

    await connectDB();

    const { searchParams } = new URL(request.url);

    // Pagination
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

    // Build filters
    const filter: Record<string, unknown> = {
      scannerType: "FOOD",
      result: { $ne: "ALREADY_COLLECTED" },
    };

    // Result filter
    const result = searchParams.get("result");

    if (result && result !== "ALL") {
      if (!ALLOWED_RESULTS.includes(result as ScannerResult)) {
        return jsonResponse(
          { success: false, message: "Invalid result filter." },
          400
        );
      }

      filter.result = result as ScannerResult;
    }

    // Date filters
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (from || to) {
      const dateFilter: { $gte?: Date; $lte?: Date } = {};

      if (from) {
        const fromDate = parseDate(from);

        if (!fromDate) {
          return jsonResponse(
            { success: false, message: "Invalid start date." },
            400
          );
        }

        dateFilter.$gte = fromDate;
      }

      if (to) {
        const toDate = parseDate(to, true);

        if (!toDate) {
          return jsonResponse(
            { success: false, message: "Invalid end date." },
            400
          );
        }

        dateFilter.$lte = toDate;
      }

      if (
        dateFilter.$gte &&
        dateFilter.$lte &&
        dateFilter.$gte > dateFilter.$lte
      ) {
        return jsonResponse(
          {
            success: false,
            message: "Start date cannot be after end date.",
          },
          400
        );
      }

      filter.scannedAt = dateFilter;
    }

    // Search by attendee name or employee ID
    const search = searchParams.get("search")?.trim();

    // Limit search input length
    if (search && search.length > 100) {
      return jsonResponse(
        { success: false, message: "Search query is too long." },
        400
      );
    }

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
        return jsonResponse(
          {
            success: false,
            message:
              "Too many records to export at once. Narrow your filters and try again.",
          },
          413
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
        "food-scanner-records.csv"
      );
    }

    // Fetch records + stats in parallel
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
        result: "COLLECTED",
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

    const stats = {
      total,
      successful,
      failed: total - successful,
    };

    return jsonResponse(
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
      200
    );
  } catch (error) {
    if (isNextPrerenderInterruption(error)) throw error;
    console.error("Food scanner records API error:", error);

    return jsonResponse(
      {
        success: false,
        message: "Unable to fetch Food Scanner records.",
      },
      500
    );
  }
}
