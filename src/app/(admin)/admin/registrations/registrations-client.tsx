"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Users,
  Clock3,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  UserRound,
  CalendarDays,
  Eye,
  Send,
  Trash2,
} from "lucide-react";

// 👇 Import the reusable molecule
import { StatCard } from "@/components/molecules/StatCard";
import { withBasePath } from "@/config/base-path";

type RegistrationStatus =
  | "PENDING_ADMIN_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "CORRECTION_REQUESTED"
  | "CANCELLED";

interface Employee {
  fullName: string;
  officialEmail: string;
  phoneNumber: string;
  employeeId: string;
}

interface Attendee {
  _id: string;
  attendeeType: "EMPLOYEE" | "PARTNER";
  fullName: string;
}

interface Registration {
  _id: string;
  employee: Employee;
  attendanceType: "SINGLE" | "COUPLE";
  status: RegistrationStatus;
  submittedAt: string;
  attendees: Attendee[];
}

interface Statistics {
  totalRegistrations: number;
  pendingRegistrations: number;
  approvedRegistrations: number;
  rejectedRegistrations: number;
  correctionRegistrations: number;
  totalCouples: number;
  totalSingles: number;
}

const emptyStatistics: Statistics = {
  totalRegistrations: 0,
  pendingRegistrations: 0,
  approvedRegistrations: 0,
  rejectedRegistrations: 0,
  correctionRegistrations: 0,
  totalCouples: 0,
  totalSingles: 0,
};

const statusLabels: Record<RegistrationStatus, string> = {
  PENDING_ADMIN_APPROVAL: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CORRECTION_REQUESTED: "Correction Requested",
  CANCELLED: "Cancelled",
};

const statusStyles: Record<RegistrationStatus, string> = {
  PENDING_ADMIN_APPROVAL: "bg-rose-50 text-rose-700 ring-rose-600/20",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  REJECTED: "bg-red-50 text-red-700 ring-red-600/20",
  CORRECTION_REQUESTED: "bg-orange-50 text-orange-700 ring-orange-600/20",
  CANCELLED: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

function formatDate(date: string) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function RegistrationsClient() {
  const router = useRouter();

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [statistics, setStatistics] = useState<Statistics>(emptyStatistics);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [attendanceType, setAttendanceType] = useState("ALL");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [processingRegistrationId, setProcessingRegistrationId] = useState<string | null>(null);

  const fetchRegistrations = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          search,
          status: status === "ALL" ? "" : status,
          attendanceType: attendanceType === "ALL" ? "" : attendanceType,
          page: String(page),
          limit: "10",
        });

        const response = await fetch(
          withBasePath(`/api/admin/registrations?${params.toString()}`),
          { method: "GET", cache: "no-store", signal }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Unable to load registrations.");
        }

        setRegistrations(result.data);
        setStatistics(result.statistics);
        setTotal(result.pagination.total);
        setTotalPages(Math.max(1, result.pagination.totalPages));
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [search, status, attendanceType, page]
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchRegistrations(controller.signal);
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [fetchRegistrations]);

  function handleStatusChange(value: string) {
    setStatus(value);
    setPage(1);
  }

  function handleAttendanceChange(value: string) {
    setAttendanceType(value);
    setPage(1);
  }

  async function handleResendQr(registration: Registration) {
    setProcessingRegistrationId(registration._id);
    setActionMessage("");
    setError("");
    try {
      const response = await fetch(withBasePath(`/api/admin/registrations/${registration._id}/resend-passes`), { method: "POST" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Unable to resend the QR code.");
      setActionMessage(result.message || `QR code sent to ${registration.employee.officialEmail}.`);
      await fetchRegistrations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to resend the QR code.");
    } finally {
      setProcessingRegistrationId(null);
    }
  }

  async function handleDeleteRegistration(registration: Registration) {
    const confirmed = window.confirm(
      `Delete ${registration.employee?.fullName || "this employee"}'s registration and all related attendee records, QR passes, scan history, partner documents, and employee profile? This cannot be undone.`
    );
    if (!confirmed) return;

    setProcessingRegistrationId(registration._id);
    setActionMessage("");
    setError("");
    try {
      const response = await fetch(withBasePath(`/api/admin/registrations/${registration._id}`), { method: "DELETE" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Unable to delete the registration.");
      setActionMessage("Registration and related records deleted.");
      if (registrations.length === 1 && page > 1) setPage((current) => current - 1);
      else await fetchRegistrations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete the registration.");
    } finally {
      setProcessingRegistrationId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Statistics */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Registrations"
          value={statistics.totalRegistrations}
          icon={Users}
          iconClass="bg-slate-100 text-slate-600"
        />
        <StatCard
          label="Pending Approval"
          value={statistics.pendingRegistrations}
          icon={Clock3}
          iconClass="bg-amber-50 text-amber-600"
        />
        <StatCard
          label="Approved"
          value={statistics.approvedRegistrations}
          icon={CheckCircle2}
          iconClass="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          label="Rejected"
          value={statistics.rejectedRegistrations}
          icon={XCircle}
          iconClass="bg-red-50 text-red-600"
        />
      </div>

      {/* Attendance summary */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border border-slate-200 bg-white px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Attendance breakdown
        </p>

        <div className="flex items-center gap-1.5 text-sm text-slate-600">
          <UserRound size={14} className="text-slate-400" />
          Singles:
          <span className="font-semibold text-slate-900">
            {statistics.totalSingles}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-sm text-slate-600">
          <Users size={14} className="text-slate-400" />
          Couples:
          <span className="font-semibold text-slate-900">
            {statistics.totalCouples}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-sm text-slate-600">
          <RefreshCw size={14} className="text-slate-400" />
          Correction Requested:
          <span className="font-semibold text-slate-900">
            {statistics.correctionRegistrations}
          </span>
        </div>
      </div>

      {/* Listing */}
      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        {/* Header + Filters */}
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              All Registrations
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Search and filter submitted registrations.
            </p>
          </div>

          <div className="flex flex-col gap-2 lg:flex-row">
            <div className="relative flex-1">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search name, email or employee ID..."
                className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <select
              value={status}
              onChange={(event) => handleStatusChange(event.target.value)}
              className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            >
              <option value="ALL">All statuses</option>
              <option value="PENDING_ADMIN_APPROVAL">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CORRECTION_REQUESTED">Correction Requested</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            <select
              value={attendanceType}
              onChange={(event) => handleAttendanceChange(event.target.value)}
              className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            >
              <option value="ALL">All attendance</option>
              <option value="SINGLE">Single</option>
              <option value="COUPLE">Couple</option>
            </select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 my-3 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}
        {actionMessage && !error && (
          <div role="status" className="mx-4 my-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
            {actionMessage}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Employee
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Employee ID
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Type
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Attendees
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Submitted
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Status
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <LoaderCircle
                      size={22}
                      className="mx-auto animate-spin text-slate-400"
                    />
                    <p className="mt-2 text-sm text-slate-500">
                      Loading registrations...
                    </p>
                  </td>
                </tr>
              ) : registrations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <Users size={26} className="mx-auto text-slate-300" />
                    <p className="mt-2 text-sm font-medium text-slate-700">
                      No registrations found
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Try changing your search or filters.
                    </p>
                  </td>
                </tr>
              ) : (
                registrations.map((registration) => (
                  <tr
                    key={registration._id}
                    onClick={() =>
                      router.push(`/admin/registrations/${registration._id}`)
                    }
                    className="cursor-pointer border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/registrations/${registration._id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm font-medium text-slate-900 hover:text-blue-600 hover:underline"
                      >
                        {registration.employee?.fullName || "Unknown"}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {registration.employee?.officialEmail || "—"}
                      </p>
                    </td>

                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-medium text-slate-700">
                        {registration.employee?.employeeId || "—"}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-medium ${
                          registration.attendanceType === "COUPLE"
                            ? "border-purple-200 bg-purple-50 text-purple-700"
                            : "border-slate-200 bg-slate-50 text-slate-600"
                        }`}
                      >
                        {registration.attendanceType}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      {registration.attendanceType === "COUPLE" ? (
                        <div className="space-y-0.5 text-xs text-slate-600">
                          <p>Employee: {registration.employee?.fullName || "—"}</p>
                          <p>Partner: {registration.attendees?.find((a) => a.attendeeType === "PARTNER")?.fullName || "—"}</p>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <CalendarDays size={13} className="text-slate-400" />
                        {formatDate(registration.submittedAt)}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                          statusStyles[registration.status]
                        }`}
                      >
                  {(statusLabels[registration.status] || "Pending")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
                        <Link
                          href={`/admin/registrations/${registration._id}`}
                          title="View registration"
                          aria-label={`View ${registration.employee?.fullName || "registration"}`}
                          className="inline-flex h-8 items-center gap-1 rounded border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <Eye size={14} /> View
                        </Link>
                        <button
                          type="button"
                          onClick={() => void handleResendQr(registration)}
                          disabled={registration.status !== "APPROVED" || processingRegistrationId === registration._id}
                          title={registration.status === "APPROVED" ? "Resend QR code" : "Only approved registrations have QR codes"}
                          className="inline-flex h-8 items-center gap-1 rounded border border-blue-200 bg-white px-2 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {processingRegistrationId === registration._id ? <LoaderCircle size={13} className="animate-spin" /> : <Send size={13} />}
                          Resend QR
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteRegistration(registration)}
                          disabled={processingRegistrationId === registration._id}
                          title="Delete registration and related records"
                          className="inline-flex h-8 items-center gap-1 rounded border border-red-200 bg-white px-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Showing{" "}
            <span className="font-medium text-slate-700">
              {total === 0 ? 0 : (page - 1) * 10 + 1}
            </span>{" "}
            to{" "}
            <span className="font-medium text-slate-700">
              {Math.min(page * 10, total)}
            </span>{" "}
            of <span className="font-medium text-slate-700">{total}</span>{" "}
            registrations
          </p>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((current) => current - 1)}
              disabled={page <= 1 || loading}
              className="flex h-8 items-center gap-1 rounded border border-slate-200 px-2.5 text-xs text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={14} />
              Previous
            </button>

            <span className="px-2 text-xs text-slate-500">
              Page {page} of {totalPages}
            </span>

            <button
              onClick={() => setPage((current) => current + 1)}
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
