"use client";

import { useCallback, useEffect, useState } from "react";
import { withBasePath } from "@/config/base-path";
import {
  RefreshCw,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type ScanRecord = {
  _id: string;
  result: string;
  attendeeName: string | null;
  employeeId: string | null;
  attendeeType: string | null;
  entryCount: number;
  foodCount: number;
  message: string;
  scannedAt: string;
  scannedBy?: {
    fullName: string;
    email: string;
  } | null;
};

type Stats = {
  total: number;
  successful: number;
  failed: number;
};

const initialStats: Stats = {
  total: 0,
  successful: 0,
  failed: 0,
};

export default function FoodRecordsClient() {
  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [stats, setStats] = useState<Stats>(initialStats);

  const [search, setSearch] = useState("");
  const [resultFilter, setResultFilter] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        result: resultFilter,
      });

      if (search.trim()) params.set("search", search.trim());
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const response = await fetch(
        withBasePath(`/api/admin/scanner/food-records?${params.toString()}`),
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load records.");
      }

      setRecords(data.data.records);
      setStats(data.data.stats);
      setTotalPages(Math.max(1, data.data.pagination.totalPages));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }, [page, resultFilter, search, from, to]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchRecords();
    }, 300);

    return () => clearTimeout(timer);
  }, [fetchRecords]);

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    setError("");

    try {
      const params = new URLSearchParams({
        export: "csv",
        result: resultFilter,
      });
      if (search.trim()) params.set("search", search.trim());
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const response = await fetch(
        withBasePath(`/api/admin/scanner/food-records?${params.toString()}`)
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || "Export failed.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "food-scanner-records.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to export."
      );
    } finally {
      setExporting(false);
    }
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Food Scanner Records
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            View and export all food collection scans.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchRecords}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            onClick={handleExport}
            disabled={exporting || stats.total === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {exporting ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Scans" value={stats.total} />
        <StatCard
          label="Successful"
          value={stats.successful}
          className="text-emerald-700"
        />
        <StatCard
          label="Failed"
          value={stats.failed}
          className="text-red-600"
        />
      </div>

      {/* Filters */}
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search name or ID..."
            className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-slate-400"
          />
        </div>

        <select
          value={resultFilter}
          onChange={(e) => {
            setResultFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
        >
          <option value="ALL">All results</option>
          <option value="COLLECTED">Collected</option>
          <option value="ENTRY_REQUIRED">Entry Required</option>
          <option value="INVALID_QR">Invalid QR</option>
          <option value="REVOKED">Revoked</option>
          <option value="NOT_APPROVED">Not Approved</option>
          <option value="PARTNER_NOT_APPROVED">Partner Not Approved</option>
        </select>

        <input
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
        />

        <input
          type="date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Attendee</th>
                <th className="px-4 py-3 font-medium">Employee ID</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Result</th>
                <th className="px-4 py-3 font-medium">Entry Count</th>
                <th className="px-4 py-3  font-medium">Food Count</th>
                <th className="px-4 py-3 font-medium">Scanned By</th>
                <th className="px-4 py-3 font-medium">Scanned At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    Loading records...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    No records found.
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {record.attendeeName || "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {record.employeeId || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {record.attendeeType || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${
                          record.result === "COLLECTED"
                            ? "bg-emerald-50 text-emerald-700"
                            : record.result === "ALREADY_COLLECTED"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-red-50 text-red-700"
                        }`}
                      >
                        {record.result.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700">
                      {record.entryCount}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700">
                      {record.foodCount}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {record.scannedBy?.fullName || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatDate(record.scannedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
          <p className="text-xs text-slate-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  className = "text-slate-900",
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${className}`}>
        {value.toLocaleString("en-IN")}
      </p>
    </div>
  );
}
