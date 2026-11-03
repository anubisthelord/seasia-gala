"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  RefreshCw,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  ScanLine,
  Users,
  UserRound,
} from "lucide-react";

// 👇 Import the reusable molecule
import { StatCard } from "@/components/molecules/StatCard";
import { withBasePath } from "@/config/base-path";

type ScannerType = "ENTRY" | "FOOD";

interface ScanRecord {
  _id: string;
  result: string;
  attendeeName: string | null;
  employeeId: string | null;
  attendeeType: "EMPLOYEE" | "PARTNER" | null;
  entryCount: number;
  foodCount: number;
  message: string;
  scannedAt: string;
  scannedBy?: {
    fullName?: string;
    email?: string;
  } | null;
}

interface ScannerStats {
  total: number;
  successful: number;
  failed: number;
}

interface ScannerRecordsPageProps {
  scannerType: ScannerType;
}

const RESULT_OPTIONS: Record<ScannerType, string[]> = {
  ENTRY: [
    "CHECKED_IN",
    "INVALID_QR",
    "REVOKED",
    "NOT_APPROVED",
    "PARTNER_NOT_APPROVED",
    "SCAN_CONFLICT",
    "ATTENDEE_NOT_FOUND",
  ],
  FOOD: [
    "COLLECTED",
    "ENTRY_REQUIRED",
    "INVALID_QR",
    "REVOKED",
    "NOT_APPROVED",
    "PARTNER_NOT_APPROVED",
    "SCAN_CONFLICT",
    "ATTENDEE_NOT_FOUND",
  ],
};

const SUCCESS_RESULTS = ["CHECKED_IN", "COLLECTED"];

function formatResult(result: string) {
  return result.replaceAll("_", " ");
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getDateTimeBoundary(value: string, endOfDay = false) {
  if (!value) return "";

  const date = new Date(
    `${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`
  );

  return date.toISOString();
}

function getResultStyle(result: string) {
  if (SUCCESS_RESULTS.includes(result)) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
  }
  if (result.startsWith("ALREADY_")) {
    return "bg-amber-50 text-amber-700 ring-amber-600/20";
  }
  return "bg-red-50 text-red-700 ring-red-600/20";
}

export default function ScannerRecordsPage({
  scannerType,
}: ScannerRecordsPageProps) {
  const endpoint =
    scannerType === "ENTRY"
      ? withBasePath("/api/admin/scanner/entry-records")
      : withBasePath("/api/admin/scanner/food-records");

  const successLabel =
    scannerType === "ENTRY" ? "Checked In" : "Food Collected";

  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [stats, setStats] = useState<ScannerStats>({
    total: 0,
    successful: 0,
    failed: 0,
  });

  const [search, setSearch] = useState("");
  const [resultFilter, setResultFilter] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [exporting, setExporting] = useState(false);

  const activeRequestRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const inFlightRef = useRef(false);

  const fetchRecords = useCallback(
    async (silent = false) => {
      if (inFlightRef.current) return;

      const controller = new AbortController();
      activeRequestRef.current = controller;

      const requestId = ++requestIdRef.current;
      inFlightRef.current = true;

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: "20",
          result: resultFilter,
        });

        if (search.trim()) {
          params.set("search", search.trim());
        }

        if (from) {
          params.set("from", getDateTimeBoundary(from));
        }

        if (to) {
          params.set("to", getDateTimeBoundary(to, true));
        }

        const response = await fetch(`${endpoint}?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Unable to load scanner records.");
        }

        if (requestId !== requestIdRef.current) return;

        const pagination = data.data.pagination;

        setRecords(data.data.records || []);
        setTotal(pagination.total || 0);
        setTotalPages(pagination.totalPages || 0);
        setStats(data.data.stats);

        if (pagination.totalPages > 0 && page > pagination.totalPages) {
          setPage(pagination.totalPages);
        }

        if (pagination.totalPages === 0 && page !== 1) {
          setPage(1);
        }

        setError("");
        setLastUpdated(new Date());
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        if (requestId === requestIdRef.current) {
          setError(
            err instanceof Error
              ? err.message
              : "Something went wrong while loading records."
          );
        }
      } finally {
        if (requestId === requestIdRef.current) {
          inFlightRef.current = false;
          activeRequestRef.current = null;
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [endpoint, page, resultFilter, search, from, to]
  );

  useEffect(() => {
    void fetchRecords();

    const interval = window.setInterval(() => {
      void fetchRecords(true);
    }, 5000);

    return () => {
      window.clearInterval(interval);

      requestIdRef.current += 1;
      activeRequestRef.current?.abort();
      activeRequestRef.current = null;
      inFlightRef.current = false;
    };
  }, [fetchRecords]);

  async function exportCSV() {
    if (!total || exporting) return;

    setExporting(true);
    setError("");

    try {
      const params = new URLSearchParams({
        export: "csv",
        result: resultFilter,
      });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (from) {
        params.set("from", getDateTimeBoundary(from));
      }

      if (to) {
        params.set("to", getDateTimeBoundary(to, true));
      }

      const response = await fetch(`${endpoint}?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || "Unable to export scanner records.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download =
        scannerType === "ENTRY"
          ? "entry-scanner-records.csv"
          : "food-scanner-records.csv";

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to export scanner records."
      );
    } finally {
      setExporting(false);
    }
  }

  function resetFilters() {
    setSearch("");
    setResultFilter("ALL");
    setFrom("");
    setTo("");
    setPage(1);
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Total Attempts"
          value={stats.total}
          icon={ScanLine}
          iconClass="bg-slate-100 text-slate-600"
        />
        <StatCard
          label={successLabel}
          value={stats.successful}
          icon={RefreshCw}
          iconClass="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          label="Failed Scans"
          value={stats.failed}
          icon={UserRound}
          iconClass="bg-red-50 text-red-600"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Listing */}
      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        {/* Header + Filters */}
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Scan history
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {total.toLocaleString("en-IN")} total records ·{" "}
                {records.length} shown
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => void fetchRecords(true)}
                disabled={refreshing}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw
                  size={14}
                  className={refreshing ? "animate-spin" : ""}
                />
                Refresh
              </button>

              <button
                onClick={() => void exportCSV()}
                disabled={!total || exporting}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-slate-900 px-3 text-xs font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {exporting ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                {exporting ? "Exporting..." : "Export CSV"}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2 lg:flex-row">
            <div className="relative flex-1">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search name or employee ID"
                className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <select
              value={resultFilter}
              onChange={(event) => {
                setResultFilter(event.target.value);
                setPage(1);
              }}
              className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            >
              <option value="ALL">All results</option>
              {RESULT_OPTIONS[scannerType].map((result) => (
                <option key={result} value={result}>
                  {formatResult(result)}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
              aria-label="Start date"
              className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />

            <input
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
              aria-label="End date"
              className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />

            <button
              onClick={resetFilters}
              className="h-9 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Clear filters
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Attendee
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Employee ID
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Type
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Result
                </th>
                {scannerType === "ENTRY" ? (
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Entry Count
                  </th>
                ) : (
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Food Count
                  </th>
                )}
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Scanned By
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Scanned At
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <RefreshCw
                      size={22}
                      className="mx-auto animate-spin text-slate-400"
                    />
                    <p className="mt-2 text-sm text-slate-500">
                      Loading scan records...
                    </p>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <ScanLine size={26} className="mx-auto text-slate-300" />
                    <p className="mt-2 text-sm font-medium text-slate-700">
                      No scanner records found
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Scans will appear here as they happen.
                    </p>
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr
                    key={record._id}
                    className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-600">
                          {record.attendeeType === "EMPLOYEE" ? (
                            <UserRound size={14} />
                          ) : (
                            <Users size={14} />
                          )}
                        </div>
                        <p className="text-sm font-medium text-slate-900">
                          {record.attendeeName || "Unknown attendee"}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-600">
                        {record.employeeId || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {record.attendeeType ? (
                        <span
                          className={`inline-flex whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${record.attendeeType === "EMPLOYEE"
                              ? "bg-slate-50 text-slate-600 ring-slate-500/20"
                              : "bg-purple-50 text-purple-700 ring-purple-600/20"
                            }`}
                        >
                          {record.attendeeType}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${getResultStyle(
                          record.result
                        )}`}
                      >
                        {formatResult(record.result)}
                      </span>
                    </td>
                    {scannerType === "ENTRY" ? (
                      <td className="px-4 py-3 text-sm font-semibold text-slate-700">
                        {record.entryCount}
                      </td>
                    ) : (
                      <td className="px-4 py-3 text-sm font-semibold text-slate-700">
                        {record.foodCount}
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {record.scannedBy?.fullName || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                      {formatDate(record.scannedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5 rounded bg-emerald-50 px-2 py-1 text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Auto-refresh · 5s
            </span>
            {lastUpdated && (
              <span className="inline-flex items-center gap-1">
                <Clock size={12} />
                Updated {lastUpdated.toLocaleTimeString("en-IN")}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || loading}
              className="flex h-8 items-center gap-1 rounded border border-slate-200 px-2.5 text-xs text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={14} />
              Previous
            </button>

            <span className="px-2 text-xs text-slate-500">
              Page {page} of {Math.max(totalPages, 1)}
            </span>

            <button
              onClick={() =>
                setPage((current) =>
                  totalPages ? Math.min(totalPages, current + 1) : current
                )
              }
              disabled={page >= totalPages || loading}
              className="flex h-8 items-center gap-1 rounded border border-slate-200 px-2.5 text-xs text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
