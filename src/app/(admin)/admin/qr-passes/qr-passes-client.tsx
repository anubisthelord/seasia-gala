"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Search,
  QrCode,
  Download,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  UserRound,
  Loader2,
  ShieldCheck,
} from "lucide-react";

// 👇 Import the reusable molecule
import { StatCard } from "@/components/molecules/StatCard";
import { withBasePath } from "@/config/base-path";

type Attendee = {
  attendeeId: string;
  attendeeName: string;
  attendeeType: "EMPLOYEE" | "PARTNER";
  employee: {
    fullName: string;
    officialEmail: string;
    employeeId: string;
  } | null;
  registrationId: string | null;
  registrationStatus: string;
  attendanceType: string | null;
  partnerDocumentStatus: string | null;
  eligible: boolean;
  qrPassStatus: "ACTIVE" | "REVOKED" | "NOT_ISSUED";
  issuedAt: string | null;
};

type Statistics = {
  totalAttendees: number;
  eligibleAttendees: number;
  notEligibleAttendees: number;
  employeeAttendees: number;
  partnerAttendees: number;
  issuedPasses: number;
  revokedPasses: number;
  notIssuedPasses: number;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type PassModalData = {
  attendeeName: string;
  attendeeType: string;
  qrImage: string;
  issuedAt: string;
};

const initialStatistics: Statistics = {
  totalAttendees: 0,
  eligibleAttendees: 0,
  notEligibleAttendees: 0,
  employeeAttendees: 0,
  partnerAttendees: 0,
  issuedPasses: 0,
  revokedPasses: 0,
  notIssuedPasses: 0,
};

const registrationStatusStyles: Record<string, string> = {
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  PENDING_ADMIN_APPROVAL: "bg-amber-50 text-amber-700 ring-amber-600/20",
  REJECTED: "bg-red-50 text-red-700 ring-red-600/20",
  CORRECTION_REQUESTED: "bg-orange-50 text-orange-700 ring-orange-600/20",
  CANCELLED: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

export default function QrPassesClient() {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [statistics, setStatistics] = useState<Statistics>(initialStatistics);

  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const [search, setSearch] = useState("");
  const [registrationStatus, setRegistrationStatus] = useState("ALL");
  const [passStatus, setPassStatus] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [passModal, setPassModal] = useState<PassModalData | null>(null);

  const fetchAttendees = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        search,
        registrationStatus,
        passStatus,
        page: String(pagination.page),
        limit: String(pagination.limit),
      });

      const response = await fetch(
        withBasePath(`/api/admin/qr-passes?${params.toString()}`),
        { cache: "no-store" }
      );

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(
          `Server error (${response.status}). The API route crashed. Check the terminal.`
        );
      }

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to load QR passes");
      }

      setAttendees(result.data);
      setStatistics(result.statistics);
      setPagination((previous) => ({ ...previous, ...result.pagination }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [
    search,
    registrationStatus,
    passStatus,
    pagination.page,
    pagination.limit,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAttendees();
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    search,
    registrationStatus,
    passStatus,
    pagination.page,
    pagination.limit,
  ]);

  const handlePassAction = async (attendee: Attendee) => {
    if (!attendee.eligible) return;

    setProcessingId(attendee.attendeeId);
    setError("");

    try {
      const response = await fetch(withBasePath("/api/admin/qr-passes/issue"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendeeId: attendee.attendeeId }),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Server error (${response.status}).`);
      }

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to generate QR pass");
      }

      const qrImage = result.data.qrImage;
      if (typeof qrImage !== "string" || !qrImage.startsWith("data:image/png;base64,")) {
        throw new Error("The QR pass was created, but its image could not be loaded. Please try View QR again.");
      }

      setPassModal({
        attendeeName: result.data.attendeeName,
        attendeeType: result.data.attendeeType,
        qrImage,
        issuedAt: result.data.issuedAt,
      });

      void fetchAttendees();
    } catch (err) {
      setError(err instanceof Error ? err.message : "QR generation failed");
    } finally {
      setProcessingId(null);
    }
  };

  const downloadQr = () => {
    if (!passModal) return;

    const link = document.createElement("a");
    link.href = passModal.qrImage;
    link.download = `${passModal.attendeeName
      .trim()
      .replace(/[^a-z0-9]+/gi, "-")
      .toLowerCase()}-qr-pass.png`;

    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const resetFilters = () => {
    setSearch("");
    setRegistrationStatus("ALL");
    setPassStatus("ALL");
    setPagination((previous) => ({ ...previous, page: 1 }));
  };

  const changePage = (page: number) => {
    setPagination((previous) => ({ ...previous, page }));
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const getPassStatus = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return {
          label: "Active",
          className: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
          icon: CheckCircle2,
        };
      case "REVOKED":
        return {
          label: "Revoked",
          className: "bg-red-50 text-red-700 ring-red-600/20",
          icon: XCircle,
        };
      default:
        return {
          label: "Not issued",
          className: "bg-slate-100 text-slate-600 ring-slate-500/20",
          icon: Clock,
        };
    }
  };

  const getRegistrationStatus = (status: string) => {
    return registrationStatusStyles[status] || "bg-slate-100 text-slate-600 ring-slate-500/20";
  };

  const getActionLabel = (eligible: boolean, status: string) => {
    if (!eligible) return "Not Eligible";
    if (status === "ACTIVE") return "View QR";
    if (status === "REVOKED") return "Reissue QR";
    return "Issue QR";
  };

  return (
    <div className="space-y-4">
      {/* Statistics */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Attendees"
          value={statistics.totalAttendees}
          icon={Users}
          iconClass="bg-slate-100 text-slate-600"
        />
        <StatCard
          label="Eligible Attendees"
          value={statistics.eligibleAttendees}
          icon={ShieldCheck}
          iconClass="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          label="Issued Passes"
          value={statistics.issuedPasses}
          icon={QrCode}
          iconClass="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Not Issued"
          value={statistics.notIssuedPasses}
          icon={Clock}
          iconClass="bg-amber-50 text-amber-600"
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
                Attendee Passes
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                QR eligibility and issuance status
              </p>
            </div>
            <span className="text-xs text-slate-500">
              {pagination.total}{" "}
              {pagination.total === 1 ? "record" : "records"}
            </span>
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
                  setPagination((previous) => ({ ...previous, page: 1 }));
                }}
                placeholder="Search attendee, employee ID or email..."
                className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <select
              value={registrationStatus}
              onChange={(event) => {
                setRegistrationStatus(event.target.value);
                setPagination((previous) => ({ ...previous, page: 1 }));
              }}
              className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            >
              <option value="ALL">All registration statuses</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING_ADMIN_APPROVAL">Pending approval</option>
              <option value="REJECTED">Rejected</option>
              <option value="CORRECTION_REQUESTED">Correction requested</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            <select
              value={passStatus}
              onChange={(event) => {
                setPassStatus(event.target.value);
                setPagination((previous) => ({ ...previous, page: 1 }));
              }}
              className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            >
              <option value="ALL">All QR pass statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="REVOKED">Revoked</option>
              <option value="NOT_ISSUED">Not issued</option>
            </select>

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
          <table className="w-full min-w-[1050px] text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Attendee
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Employee
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Registration
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Eligibility
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  QR Pass
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Issued Date
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <Loader2
                      size={22}
                      className="mx-auto animate-spin text-slate-400"
                    />
                    <p className="mt-2 text-sm text-slate-500">
                      Loading attendee passes...
                    </p>
                  </td>
                </tr>
              ) : attendees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <QrCode size={26} className="mx-auto text-slate-300" />
                    <p className="mt-2 text-sm font-medium text-slate-700">
                      No attendee records found
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Try changing your search or filters.
                    </p>
                  </td>
                </tr>
              ) : (
                attendees.map((attendee) => {
                  const passStatus = getPassStatus(attendee.qrPassStatus);
                  const StatusIcon = passStatus.icon;
                  const isProcessing = processingId === attendee.attendeeId;

                  return (
                    <tr
                      key={attendee.attendeeId}
                      className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50/60"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-600">
                            {attendee.attendeeType === "EMPLOYEE" ? (
                              <UserRound size={14} />
                            ) : (
                              <Users size={14} />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {attendee.attendeeName}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {attendee.attendeeType === "EMPLOYEE"
                                ? "Employee"
                                : "Partner"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {attendee.employee ? (
                          <>
                            <p className="text-sm font-medium text-slate-800">
                              {attendee.employee.fullName}
                            </p>
                            <p className="mt-0.5 font-mono text-xs text-slate-500">
                              {attendee.employee.employeeId}
                            </p>
                          </>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${getRegistrationStatus(
                            attendee.registrationStatus
                          )}`}
                        >
                          {attendee.registrationStatus.replaceAll("_", " ")}
                        </span>

                        {attendee.attendeeType === "PARTNER" && (
                          <p className="mt-1 text-xs text-slate-500">
                            Doc:{" "}
                            <span className="font-medium text-slate-700">
                              {attendee.partnerDocumentStatus || "Missing"}
                            </span>
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {attendee.eligible ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                            <CheckCircle2 size={13} />
                            Eligible
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                            <Clock size={13} />
                            Not eligible
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${passStatus.className}`}
                        >
                          <StatusIcon size={12} />
                          {passStatus.label}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                        {formatDate(attendee.issuedAt)}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <button
                            onClick={() => handlePassAction(attendee)}
                            disabled={!attendee.eligible || isProcessing}
                            className="inline-flex h-8 items-center justify-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {isProcessing ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : !attendee.eligible ? (
                              <XCircle size={13} />
                            ) : (
                              <QrCode size={13} />
                            )}
                            {isProcessing
                              ? "Processing..."
                              : getActionLabel(
                                  attendee.eligible,
                                  attendee.qrPassStatus
                                )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Showing{" "}
            <span className="font-medium text-slate-700">
              {pagination.total === 0
                ? 0
                : (pagination.page - 1) * pagination.limit + 1}
            </span>{" "}
            to{" "}
            <span className="font-medium text-slate-700">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span>{" "}
            of{" "}
            <span className="font-medium text-slate-700">
              {pagination.total}
            </span>{" "}
            records
          </p>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => changePage(pagination.page - 1)}
              disabled={!pagination.hasPreviousPage || loading}
              className="h-8 rounded border border-slate-200 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <span className="px-2 text-xs text-slate-500">
              Page {pagination.page} of {Math.max(1, pagination.totalPages)}
            </span>

            <button
              onClick={() => changePage(pagination.page + 1)}
              disabled={!pagination.hasNextPage || loading}
              className="h-8 rounded border border-slate-200 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* QR Pass Modal */}
      {passModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPassModal(null)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-md bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  QR Pass Generated
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Attendee access pass
                </p>
              </div>

              <button
                onClick={() => setPassModal(null)}
                className="rounded p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close QR pass"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 text-center">
              <div className="mx-auto mb-3 flex h-56 w-56 items-center justify-center rounded border border-slate-100 bg-white p-2">
                <img
                  src={passModal.qrImage}
                  alt="Attendee QR pass"
                  className="h-full w-full object-contain"
                />
              </div>

              <h3 className="text-base font-semibold text-slate-900">
                {passModal.attendeeName}
              </h3>

              <p className="mt-0.5 text-xs text-slate-500">
                {passModal.attendeeType === "EMPLOYEE"
                  ? "Employee Pass"
                  : "Partner Pass"}
              </p>

              <div className="mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-left">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Issued on
                </p>
                <p className="mt-0.5 text-sm font-medium text-slate-800">
                  {formatDate(passModal.issuedAt)}
                </p>
              </div>

              <button
                onClick={downloadQr}
                className="mt-4 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded bg-slate-900 px-3 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <Download size={14} />
                Download QR Pass
              </button>

              <p className="mt-2.5 text-[11px] text-slate-400">
                Keep this QR code private. It is required for event entry and
                food collection.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
