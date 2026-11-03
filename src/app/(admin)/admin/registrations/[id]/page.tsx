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

// 1. Added AuditRecord type
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
    APPROVED: "bg-green-50 text-green-700 border-green-200",
    REJECTED: "bg-red-50 text-red-700 border-red-200",
    CORRECTION_REQUESTED: "bg-orange-50 text-orange-700 border-orange-200",
    CANCELLED: "bg-gray-100 text-gray-600 border-gray-200",
  };

  return styles[status];
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

  // 2. Added audit history states
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

        const response = await fetch(withBasePath(`/api/admin/registrations/${id}`), {
          method: "GET",
          credentials: "same-origin",
          signal: controller.signal,
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Unable to load registration.");
        }

        setRegistration(result.data);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;

        setError(
          err instanceof Error ? err.message : "Something went wrong."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchRegistration();

    return () => controller.abort();
  }, [id]);

  // 3. Fetch audit history
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
          throw new Error(
            result.message || "Unable to load audit history."
          );
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
              pendingAction === "REJECT_REGISTRATION"
                ? trimmedReason
                : null,
            correctionReason:
              pendingAction === "REQUEST_CORRECTION"
                ? trimmedReason
                : null,
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
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-sm text-gray-500">
          Loading registration details...
        </div>
      </div>
    );
  }

  if (error || !registration) {
    return (
      <div className="space-y-4 p-6">
        <button
          onClick={() => router.push("/admin/registrations")}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          Back to registrations
        </button>

        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
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
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Link
            href="/admin/registrations"
            className="mb-3 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft size={16} />
            Back to registrations
          </Link>

          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Registration Details
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Review employee registration and attendee information.
          </p>
        </div>

        <span
          className={`inline-flex w-fit items-center rounded-full border px-3 py-1.5 text-xs font-medium ${statusStyle(
            registration.status
          )}`}
        >
          {statusLabel(registration.status)}
        </span>
      </div>

      {/* Registration summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={<Hash size={18} />}
          label="Registration ID"
          value={registration._id}
        />

        <SummaryCard
          icon={<Users size={18} />}
          label="Attendance Type"
          value={registration.attendanceType}
        />

        <SummaryCard
          icon={<CalendarDays size={18} />}
          label="Submitted On"
          value={formatDate(registration.submittedAt)}
        />
      </div>

      {/* Employee information */}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
          <div className="rounded-lg bg-gray-100 p-2 text-gray-700">
            <UserRound size={18} />
          </div>

          <div>
            <h2 className="font-semibold text-gray-900">
              Employee Information
            </h2>
            <p className="text-xs text-gray-500">
              Primary event registrant
            </p>
          </div>
        </div>

        <div className="grid gap-6 p-5 sm:grid-cols-2">
          <DetailItem
            icon={<UserRound size={16} />}
            label="Full Name"
            value={registration.employee.fullName}
          />

          <DetailItem
            icon={<Mail size={16} />}
            label="Official Email"
            value={registration.employee.officialEmail}
          />

          <DetailItem
            icon={<Phone size={16} />}
            label="Phone Number"
            value={registration.employee.phoneNumber}
          />

          <DetailItem
            icon={<Hash size={16} />}
            label="Employee ID"
            value={registration.employee.employeeId}
          />

          <DetailItem
            icon={<ShieldCheck size={16} />}
            label="Email Verification"
            value={
              registration.employee.emailVerifiedAt
                ? "Verified"
                : "Not verified"
            }
            valueClass={
              registration.employee.emailVerifiedAt
                ? "text-green-700"
                : "text-amber-700"
            }
          />
        </div>
      </section>

      {/* Attendee information */}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
          <div className="rounded-lg bg-gray-100 p-2 text-gray-700">
            <Users size={18} />
          </div>

          <div>
            <h2 className="font-semibold text-gray-900">
              Attendee Information
            </h2>
            <p className="text-xs text-gray-500">
              People included in this registration
            </p>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {employeeAttendee && (
            <AttendeeRow attendee={employeeAttendee} label="Employee" />
          )}

          {registration.attendanceType === "COUPLE" &&
            (partnerAttendee ? (
              <AttendeeRow attendee={partnerAttendee} label="Partner" />
            ) : (
              <div className="p-5 text-sm text-amber-700">
                Partner attendee record was not found.
              </div>
            ))}
        </div>
      </section>

      {/* Partner document information */}
      {registration.attendanceType === "COUPLE" && (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
            <div className="rounded-lg bg-gray-100 p-2 text-gray-700">
              <ShieldCheck size={18} />
            </div>

            <div>
              <h2 className="font-semibold text-gray-900">
                Partner Document Verification
              </h2>
              <p className="text-xs text-gray-500">
                Private identity document review
              </p>
            </div>
          </div>

          {registration.partnerDocument ? (
            <div className="space-y-4 p-5">
              <DetailItem
                icon={<Hash size={16} />}
                label="Document Type"
                value={registration.partnerDocument.documentType}
              />

              <DetailItem
                icon={<ShieldCheck size={16} />}
                label="Verification Status"
                value={registration.partnerDocument.verificationStatus}
                valueClass={
                  registration.partnerDocument.verificationStatus ===
                  "APPROVED"
                    ? "text-green-700"
                    : registration.partnerDocument.verificationStatus ===
                      "REJECTED"
                    ? "text-red-700"
                    : "text-amber-700"
                }
              />

              <DetailItem
                icon={<CalendarDays size={16} />}
                label="Uploaded On"
                value={formatDate(
                  registration.partnerDocument.uploadedAt
                )}
              />

              <DetailItem
                icon={<Clock3 size={16} />}
                label="Reviewed At"
                value={formatDate(
                  registration.partnerDocument.reviewedAt
                )}
              />

              {registration.partnerDocument.rejectionReason && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="text-xs font-medium text-red-700">
                    Document Rejection Reason
                  </p>
                  <p className="mt-1 text-sm text-red-800">
                    {registration.partnerDocument.rejectionReason}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-5 text-sm text-amber-700">
              No partner document record was found.
            </div>
          )}
        </section>
      )}

      {/* Review information */}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
          <div className="rounded-lg bg-gray-100 p-2 text-gray-700">
            <Clock3 size={18} />
          </div>

          <div>
            <h2 className="font-semibold text-gray-900">
              Review Information
            </h2>
            <p className="text-xs text-gray-500">
              Current administrative review status
            </p>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <DetailItem
            icon={<Clock3 size={16} />}
            label="Review Status"
            value={statusLabel(registration.status)}
          />

          <DetailItem
            icon={<CalendarDays size={16} />}
            label="Reviewed At"
            value={formatDate(registration.reviewedAt)}
          />

          {registration.rejectionReason && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-medium text-red-700">
                Rejection Reason
              </p>
              <p className="mt-1 text-sm text-red-800">
                {registration.rejectionReason}
              </p>
            </div>
          )}

          {registration.correctionReason && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
              <p className="text-xs font-medium text-orange-700">
                Correction Instructions
              </p>
              <p className="mt-1 text-sm text-orange-800">
                {registration.correctionReason}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Admin Review Actions */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div>
          <h2 className="font-semibold text-gray-900">
            Admin Actions
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Review employee registration and partner verification independently.
          </p>
        </div>

        {/* Employee registration actions */}
        <div className="mt-5 border-b border-gray-100 pb-5">
          <h3 className="text-sm font-medium text-gray-800">
            Employee Registration
          </h3>

          {registration.status === "PENDING_ADMIN_APPROVAL" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setActionError("");
                  setReason("");
                  setPendingAction("APPROVE_REGISTRATION");
                }}
                className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
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
                className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50"
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
                className="rounded-lg border border-orange-200 px-4 py-2.5 text-sm font-medium text-orange-700 hover:bg-orange-50"
              >
                Request Correction
              </button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-500">
              This registration has already been reviewed.
            </p>
          )}
        </div>

        {/* Partner document actions */}
        {registration.attendanceType === "COUPLE" && (
          <div className="pt-5">
            <h3 className="text-sm font-medium text-gray-800">
              Partner Document
            </h3>

            {registration.partnerDocument?.verificationStatus === "PENDING" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActionError("");
                    setReason("");
                    setPendingAction("APPROVE_PARTNER_DOCUMENT");
                  }}
                  className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700"
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
                  className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  Reject Document
                </button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-500">
                {registration.partnerDocument
                  ? `Document status: ${registration.partnerDocument.verificationStatus}`
                  : "No partner document available."}
              </p>
            )}
          </div>
        )}

        {/* Success message */}
        {actionSuccess && (
          <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {actionSuccess}
          </div>
        )}
      </section>

      {/* 4. Audit History */}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="font-semibold text-gray-900">
            Audit History
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Complete administrative activity for this registration.
          </p>
        </div>

        <div className="p-5">
          {auditLoading ? (
            <p className="text-sm text-gray-500">
              Loading audit history...
            </p>
          ) : auditError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {auditError}
            </div>
          ) : auditHistory.length === 0 ? (
            <div className="py-5 text-center">
              <Clock3 className="mx-auto mb-2 text-gray-400" size={24} />
              <p className="text-sm font-medium text-gray-700">
                No review activity yet
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Administrative decisions will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
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
                  <div key={record._id} className="relative flex gap-4">
                    <div className="relative flex flex-col items-center">
                      <div
                        className={`z-10 flex h-9 w-9 items-center justify-center rounded-full ${
                          isApproval
                            ? "bg-green-50 text-green-700"
                            : isRejection
                              ? "bg-red-50 text-red-700"
                              : "bg-orange-50 text-orange-700"
                        }`}
                      >
                        {isApproval ? (
                          <ShieldCheck size={17} />
                        ) : (
                          <Clock3 size={17} />
                        )}
                      </div>

                      <div className="absolute top-9 h-full w-px bg-gray-200" />
                    </div>

                    <div className="min-w-0 flex-1 pb-2">
                      <div className="flex flex-col justify-between gap-1 sm:flex-row">
                        <h3 className="text-sm font-semibold text-gray-900">
                          {actionLabels[record.action]}
                        </h3>

                        <span className="text-xs text-gray-500">
                          {formatDate(record.createdAt)}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-gray-500">
                        By {record.admin?.fullName || "Unknown admin"}
                        {record.admin?.email
                          ? ` · ${record.admin.email}`
                          : ""}
                      </p>

                      {record.attendee && (
                        <p className="mt-2 text-xs text-gray-600">
                          Attendee: {record.attendee.fullName}
                          {" "}({record.attendee.attendeeType})
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-md bg-gray-100 px-2 py-1 text-gray-600">
                          {record.previousStatus}
                        </span>

                        <span className="text-gray-400">→</span>

                        <span className="rounded-md bg-gray-100 px-2 py-1 text-gray-700">
                          {record.newStatus}
                        </span>
                      </div>

                      {record.reason && (
                        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                          <p className="text-xs font-medium text-gray-600">
                            Reason / Instructions
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                            {record.reason}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Review Confirmation Dialog */}
      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">
              {pendingAction === "APPROVE_REGISTRATION" &&
                "Approve Registration"}

              {pendingAction === "REJECT_REGISTRATION" &&
                "Reject Registration"}

              {pendingAction === "REQUEST_CORRECTION" &&
                "Request Correction"}

              {pendingAction === "APPROVE_PARTNER_DOCUMENT" &&
                "Approve Partner Document"}

              {pendingAction === "REJECT_PARTNER_DOCUMENT" &&
                "Reject Partner Document"}
            </h2>

            <p className="mt-2 text-sm text-gray-500">
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
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  {pendingAction === "REQUEST_CORRECTION"
                    ? "Correction Instructions"
                    : "Reason"}
                  <span className="ml-1 text-red-500">*</span>
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
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                />

                <p className="mt-1 text-right text-xs text-gray-400">
                  {reason.length}/1000
                </p>
              </div>
            )}

            {actionError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
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
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={handleReviewSubmit}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
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
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-gray-500">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>

      <p className="break-all text-sm font-semibold text-gray-900">
        {value}
      </p>
    </div>
  );
}

function DetailItem({
  icon,
  label,
  value,
  valueClass = "text-gray-900",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 text-gray-500">
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
    <div className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-gray-100 p-3 text-gray-600">
          <UserRound size={18} />
        </div>

        <div>
          <p className="font-medium text-gray-900">
            {attendee.fullName}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {label}
            {attendee.title ? ` · ${attendee.title}` : ""}
          </p>
        </div>
      </div>

      <span className="w-fit rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600">
        {attendee.attendeeType}
      </span>
    </div>
  );
}
