"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  ShieldCheck,
  Clock3,
  XCircle,
  FileWarning,
  Eye,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  LoaderCircle,
} from "lucide-react";

// 👇 Import the reusable molecule
import { StatCard } from "@/components/molecules/StatCard";
import { withBasePath } from "@/config/base-path";

type VerificationStatus = "PENDING" | "APPROVED" | "REJECTED";

type PartnerRecord = {
  _id: string;
  partnerName: string;
  partnerTitle: string | null;
  registrationId: string;
  employee: {
    fullName: string;
    officialEmail: string;
    employeeId: string;
  } | null;
  registrationStatus: string;
  document: {
    documentType: string;
    verificationStatus: VerificationStatus;
    reviewedAt: string | null;
    rejectionReason: string | null;
    uploadedAt: string;
  } | null;
};

type Statistics = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  missingDocument: number;
};

const emptyStats: Statistics = {
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  missingDocument: 0,
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-700 ring-amber-600/20",
    APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    REJECTED: "bg-red-50 text-red-700 ring-red-600/20",
    MISSING: "bg-slate-100 text-slate-600 ring-slate-500/20",
  };

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
        styles[status] || styles.MISSING
      }`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

export default function PartnerVerificationClient() {
  const [records, setRecords] = useState<PartnerRecord[]>([]);
  const [statistics, setStatistics] = useState<Statistics>(emptyStats);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedDocument, setSelectedDocument] = useState<{
    attendeeId: string;
    partnerName: string;
    documentType: string;
  } | null>(null);

  const [reviewTarget, setReviewTarget] = useState<{
    registrationId: string;
    attendeeId: string;
    partnerName: string;
    action: "APPROVE_PARTNER_DOCUMENT" | "REJECT_PARTNER_DOCUMENT";
  } | null>(null);

  const [reviewReason, setReviewReason] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");

  const fetchRecords = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        search,
        status,
        page: String(page),
        limit: "10",
      });

      const response = await fetch(
        withBasePath(`/api/admin/partner-verification?${params}`),
        { credentials: "same-origin", signal }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to load records.");
      }

      setRecords(result.data);
      setStatistics(result.statistics);
      setTotal(result.pagination.total);
      setTotalPages(Math.max(1, result.pagination.totalPages));
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [search, status, page]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      fetchRecords(controller.signal);
    }, 300);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [fetchRecords]);

  function changeFilter(value: string) {
    setStatus(value);
    setPage(1);
  }

  async function handlePartnerReview() {
    if (!reviewTarget || reviewSubmitting) return;

    if (
      reviewTarget.action === "REJECT_PARTNER_DOCUMENT" &&
      !reviewReason.trim()
    ) {
      setReviewError("Please provide a rejection reason.");
      return;
    }

    try {
      setReviewSubmitting(true);
      setReviewError("");

      const response = await fetch(
        withBasePath(`/api/admin/registrations/${reviewTarget.registrationId}/review`),
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: reviewTarget.action,
            reason: reviewReason.trim(),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to update verification.");
      }

      setReviewTarget(null);
      setReviewReason("");
      await fetchRecords();
    } catch (error) {
      setReviewError(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setReviewSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Statistics */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Total Partners"
          value={statistics.total}
          icon={ShieldCheck}
          iconClass="bg-slate-100 text-slate-600"
        />
        <StatCard
          label="Pending Review"
          value={statistics.pending}
          icon={Clock3}
          iconClass="bg-amber-50 text-amber-600"
        />
        <StatCard
          label="Approved"
          value={statistics.approved}
          icon={CheckCircle2}
          iconClass="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          label="Rejected"
          value={statistics.rejected}
          icon={XCircle}
          iconClass="bg-red-50 text-red-600"
        />
        <StatCard
          label="Missing Documents"
          value={statistics.missingDocument}
          icon={FileWarning}
          iconClass="bg-slate-100 text-slate-500"
        />
      </div>

      {/* Listing */}
      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        {/* Header + Filters */}
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Partner Records
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Review and verify partner identity documents.
              </p>
            </div>
            <span className="text-xs text-slate-500">
              {total} {total === 1 ? "record" : "records"}
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
                  setPage(1);
                }}
                placeholder="Search partner, employee or employee ID..."
                className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <select
              value={status}
              onChange={(event) => changeFilter(event.target.value)}
              className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            >
              <option value="ALL">All documents</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 my-3 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Partner
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Employee
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Document
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Verification
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Uploaded
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <LoaderCircle
                      size={22}
                      className="mx-auto animate-spin text-slate-400"
                    />
                    <p className="mt-2 text-sm text-slate-500">
                      Loading partner records...
                    </p>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <FileWarning size={26} className="mx-auto text-slate-300" />
                    <p className="mt-2 text-sm font-medium text-slate-700">
                      No partner records found
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Partner registrations will appear here.
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
                      <p className="text-sm font-medium text-slate-900">
                        {record.partnerName}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {record.partnerTitle || "Partner"}
                      </p>
                    </td>

                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-800">
                        {record.employee?.fullName || "Unknown"}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-slate-500">
                        {record.employee?.employeeId || "—"}
                      </p>
                    </td>

                    <td className="px-4 py-3">
                      {record.document ? (
                        <span className="text-sm text-slate-700">
                          Identity Image
                        </span>
                      ) : (
                        <StatusBadge status="MISSING" />
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <StatusBadge
                        status={record.document?.verificationStatus || "MISSING"}
                      />
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                      {record.document
                        ? formatDate(record.document.uploadedAt)
                        : "—"}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {record.document && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedDocument({
                                  attendeeId: record._id,
                                  partnerName: record.partnerName,
                                  documentType: record.document!.documentType,
                                })
                              }
                              className="inline-flex h-8 items-center gap-1 rounded border border-slate-200 px-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                              <Eye size={13} />
                              View
                            </button>

                            {record.document.verificationStatus ===
                              "PENDING" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReviewError("");
                                    setReviewReason("");
                                    setReviewTarget({
                                      registrationId: record.registrationId,
                                      attendeeId: record._id,
                                      partnerName: record.partnerName,
                                      action: "APPROVE_PARTNER_DOCUMENT",
                                    });
                                  }}
                                  className="inline-flex h-8 items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
                                >
                                  <CheckCircle2 size={13} />
                                  Approve
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setReviewError("");
                                    setReviewReason("");
                                    setReviewTarget({
                                      registrationId: record.registrationId,
                                      attendeeId: record._id,
                                      partnerName: record.partnerName,
                                      action: "REJECT_PARTNER_DOCUMENT",
                                    });
                                  }}
                                  className="inline-flex h-8 items-center gap-1 rounded border border-red-200 bg-red-50 px-2.5 text-xs font-medium text-red-700 transition hover:bg-red-100"
                                >
                                  <XCircle size={13} />
                                  Reject
                                </button>
                              </>
                            )}
                          </>
                        )}

                        <Link
                          href={`/admin/registrations/${record.registrationId}`}
                          className="inline-flex h-8 items-center rounded border border-slate-200 px-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          Details
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && !error && total > 0 && (
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
              records
            </p>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="flex h-8 items-center gap-1 rounded border border-slate-200 px-2.5 text-xs text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={14} />
                Previous
              </button>

              <span className="px-2 text-xs text-slate-500">
                Page {page} of {totalPages}
              </span>

              <button
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                disabled={page >= totalPages}
                className="flex h-8 items-center gap-1 rounded border border-slate-200 px-2.5 text-xs text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Document preview modal */}
      {selectedDocument && (
        <DocumentPreview
          attendeeId={selectedDocument.attendeeId}
          partnerName={selectedDocument.partnerName}
          documentType={selectedDocument.documentType}
          onClose={() => setSelectedDocument(null)}
        />
      )}

      {/* Review confirmation modal */}
      {reviewTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            if (!reviewSubmitting) setReviewTarget(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-md bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                {reviewTarget.action === "APPROVE_PARTNER_DOCUMENT"
                  ? "Approve Document"
                  : "Reject Document"}
              </h2>

              <button
                type="button"
                disabled={reviewSubmitting}
                onClick={() => setReviewTarget(null)}
                className="rounded p-1.5 text-slate-400 transition hover:bg-slate-100"
              >
                <XCircle size={18} />
              </button>
            </div>

            <p className="text-sm text-slate-600">
              Partner:{" "}
              <span className="font-semibold text-slate-900">
                {reviewTarget.partnerName}
              </span>
            </p>

            {reviewTarget.action === "APPROVE_PARTNER_DOCUMENT" ? (
              <p className="mt-4 text-sm text-slate-600">
                Are you sure you want to approve this identity document? The
                partner document status will be updated to APPROVED.
              </p>
            ) : (
              <div className="mt-4">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>

                <textarea
                  value={reviewReason}
                  onChange={(event) => setReviewReason(event.target.value)}
                  maxLength={1000}
                  rows={4}
                  placeholder="Explain why this document is being rejected..."
                  className="w-full rounded-md border border-slate-200 p-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />

                <p className="mt-1 text-right text-xs text-slate-400">
                  {reviewReason.length}/1000
                </p>
              </div>
            )}

            {reviewError && (
              <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {reviewError}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={reviewSubmitting}
                onClick={() => setReviewTarget(null)}
                className="h-9 rounded border border-slate-200 px-3.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={reviewSubmitting}
                onClick={handlePartnerReview}
                className={`h-9 rounded px-3.5 text-sm font-medium text-white transition disabled:opacity-50 ${
                  reviewTarget.action === "APPROVE_PARTNER_DOCUMENT"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {reviewSubmitting
                  ? "Processing..."
                  : reviewTarget.action === "APPROVE_PARTNER_DOCUMENT"
                    ? "Confirm Approval"
                    : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Document preview modal — image-only.
 */
function DocumentPreview({
  attendeeId,
  partnerName,
  documentType,
  onClose,
}: {
  attendeeId: string;
  partnerName: string;
  documentType: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const documentUrl = withBasePath(`/api/admin/partner-verification/${attendeeId}/document`);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-md bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Identity Document
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {partnerName} · {documentType}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-slate-500 transition hover:bg-slate-100"
          >
            <XCircle size={18} />
          </button>
        </div>

        {/* Image Preview */}
        <div className="relative flex min-h-[400px] flex-1 items-center justify-center overflow-auto bg-slate-100 p-4">
          {loading && !error && (
            <div className="absolute flex flex-col items-center gap-2 text-slate-500">
              <LoaderCircle size={22} className="animate-spin" />
              <p className="text-sm">Loading document...</p>
            </div>
          )}

          {error ? (
            <div className="text-center">
              <FileWarning size={26} className="mx-auto mb-2 text-slate-400" />
              <p className="text-sm text-red-600">{error}</p>
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setLoading(true);
                }}
                className="mt-3 text-sm font-medium text-slate-700 underline"
              >
                Try again
              </button>
            </div>
          ) : (
            <img
              key={attendeeId}
              src={documentUrl}
              alt={`${partnerName} identity document`}
              className={`max-h-[65vh] max-w-full rounded object-contain ${
                loading ? "invisible" : "visible"
              }`}
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError("Unable to load this document.");
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-200 px-4 py-2.5">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded bg-slate-900 px-3 text-xs font-medium text-white transition hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
