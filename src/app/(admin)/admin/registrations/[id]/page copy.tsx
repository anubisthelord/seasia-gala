"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { withBasePath } from "@/config/base-path";
import {
  ArrowLeft,
  UserRound,
  Mail,
  Phone,
  CalendarDays,
  Users,
  ShieldCheck,
  Clock3,
  Hash,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

type Attendee = {
  _id: string;
  attendeeType: "EMPLOYEE" | "PARTNER";
  fullName: string;
  title: string | null;
  createdAt: string;
};

type PartnerDocumentInfo = {
  documentType: "AADHAAR" | "PAN";
  verificationStatus: "PENDING" | "APPROVED" | "REJECTED";
  reviewedAt: string | null;
  rejectionReason: string | null;
  uploadedAt: string;
};

type ReviewAction =
  | "APPROVE_REGISTRATION"
  | "REJECT_REGISTRATION"
  | "REQUEST_CORRECTION"
  | "APPROVE_PARTNER_DOCUMENT"
  | "REJECT_PARTNER_DOCUMENT";

type AuditRecord = {
  _id: string;
  action: ReviewAction;
  previousStatus: string;
  newStatus: string;
  reason: string | null;
  createdAt: string;
  admin: {
    _id: string;
    fullName: string;
    email: string;
  } | null;
  attendee: {
    _id: string;
    fullName: string;
    attendeeType: string;
  } | null;
};

type RegistrationDetails = {
  _id: string;
  employee: {
    _id: string;
    fullName: string;
    officialEmail: string;
    phoneNumber: string;
    employeeId: string;
    emailVerifiedAt: string | null;
  };
  attendanceType: "SINGLE" | "COUPLE";
  status:
    | "PENDING_ADMIN_APPROVAL"
    | "APPROVED"
    | "REJECTED"
    | "CORRECTION_REQUESTED"
    | "CANCELLED";
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  correctionReason: string | null;
  attendees: Attendee[];
  partnerDocument: PartnerDocumentInfo | null;
};

function formatDate(date: string | null) {
  if (!date) return "Not available";

  return new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: RegistrationDetails["status"]) {
  const labels: Record<RegistrationDetails["status"], string> = {
    PENDING_ADMIN_APPROVAL: "Pending Approval",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    CORRECTION_REQUESTED: "Correction Requested",
    CANCELLED: "Cancelled",
  };

  return labels[status];
}

function statusStyle(status: RegistrationDetails["status"]) {
  const styles: Record<RegistrationDetails["status"], string> = {
    PENDING_ADMIN_APPROVAL: "bg-amber-50 text-amber-700 border-amber-200",
    APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
    CORRECTION_REQUESTED: "bg-orange-50 text-orange-700 border-orange-200",
    CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
  };

  return styles[status];
}

function attendanceTypeLabel(type: RegistrationDetails["attendanceType"]) {
  return type === "COUPLE" ? "Couple" : "Single";
}

export default function RegistrationDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const id = params.id as string;

  const [registration, setRegistration] =
    useState<RegistrationDetails | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [pendingAction, setPendingAction] =
    useState<ReviewAction | null>(null);

  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const [auditHistory, setAuditHistory] = useState<AuditRecord[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState("");

  useEffect(() => {
    if (!id) return;

    const controller = new AbortController();

    async function fetchRegistration() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          withBasePath(`/api/admin/registrations/${id}`),
          {
            method: "GET",
            credentials: "same-origin",
            signal: controller.signal,
          }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Unable to load registration.");
        }

        setRegistration(result.data);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;

        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchRegistration();

    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const controller = new AbortController();

    async function fetchAuditHistory() {
      try {
        setAuditLoading(true);
        setAuditError("");

        const response = await fetch(
          withBasePath(`/api/admin/registrations/${id}/audit`),
          {
            credentials: "same-origin",
            signal: controller.signal,
          }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Unable to load audit history.");
        }

        setAuditHistory(result.data);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;

        setAuditError(
          error instanceof Error
            ? error.message
            : "Unable to load audit history."
        );
      } finally {
        if (!controller.signal.aborted) {
          setAuditLoading(false);
        }
      }
    }

    fetchAuditHistory();

    return () => controller.abort();
  }, [id]);

  const requiresReason = [
    "REJECT_REGISTRATION",
    "REQUEST_CORRECTION",
    "REJECT_PARTNER_DOCUMENT",
  ];

  async function handleReviewSubmit() {
    if (!pendingAction || submitting) return;

    const trimmedReason = reason.trim();

    if (requiresReason.includes(pendingAction) && !trimmedReason) {
      setActionError("Please provide a reason before continuing.");
      return;
    }

    try {
      setSubmitting(true);
      setActionError("");
      setActionSuccess("");

      const response = await fetch(
        withBasePath(`/api/admin/registrations/${id}/review`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            action: pendingAction,
            reason: trimmedReason,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Review action failed.");
      }

      if (
        pendingAction === "APPROVE_REGISTRATION" ||
        pendingAction === "REJECT_REGISTRATION" ||
        pendingAction === "REQUEST_CORRECTION"
      ) {
        setRegistration((previous) => {
          if (!previous) return previous;

          return {
            ...previous,
            status: result.data.status,
            reviewedAt: result.data.reviewedAt,
            rejectionReason:
              pendingAction === "REJECT_REGISTRATION" ? trimmedReason : null,
            correctionReason:
              pendingAction === "REQUEST_CORRECTION" ? trimmedReason : null,
          };
        });
      }

      if (
        pendingAction === "APPROVE_PARTNER_DOCUMENT" ||
        pendingAction === "REJECT_PARTNER_DOCUMENT"
      ) {
        setRegistration((previous) => {
          if (!previous || !previous.partnerDocument) return previous;

          return {
            ...previous,
            partnerDocument: {
              ...previous.partnerDocument,
              verificationStatus: result.data.verificationStatus,
              reviewedAt: result.data.reviewedAt,
              rejectionReason:
                pendingAction === "REJECT_PARTNER_DOCUMENT"
                  ? trimmedReason
                  : null,
            },
          };
        });
      }

      setActionSuccess(result.message);
      setPendingAction(null);
      setReason("");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-sm text-slate-500">
          Loading registration details...
        </div>
      </div>
    );
  }

  if (error || !registration) {
    return (
      <div className="space-y-4 p-6">
        <Link
          href="/admin/registrations"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-600"
        >
          <ArrowLeft size={16} />
          Back to registrations
        </Link>

        <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {error || "Registration not found."}
        </div>
      </div>
    );
  }

  const employeeAttendee = registration.attendees.find(
    (attendee) => attendee.attendeeType === "EMPLOYEE"
  );

  const partnerAttendee = registration.attendees.find(
    (attendee) => attendee.attendeeType === "PARTNER"
  );

  return (
    <div className="mx-auto container space-y-5 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Link
            href="/admin/registrations"
            className="mb-3 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-600"
          >
            <ArrowLeft size={16} />
            Back to registrations
          </Link>

          <h1 className="text-2xl font-semibold tracking-tight text-slate-600">
            Registration Details
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Review employee registration and attendee information.
          </p>
        </div>

        <span
          className={`inline-flex w-fit items-center rounded-md border px-3 py-1.5 text-sm font-medium ${statusStyle(
            registration.status
          )}`}
        >
          {statusLabel(registration.status)}
        </span>
      </div>

      {/* Registration summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          icon={<Hash size={18} />}
          label="Registration ID"
          value={registration._id}
          mono
        />

        <SummaryCard
          icon={<Users size={18} />}
          label="Attendance Type"
          value={attendanceTypeLabel(registration.attendanceType)}
        />

        <SummaryCard
          icon={<CalendarDays size={18} />}
          label="Submitted On"
          value={formatDate(registration.submittedAt)}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Employee information */}
        <section className="rounded-lg border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-indigo-100 bg-indigo-50 text-indigo-600">
                <UserRound size={16} />
              </div>
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-slate-600">
                  Employee Information
                </h2>
                <p className="text-xs text-slate-500">
                  Primary event registrant
                </p>
              </div>
            </div>

            <span
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${
                registration.employee.emailVerifiedAt
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}
            >
              <ShieldCheck size={12} />
              {registration.employee.emailVerifiedAt
                ? "Verified"
                : "Not Verified"}
            </span>
          </div>

          <div className="divide-y divide-dashed divide-slate-200 px-4 py-1">
            <InfoRow
              icon={<UserRound size={14} className="text-slate-400" />}
              label="Full Name"
              value={registration.employee.fullName}
              valueClassName="font-semibold text-slate-600"
            />

            <InfoRow
              icon={<Mail size={14} className="text-slate-400" />}
              label="Official Email"
              value={registration.employee.officialEmail}
              valueClassName="font-medium break-all text-slate-600"
            />

            <InfoRow
              icon={<Phone size={14} className="text-slate-400" />}
              label="Phone Number"
              value={registration.employee.phoneNumber}
              valueClassName="font-medium text-slate-600"
            />

            <InfoRow
              icon={<Hash size={14} className="text-slate-400" />}
              label="Employee ID"
              value={registration.employee.employeeId}
              valueClassName="font-mono font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md text-xs"
            />
          </div>
        </section>

        {/* Attendee information */}
        <section className="rounded-lg border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center gap-2.5 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-indigo-100 bg-indigo-50 text-indigo-600">
              <Users size={16} />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-slate-600">
                Attendee Information
              </h2>
              <p className="text-xs text-slate-500">
                People included in this registration
              </p>
            </div>
          </div>

          <div className="divide-y divide-dashed divide-slate-200 px-4">
            {employeeAttendee && (
              <AttendeeRow attendee={employeeAttendee} label="Employee" />
            )}

            {registration.attendanceType === "COUPLE" &&
              (partnerAttendee ? (
                <AttendeeRow attendee={partnerAttendee} label="Partner" />
              ) : (
                <div className="flex items-center gap-2 py-3 text-sm font-medium text-amber-700">
                  <AlertTriangle size={14} />
                  <span>Partner attendee record was not found.</span>
                </div>
              ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Partner document information */}
        {registration.attendanceType === "COUPLE" && (
          <section className="rounded-lg border border-slate-200 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-md border border-indigo-100 bg-indigo-50 text-indigo-600">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-slate-600">
                    Partner Document Verification
                  </h2>
                  <p className="text-xs text-slate-500">
                    Private identity document review
                  </p>
                </div>
              </div>

              {registration.partnerDocument && (
                <span
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${
                    registration.partnerDocument.verificationStatus ===
                    "APPROVED"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : registration.partnerDocument.verificationStatus ===
                        "REJECTED"
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  {registration.partnerDocument.verificationStatus}
                </span>
              )}
            </div>

            {registration.partnerDocument ? (
              <div className="divide-y divide-dashed divide-slate-200 px-4">
                <InfoRow
                  icon={<Hash size={14} className="text-slate-400" />}
                  label="Document Type"
                  value={registration.partnerDocument.documentType}
                  valueClassName="font-semibold text-slate-600"
                />

                <InfoRow
                  icon={<CalendarDays size={14} className="text-slate-400" />}
                  label="Uploaded On"
                  value={formatDate(registration.partnerDocument.uploadedAt)}
                  valueClassName="font-medium text-slate-600"
                />

                <InfoRow
                  icon={<Clock3 size={14} className="text-slate-400" />}
                  label="Reviewed At"
                  value={formatDate(registration.partnerDocument.reviewedAt)}
                  valueClassName="font-medium text-slate-600"
                />

                {registration.partnerDocument.rejectionReason && (
                  <div className="my-3 rounded-md border border-rose-200 bg-rose-50/70 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                      Rejection Reason
                    </p>
                    <p className="mt-1 text-sm text-rose-800">
                      {registration.partnerDocument.rejectionReason}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-4 text-sm font-medium text-amber-700">
                <AlertTriangle size={14} />
                <span>No partner document record was found.</span>
              </div>
            )}
          </section>
        )}

        {/* Review information */}
        <section className="rounded-lg border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-indigo-100 bg-indigo-50 text-indigo-600">
                <Clock3 size={16} />
              </div>
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-slate-600">
                  Review Information
                </h2>
                <p className="text-xs text-slate-500">
                  Current administrative review status
                </p>
              </div>
            </div>

            <span className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
              {statusLabel(registration.status)}
            </span>
          </div>

          <div className="divide-y divide-dashed divide-slate-200 px-4">
            <InfoRow
              icon={<Clock3 size={14} className="text-slate-400" />}
              label="Review Status"
              value={statusLabel(registration.status)}
              valueClassName="font-semibold text-slate-600"
            />

            <InfoRow
              icon={<CalendarDays size={14} className="text-slate-400" />}
              label="Reviewed At"
              value={formatDate(registration.reviewedAt)}
              valueClassName="font-medium text-slate-600"
            />

            {registration.rejectionReason && (
              <div className="my-3 rounded-md border border-rose-200 bg-rose-50/70 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                  Rejection Reason
                </p>
                <p className="mt-1 text-sm text-rose-800">
                  {registration.rejectionReason}
                </p>
              </div>
            )}

            {registration.correctionReason && (
              <div className="my-3 rounded-md border border-amber-200 bg-amber-50/70 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  Correction Instructions
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  {registration.correctionReason}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Admin Review Actions */}
      <section className="rounded-lg border border-slate-200 bg-white shadow-xs">
        <div className="flex items-center gap-2.5 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-indigo-100 bg-indigo-50 text-indigo-600">
            <ShieldCheck size={16} />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-slate-600">
              Admin Actions
            </h2>
            <p className="text-xs text-slate-500">
              Review employee registration and partner verification independently
            </p>
          </div>
        </div>

        <div className="space-y-4 p-4">
          {/* Employee registration actions */}
          <div className="border-b border-dashed border-slate-200 pb-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Employee Registration
              </span>
              {registration.status !== "PENDING_ADMIN_APPROVAL" && (
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  Reviewed
                </span>
              )}
            </div>

            {registration.status === "PENDING_ADMIN_APPROVAL" ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActionError("");
                    setReason("");
                    setPendingAction("APPROVE_REGISTRATION");
                  }}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 active:bg-emerald-800"
                >
                  Approve Registration
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActionError("");
                    setReason("");
                    setPendingAction("REJECT_REGISTRATION");
                  }}
                  className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                >
                  Reject
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActionError("");
                    setReason("");
                    setPendingAction("REQUEST_CORRECTION");
                  }}
                  className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-100"
                >
                  Request Correction
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                This registration has already been reviewed.
              </p>
            )}
          </div>

          {/* Partner document actions */}
          {registration.attendanceType === "COUPLE" && (
            <div className="border-b border-dashed border-slate-200 pb-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Partner Document
                </span>
                {registration.partnerDocument && (
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {registration.partnerDocument.verificationStatus}
                  </span>
                )}
              </div>

              {registration.partnerDocument?.verificationStatus ===
              "PENDING" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActionError("");
                      setReason("");
                      setPendingAction("APPROVE_PARTNER_DOCUMENT");
                    }}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 active:bg-emerald-800"
                  >
                    Approve Document
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActionError("");
                      setReason("");
                      setPendingAction("REJECT_PARTNER_DOCUMENT");
                    }}
                    className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                  >
                    Reject Document
                  </button>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  {registration.partnerDocument
                    ? `Document status: ${registration.partnerDocument.verificationStatus}`
                    : "No partner document available."}
                </p>
              )}
            </div>
          )}

          {/* Success Message Banner */}
          {actionSuccess && (
            <div
              role="status"
              className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50/80 p-3 text-sm font-medium text-emerald-800"
            >
              <CheckCircle2 size={16} />
              <span>{actionSuccess}</span>
            </div>
          )}
        </div>
      </section>

      {/* Audit History */}
      <section className="rounded-lg border border-slate-200 bg-white shadow-xs">
        <div className="flex items-center gap-2.5 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-indigo-100 bg-indigo-50 text-indigo-600">
            <Clock3 size={16} />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-slate-600">
              Audit History
            </h2>
            <p className="text-xs text-slate-500">
              Complete administrative activity for this registration
            </p>
          </div>
        </div>

        <div className="p-4">
          {auditLoading ? (
            <p className="py-2 text-center text-sm font-medium text-slate-500">
              Loading audit history...
            </p>
          ) : auditError ? (
            <div className="rounded-md border border-rose-200 bg-rose-50/70 p-3 text-sm font-medium text-rose-700">
              {auditError}
            </div>
          ) : auditHistory.length === 0 ? (
            <div className="py-6 text-center">
              <Clock3 className="mx-auto mb-2 text-slate-400" size={20} />
              <p className="text-sm font-semibold text-slate-600">
                No review activity yet
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Administrative decisions will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-dashed divide-slate-200">
              {auditHistory.map((record) => {
                const actionLabels: Record<ReviewAction, string> = {
                  APPROVE_REGISTRATION: "Registration Approved",
                  REJECT_REGISTRATION: "Registration Rejected",
                  REQUEST_CORRECTION: "Correction Requested",
                  APPROVE_PARTNER_DOCUMENT: "Partner Document Approved",
                  REJECT_PARTNER_DOCUMENT: "Partner Document Rejected",
                };

                const isApproval =
                  record.action === "APPROVE_REGISTRATION" ||
                  record.action === "APPROVE_PARTNER_DOCUMENT";

                const isRejection =
                  record.action === "REJECT_REGISTRATION" ||
                  record.action === "REJECT_PARTNER_DOCUMENT";

                return (
                  <div
                    key={record._id}
                    className="space-y-2 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            isApproval
                              ? "bg-emerald-500"
                              : isRejection
                              ? "bg-rose-500"
                              : "bg-amber-500"
                          }`}
                        />
                        {actionLabels[record.action]}
                      </span>
                      <span className="font-mono text-xs text-slate-500">
                        {formatDate(record.createdAt)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-slate-500">
                      <span>
                        By{" "}
                        <strong className="font-semibold text-slate-700">
                          {record.admin?.fullName || "Unknown admin"}
                        </strong>
                        {record.admin?.email ? ` (${record.admin.email})` : ""}
                      </span>
                      {record.attendee && (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                          {record.attendee.fullName} •{" "}
                          {record.attendee.attendeeType}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1 text-xs">
                      <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                        {record.previousStatus}
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                        {record.newStatus}
                      </span>
                    </div>

                    {record.reason && (
                      <div className="mt-2 rounded-md border border-slate-200 bg-slate-50/70 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Reason / Instructions
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                          {record.reason}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Review Confirmation Dialog */}
      {pendingAction && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-600">
              {pendingAction === "APPROVE_REGISTRATION" &&
                "Approve Registration"}

              {pendingAction === "REJECT_REGISTRATION" &&
                "Reject Registration"}

              {pendingAction === "REQUEST_CORRECTION" && "Request Correction"}

              {pendingAction === "APPROVE_PARTNER_DOCUMENT" &&
                "Approve Partner Document"}

              {pendingAction === "REJECT_PARTNER_DOCUMENT" &&
                "Reject Partner Document"}
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              {pendingAction === "APPROVE_REGISTRATION" &&
                "Are you sure you want to approve this employee registration?"}

              {pendingAction === "REJECT_REGISTRATION" &&
                "This will reject the employee registration. Please provide a reason."}

              {pendingAction === "REQUEST_CORRECTION" &&
                "Provide clear instructions about the information that needs correction."}

              {pendingAction === "APPROVE_PARTNER_DOCUMENT" &&
                "Are you sure you want to approve this partner document?"}

              {pendingAction === "REJECT_PARTNER_DOCUMENT" &&
                "This will reject the partner document. Please provide a reason."}
            </p>

            {requiresReason.includes(pendingAction) && (
              <div className="mt-5">
                <label className="mb-2 block text-sm font-medium text-slate-600">
                  {pendingAction === "REQUEST_CORRECTION"
                    ? "Correction Instructions"
                    : "Reason"}
                  <span className="ml-1 text-rose-600">*</span>
                </label>

                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={1000}
                  rows={4}
                  placeholder={
                    pendingAction === "REQUEST_CORRECTION"
                      ? "Explain what needs to be corrected..."
                      : "Enter the reason..."
                  }
                  className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />

                <p className="mt-1 text-right text-xs text-slate-500">
                  {reason.length}/1000
                </p>
              </div>
            )}

            {actionError && (
              <div
                role="alert"
                className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
              >
                {actionError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setPendingAction(null);
                  setReason("");
                  setActionError("");
                }}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={handleReviewSubmit}
                className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Processing..." : "Confirm Decision"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex items-center gap-2">
        <div className="text-indigo-600">{icon}</div>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </span>
      </div>

      <p
        className={`mt-2 break-all text-sm font-semibold tracking-tight text-slate-600 ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  valueClassName = "font-medium text-slate-600",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <span className="flex items-center gap-2 text-xs text-slate-500">
        {icon}
        {label}
      </span>
      <span className={`text-sm ${valueClassName}`}>{value}</span>
    </div>
  );
}

function DetailItem({
  icon,
  label,
  value,
  valueClass = "text-slate-600",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-xs">{label}</span>
      </div>

      <p className={`break-words pl-6 text-sm font-medium ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}

function AttendeeRow({
  attendee,
  label,
}: {
  attendee: Attendee;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-slate-100 text-slate-500">
          <UserRound size={16} />
        </div>

        <div>
          <span className="block text-sm font-medium leading-tight text-slate-600">
            {attendee.fullName}
          </span>
          <span className="text-xs text-slate-500">
            {label}
            {attendee.title ? ` · ${attendee.title}` : ""}
          </span>
        </div>
      </div>

      <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
        {attendee.attendeeType}
      </span>
    </div>
  );
}