"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
  Copy,
  Check,
  QrCode,
  FileText,
  Download,
  ChevronDown,
} from "lucide-react";

type Attendee = {
  _id: string;
  attendeeType: "EMPLOYEE" | "PARTNER";
  fullName: string;
  title: string | null;
  createdAt: string;
};

type PartnerDocumentInfo = {
  documentType: "IMAGE" | "AADHAAR" | "PAN";
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
  qrPasses?: { attendee: string; status: string; emailStatus: string; issuedAt: string; emailSentAt: string | null }[];
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
    PENDING_ADMIN_APPROVAL: "bg-rose-50 text-rose-700 border-rose-200",
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
  const [auditOpen, setAuditOpen] = useState(false);
  const [documentOpen, setDocumentOpen] = useState(false);
  const [documentError, setDocumentError] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [resendingPasses, setResendingPasses] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");

  useEffect(() => () => {
    if (documentUrl) URL.revokeObjectURL(documentUrl);
  }, [documentUrl]);

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

  async function openPartnerDocument() {
    if (!partnerAttendee) return;
    setDocumentError("");
    setDocumentOpen(true);
    try {
      const response = await fetch(
        withBasePath(`/api/admin/registrations/${id}/partner-document`),
        { credentials: "same-origin", cache: "no-store" }
      );
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.message || "Unable to open partner document.");
      }
      const blob = await response.blob();
      setDocumentUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return URL.createObjectURL(blob);
      });
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : "Unable to open document.");
    }
  }

  async function resendCouplePasses() {
    if (resendingPasses) return;
    setResendingPasses(true);
    setResendMessage("");
    setResendError("");
    try {
      const response = await fetch(withBasePath(`/api/admin/registrations/${id}/resend-passes`), {
        method: "POST",
        credentials: "same-origin",
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Unable to resend QR pass email.");
      setResendMessage(result.message);
    } catch (error) {
      setResendError(error instanceof Error ? error.message : "Unable to resend QR pass email.");
    } finally {
      setResendingPasses(false);
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
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
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

  const isPending = registration.status === "PENDING_ADMIN_APPROVAL";
  const isCouple = registration.attendanceType === "COUPLE";

  const docStatus = registration.partnerDocument?.verificationStatus ?? null;
  const docPending = docStatus === "PENDING";
  const docApproved = docStatus === "APPROVED";
  const docRejected = docStatus === "REJECTED";

  // Derived — no new endpoint. Swap for a real field if your API returns one.
  const qrReady =
    registration.status === "APPROVED" && (!isCouple || docApproved);
  const activePasses = registration.qrPasses?.filter((pass) => pass.status === "ACTIVE") || [];

  return (
    <div className="mx-auto container space-y-5 p-4 sm:p-6">
      {/* ───────────── 1. Header ───────────── */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <Link
            href="/admin/registrations"
            className="mb-3 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft size={16} />
            Back to registrations
          </Link>

          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Registration Review
          </h1>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1.5 font-mono">
              <Hash size={14} className="text-slate-400" />
              {registration._id}
              <CopyButton value={registration._id} label="Copy registration ID" />
            </span>

            <span className="text-slate-300">·</span>

            <span className="inline-flex items-center gap-1.5">
              <Users size={14} className="text-slate-400" />
              {attendanceTypeLabel(registration.attendanceType)}
            </span>

            <span className="text-slate-300">·</span>

            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={14} className="text-slate-400" />
              {formatDate(registration.submittedAt)}
            </span>
          </div>
        </div>

        <span
          className={`inline-flex w-fit items-center rounded-md border px-3 py-1.5 text-sm font-medium ${statusStyle(
            registration.status
          )}`}
        >
          {statusLabel(registration.status)}
        </span>
      </div>

      {/* ───────────── 2. Attendees (merged) ───────────── */}
      <section className="rounded-lg border border-slate-200 bg-white shadow-xs">
        <CardHeader
          icon={<Users size={16} />}
          title="Attendee Information"
          subtitle="Employee and partner details for this registration"
          badge={
            <span
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${registration.employee.emailVerifiedAt
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
            >
              <ShieldCheck size={12} />
              {registration.employee.emailVerifiedAt
                ? "Email Verified"
                : "Email Not Verified"}
            </span>
          }
        />

        <div className="divide-y divide-dashed divide-slate-200 px-4 py-1">
          {/* Employee block */}
          <div className="py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Employee
            </p>

            <div className="divide-y divide-dashed divide-slate-200">
              <InfoRow
                icon={<UserRound size={14} />}
                label="Full Name"
                value={registration.employee.fullName}
                emphasize
              />
              <InfoRow
                icon={<Mail size={14} />}
                label="Official Email"
                value={registration.employee.officialEmail}
                copyable
              />
              <InfoRow
                icon={<Phone size={14} />}
                label="Phone"
                value={registration.employee.phoneNumber}
                copyable
              />
              <InfoRow
                icon={<Hash size={14} />}
                label="Employee ID"
                value={registration.employee.employeeId}
                mono
                copyable
              />
            </div>
          </div>

          {/* Attendee block */}
          <div className="py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Attendees
            </p>

            {employeeAttendee ? (
              <AttendeeRow
                attendee={employeeAttendee}
                label="Primary attendee"
              />
            ) : (
              <div className="flex items-center gap-2 py-2 text-sm font-medium text-amber-700">
                <AlertTriangle size={14} />
                <span>Primary attendee record was not found.</span>
              </div>
            )}

            {isCouple &&
              (partnerAttendee ? (
                <AttendeeRow attendee={partnerAttendee} label="Partner" />
              ) : (
                <div className="flex items-center gap-2 py-2 text-sm font-medium text-amber-700">
                  <AlertTriangle size={14} />
                  <span>Partner attendee record was not found.</span>
                </div>
              ))}
          </div>
        </div>
      </section>

      {/* ───────────── 3. Partner document review (couple only) ───────────── */}
      {isCouple && (
        <section className="rounded-lg border border-slate-200 bg-white shadow-xs">
          <CardHeader
            icon={<FileText size={16} />}
            title="Partner Document Verification"
            subtitle="Private identity document review"
            badge={
              docStatus ? (
                <span
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${docApproved
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : docRejected
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                    }`}
                >
                  {docStatus}
                </span>
              ) : null
            }
          />

          {registration.partnerDocument ? (
            <div className="p-4 space-y-4">
              <div className="divide-y divide-dashed divide-slate-200">
                <InfoRow
                  icon={<Hash size={14} />}
                  label="Document Type"
                  value={registration.partnerDocument.documentType}
                  emphasize
                />
                <InfoRow
                  icon={<CalendarDays size={14} />}
                  label="Uploaded On"
                  value={formatDate(registration.partnerDocument.uploadedAt)}
                />
                {registration.partnerDocument.reviewedAt && (
                  <InfoRow
                    icon={<Clock3 size={14} />}
                    label="Reviewed At"
                    value={formatDate(registration.partnerDocument.reviewedAt)}
                  />
                )}
              </div>

              {registration.partnerDocument.rejectionReason && (
                <ReasonBox
                  tone="rose"
                  label="Rejection Reason"
                  text={registration.partnerDocument.rejectionReason}
                />
              )}

              {/* Document actions + review buttons side-by-side */}
              <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-slate-200 pt-4">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  onClick={() => void openPartnerDocument()}
                >
                  <FileText size={14} />
                  View Document
                </button>

                <a
                  type="button"
                  href={documentUrl || undefined}
                  download={`partner-document-${registration._id}.webp`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  onClick={() => {
                    if (documentUrl) return;
                    void openPartnerDocument();
                  }}
                >
                  <Download size={14} />
                  Download
                </a>

                {docPending && (
                  <>
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
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-4 text-sm font-medium text-amber-700">
              <AlertTriangle size={14} />
              <span>No partner document record was found.</span>
            </div>
          )}
        </section>
      )}

      {/* ───────────── 4. Decision + QR Pass ───────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="rounded-lg border border-slate-200 bg-white shadow-xs lg:col-span-2">
          <CardHeader
            icon={<ShieldCheck size={16} />}
            title="Registration Decision"
            subtitle="Review all information before making a decision"
          />

          <div className="space-y-4 p-4">
            {/* Slim prior-decision line */}
            {!isPending && (
              <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3">
                <p className="text-sm font-medium text-slate-700">
                  {registration.status === "APPROVED" &&
                    "This registration has been approved."}
                  {registration.status === "REJECTED" &&
                    "This registration has been rejected."}
                  {registration.status === "CORRECTION_REQUESTED" &&
                    "A correction was requested for this registration."}
                  {registration.status === "CANCELLED" &&
                    "This registration was cancelled."}
                </p>
                {registration.reviewedAt && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    Reviewed on {formatDate(registration.reviewedAt)}
                  </p>
                )}
              </div>
            )}

            {registration.rejectionReason && (
              <ReasonBox
                tone="rose"
                label="Rejection Reason"
                text={registration.rejectionReason}
              />
            )}

            {registration.correctionReason && (
              <ReasonBox
                tone="amber"
                label="Correction Instructions"
                text={registration.correctionReason}
              />
            )}

            {isPending ? (
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
                  Approve
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
            ) : null}

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

        {/* QR Pass card */}
        <section className="rounded-lg border border-slate-200 bg-white shadow-xs">
          <CardHeader
            icon={<QrCode size={16} />}
            title="QR Pass"
            subtitle="Event entry credential"
          />

          <div className="p-4">
            {qrReady ? (
              <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50/70 p-3">
                <CheckCircle2 size={16} className="mt-0.5 text-emerald-700" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">
                    {isCouple ? "QR passes issued after both approvals" : "QR pass ready"}
                  </p>
                  {activePasses.length ? (
                    <div className="mt-2 space-y-2">
                      <p className="text-xs text-emerald-700">{isCouple ? "One shared QR pass for both attendees" : `${activePasses.length} active attendee pass(es)`} · Email {activePasses.every((pass) => pass.emailStatus === "SENT") ? "sent" : "delivery pending or failed"}</p>
                      <div className="flex flex-wrap gap-2">
                        {(isCouple ? registration.attendees.filter((attendee) => attendee.attendeeType === "EMPLOYEE") : registration.attendees).map((attendee) => <a key={attendee._id} href={withBasePath(`/api/admin/qr-passes/${attendee._id}/image`)} className="rounded border border-emerald-200 bg-white px-2 py-1 text-xs font-medium text-emerald-800">{isCouple ? "Shared Employee + Partner QR" : `${attendee.fullName} QR`}</a>)}
                        {isCouple && <a href={withBasePath(`/api/admin/registrations/${registration._id}/couple-ticket`)} className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-white px-2 py-1 text-xs font-semibold text-emerald-800"><Download size={13} /> Download Shared SVG</a>}
                      </div>
                      {isCouple && activePasses.length >= 1 && (
                        <button type="button" onClick={resendCouplePasses} disabled={resendingPasses} className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-60">
                          <Mail size={13} /> {resendingPasses ? "Sending..." : "Resend QR Email"}
                        </button>
                      )}
                      {resendMessage && <p role="status" className="text-xs font-medium text-emerald-700">{resendMessage}</p>}
                      {resendError && <p role="alert" className="text-xs font-medium text-rose-700">{resendError}</p>}
                    </div>
                  ) : <>
                    <p className="mt-0.5 text-xs text-emerald-700">QR passes are generated and emailed automatically after all required approvals.</p>
                  </>}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50/70 p-3">
                <QrCode size={16} className="mt-0.5 text-slate-400" />
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    Not yet available
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    QR pass becomes available once the required approvals are
                    complete.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ───────────── 5. Audit History (collapsible) ───────────── */}
      <section className="rounded-lg border border-slate-200 bg-white shadow-xs">
        <button
          type="button"
          onClick={() => setAuditOpen((open) => !open)}
          className="flex w-full items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3 text-left transition-colors hover:bg-slate-100/60"
          aria-expanded={auditOpen}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-indigo-100 bg-indigo-50 text-indigo-600">
              <Clock3 size={16} />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-slate-900">
                Audit History
              </h2>
              <p className="text-xs text-slate-500">
                {auditLoading
                  ? "Loading…"
                  : auditHistory.length === 0
                    ? "No admin activity yet"
                    : `${auditHistory.length} admin ${auditHistory.length === 1 ? "action" : "actions"
                    } · Expand to view`}
              </p>
            </div>
          </div>

          <ChevronDown
            size={18}
            className={`text-slate-400 transition-transform ${auditOpen ? "rotate-180" : ""
              }`}
          />
        </button>

        {auditOpen && (
          <div className="p-4">
            {auditLoading ? (
              <p className="py-2 text-center text-sm text-slate-500">
                Loading audit history...
              </p>
            ) : auditError ? (
              <div className="rounded-md border border-rose-200 bg-rose-50/70 p-3 text-sm font-medium text-rose-700">
                {auditError}
              </div>
            ) : auditHistory.length === 0 ? (
              <div className="py-6 text-center">
                <Clock3 className="mx-auto mb-2 text-slate-400" size={20} />
                <p className="text-sm font-semibold text-slate-900">
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
                        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <span
                            className={`h-2 w-2 rounded-full ${isApproval
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
                          {record.admin?.email
                            ? ` (${record.admin.email})`
                            : ""}
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
                        <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                          {record.newStatus}
                        </span>
                      </div>

                      {record.reason && (
                        <div className="mt-2 rounded-md border border-slate-200 bg-slate-50/70 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Reason / Instructions
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-900">
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
        )}
      </section>

      {documentOpen && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
    onClick={() => setDocumentOpen(false)}
  >
    <section
      role="dialog"
      aria-modal="true"
      aria-label="Partner identity document"
      className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg bg-white p-4 shadow-xl"
      onClick={(event) => event.stopPropagation()}
    >
      {/* Header */}
      <div className="mb-3 flex shrink-0 items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <h2 className="font-semibold text-slate-900">
            Partner identity document
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Document preview
          </p>
        </div>

        <button
          type="button"
          onClick={() => setDocumentOpen(false)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100"
        >
          Close
        </button>
      </div>

      {/* Document Preview */}
      <div className="min-h-[200px] flex-1 overflow-auto rounded-md bg-slate-50 p-2">
        {documentError ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-rose-700">
              {documentError}
            </p>

            {documentUrl && (
              <a
                href={documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Open document
              </a>
            )}
          </div>
        ) : documentUrl ? (
          documentUrl.toLowerCase().split("?")[0].endsWith(".pdf") ? (
            <iframe
              src={documentUrl}
              title="Partner identity document preview"
              className="h-[70vh] min-h-[400px] w-full rounded-md border border-slate-200 bg-white"
            />
          ) : (
            <img
              src={documentUrl}
              alt="Partner identity document"
              className="mx-auto max-h-[70vh] max-w-full rounded-md object-contain"
              onError={() => {
                setDocumentError(
                  "Unable to preview this document. Please open it separately."
                );
              }}
            />
          )
        ) : (
          <div className="flex min-h-[200px] items-center justify-center">
            <p className="text-sm text-slate-500">
              Loading document...
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      {documentUrl && (
        <div className="mt-3 flex shrink-0 justify-end border-t border-slate-200 pt-3">
          <a
            href={documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Open in new tab
          </a>
        </div>
      )}
    </section>
  </div>
)}

      {/* ───────────── Review Confirmation Dialog ───────────── */}
      {pendingAction && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-slate-900">
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
                <label className="mb-2 block text-sm font-medium text-slate-900">
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
                  className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
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

/* ---------- Shared presentational components ---------- */

function CardHeader({
  icon,
  title,
  subtitle,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-indigo-100 bg-indigo-50 text-indigo-600">
          {icon}
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">
            {title}
          </h2>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>

      {badge}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  emphasize = false,
  mono = false,
  copyable = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  emphasize?: boolean;
  mono?: boolean;
  copyable?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <span className="flex items-center gap-2 text-xs text-slate-600">
        <span className="text-slate-400">{icon}</span>
        {label}
      </span>

      <span
        className={`flex items-center gap-1.5 text-right text-sm text-slate-900 ${emphasize ? "font-semibold" : "font-medium"
          } ${mono ? "rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs" : ""} ${!mono ? "break-all" : ""
          }`}
      >
        {value}
        {copyable && <CopyButton value={value} label={`Copy ${label}`} />}
      </span>
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* no-op */
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      title={label}
      className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

function ReasonBox({
  tone,
  label,
  text,
}: {
  tone: "rose" | "amber";
  label: string;
  text: string;
}) {
  const toneClasses =
    tone === "rose"
      ? "border-rose-200 bg-rose-50/70 text-rose-700"
      : "border-amber-200 bg-amber-50/70 text-amber-700";

  return (
    <div className={`rounded-md border p-3 ${toneClasses}`}>
      <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-sm text-slate-900">{text}</p>
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
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-slate-100 text-slate-500">
          <UserRound size={16} />
        </div>

        <div>
          <span className="block text-sm font-semibold leading-tight text-slate-900">
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
