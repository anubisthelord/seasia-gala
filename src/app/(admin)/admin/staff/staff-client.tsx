"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Search,
  RefreshCw,
  UserPlus,
  ShieldCheck,
  UserCheck,
  UserX,
  ScanLine,
  Utensils,
  Loader2,
  X,
  Mail,
  Lock,
  UserRound,
  Phone,
  Edit2,
  CheckCircle2,
  Eye,
} from "lucide-react";

// 👇 Import the reusable molecule
import { StatCard } from "@/components/molecules/StatCard";
import { withBasePath } from "@/config/base-path";

type StaffRole =
  | "SUPER_ADMIN"
  | "REGISTRATION_ADMIN"
  | "ENTRY_SCANNER"
  | "FOOD_SCANNER";

type StaffMember = {
  _id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  role: StaffRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

type FormState = {
  fullName: string;
  email: string;
  phoneNumber: string;
  password?: string;
  role: StaffRole;
};

const initialFormState: FormState = {
  fullName: "",
  email: "",
  phoneNumber: "",
  password: "",
  role: "REGISTRATION_ADMIN",
};

const roleBadgeStyles: Record<StaffRole, string> = {
  SUPER_ADMIN: "bg-slate-900 text-white ring-slate-900/20",
  REGISTRATION_ADMIN: "bg-blue-50 text-blue-700 ring-blue-600/20",
  ENTRY_SCANNER: "bg-purple-50 text-purple-700 ring-purple-600/20",
  FOOD_SCANNER: "bg-orange-50 text-orange-700 ring-orange-600/20",
};

export default function StaffClient() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"CREATE" | "EDIT">("CREATE");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [viewingMember, setViewingMember] = useState<StaffMember | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");
  const [formData, setFormData] = useState<FormState>(initialFormState);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [processingId, setProcessingId] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(withBasePath("/api/admin/staff"), { cache: "no-store" });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Server error (${response.status}). API route crashed.`);
      }

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to load staff list.");
      }

      setStaff(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load staff.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleToggleStatus = async (member: StaffMember) => {
    if (member.role === "SUPER_ADMIN") {
      alert("Super Admin accounts cannot be deactivated.");
      return;
    }

    const actionText = member.isActive ? "deactivate" : "activate";
    if (
      !window.confirm(
        `Are you sure you want to ${actionText} this staff account?`
      )
    ) {
      return;
    }

    setProcessingId(member._id);
    setError("");

    try {
      const response = await fetch(withBasePath(`/api/admin/staff/${member._id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !member.isActive }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to update status.");
      }

      showSuccess(
        `Account ${member.isActive ? "deactivated" : "activated"} successfully.`
      );
      await fetchStaff();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setProcessingId(null);
    }
  };

  const validateForm = (isEdit: boolean) => {
    const errors: Record<string, string> = {};

    if (!formData.fullName.trim()) errors.fullName = "Full name is required.";

    if (!formData.email.trim()) {
      errors.email = "Email is required.";
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      errors.email = "Enter a valid email address.";
    }

    if (!formData.phoneNumber.trim()) {
      errors.phoneNumber = "Mobile number is required.";
    } else if (!/^[6-9]\d{9}$/.test(formData.phoneNumber)) {
      errors.phoneNumber = "Must be exactly 10 digits starting with 6-9.";
    }

    if (!isEdit && (!formData.password || formData.password.length < 8)) {
      errors.password = "Password must be at least 8 characters.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm(modalMode === "EDIT")) return;

    setIsSubmitting(true);
    setModalError("");

    try {
      const isEdit = modalMode === "EDIT";
      const url = withBasePath(isEdit ? `/api/admin/staff/${editingId}` : "/api/admin/staff");
      const method = isEdit ? "PATCH" : "POST";

      let payload: any = {};

      if (isEdit) {
        const original = staff.find((s) => s._id === editingId);

        if (formData.fullName.trim() !== original?.fullName) {
          payload.fullName = formData.fullName.trim();
        }
        if (formData.email.trim() !== original?.email) {
          payload.email = formData.email.trim();
        }

        const originalPhone = original?.phoneNumber || "";
        if (formData.phoneNumber.trim() !== originalPhone) {
          payload.phoneNumber = formData.phoneNumber.trim();
        }

        if (formData.role !== original?.role) {
          payload.role = formData.role;
        }

        if (Object.keys(payload).length === 0) {
          setIsModalOpen(false);
          setIsSubmitting(false);
          return;
        }
      } else {
        payload = {
          fullName: formData.fullName.trim(),
          email: formData.email.trim(),
          phoneNumber: formData.phoneNumber.trim(),
          role: formData.role,
          password: formData.password,
        };
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Server error (${response.status}).`);
      }

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || `Failed to ${isEdit ? "update" : "create"} staff.`
        );
      }

      setIsModalOpen(false);
      setFormData(initialFormState);
      setEditingId(null);

      showSuccess(
        isEdit
          ? "Staff details updated successfully."
          : "Staff member created successfully."
      );
      await fetchStaff();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCreateModal = () => {
    setFormData(initialFormState);
    setFieldErrors({});
    setModalError("");
    setModalMode("CREATE");
    setIsModalOpen(true);
  };

  const openEditModal = (member: StaffMember) => {
    setFormData({
      fullName: member.fullName,
      email: member.email,
      phoneNumber: member.phoneNumber ? String(member.phoneNumber) : "",
      role: member.role,
      password: "",
    });
    setFieldErrors({});
    setModalError("");
    setEditingId(member._id);
    setModalMode("EDIT");
    setIsModalOpen(true);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const getRoleBadge = (role: StaffRole) => {
    return (
      <span
        className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
          roleBadgeStyles[role] || "bg-slate-100 text-slate-600 ring-slate-500/20"
        }`}
      >
        {role === "SUPER_ADMIN" && <ShieldCheck size={12} />}
        {role.replaceAll("_", " ")}
      </span>
    );
  };

  const filteredStaff = staff.filter((member) => {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      member.fullName.toLowerCase().includes(searchLower) ||
      member.email.toLowerCase().includes(searchLower) ||
      (member.phoneNumber && member.phoneNumber.includes(searchLower));

    const matchesRole = roleFilter === "ALL" || member.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const stats = {
    total: staff.length,
    registration: staff.filter((s) => s.role === "REGISTRATION_ADMIN").length,
    entry: staff.filter((s) => s.role === "ENTRY_SCANNER").length,
    food: staff.filter((s) => s.role === "FOOD_SCANNER").length,
  };

  return (
    <div className="space-y-4">
      {/* Notifications */}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Staff"
          value={stats.total}
          icon={UserRound}
          iconClass="bg-slate-100 text-slate-600"
        />
        <StatCard
          label="Registration Admins"
          value={stats.registration}
          icon={UserCheck}
          iconClass="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Entry Scanners"
          value={stats.entry}
          icon={ScanLine}
          iconClass="bg-purple-50 text-purple-600"
        />
        <StatCard
          label="Food Scanners"
          value={stats.food}
          icon={Utensils}
          iconClass="bg-orange-50 text-orange-600"
        />
      </div>

      {/* Listing */}
      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        {/* Header + Filters */}
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Staff Members
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {filteredStaff.length} of {staff.length} shown
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={fetchStaff}
                disabled={loading}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw
                  size={14}
                  className={loading ? "animate-spin" : ""}
                />
                Refresh
              </button>

              <button
                onClick={openCreateModal}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-slate-900 px-3 text-xs font-medium text-white transition hover:bg-slate-800"
              >
                <UserPlus size={14} />
                Create Staff
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
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email or mobile..."
                className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            >
              <option value="ALL">All roles</option>
              <option value="REGISTRATION_ADMIN">Registration Admin</option>
              <option value="ENTRY_SCANNER">Entry Scanner</option>
              <option value="FOOD_SCANNER">Food Scanner</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Staff
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Role
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Status
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Last Login
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Created
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
                    <Loader2
                      size={22}
                      className="mx-auto animate-spin text-slate-400"
                    />
                    <p className="mt-2 text-sm text-slate-500">
                      Loading staff data...
                    </p>
                  </td>
                </tr>
              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <UserRound size={26} className="mx-auto text-slate-300" />
                    <p className="mt-2 text-sm font-medium text-slate-700">
                      No staff members found
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Try adjusting your search or role filter.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredStaff.map((member) => (
                  <tr
                    key={member._id}
                    className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-slate-100 text-xs font-semibold text-slate-600">
                          {member.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {member.fullName}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {member.email}
                          </p>
                          {member.phoneNumber && (
                            <p className="text-xs text-slate-400">
                              {member.phoneNumber}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{getRoleBadge(member.role)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                          member.isActive
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                            : "bg-red-50 text-red-700 ring-red-600/20"
                        }`}
                      >
                        {member.isActive ? (
                          <UserCheck size={12} />
                        ) : (
                          <UserX size={12} />
                        )}
                        {member.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                      {formatDate(member.lastLoginAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                      {formatDate(member.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewingMember(member)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>

                        <button
                          onClick={() => openEditModal(member)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                          title="Edit Staff"
                        >
                          <Edit2 size={14} />
                        </button>

                        <button
                          onClick={() => handleToggleStatus(member)}
                          disabled={
                            member.role === "SUPER_ADMIN" ||
                            processingId === member._id
                          }
                          className={`inline-flex h-8 items-center justify-center rounded border px-2.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                            member.isActive
                              ? "border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          }`}
                        >
                          {processingId === member._id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : member.isActive ? (
                            "Deactivate"
                          ) : (
                            "Activate"
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Staff Details Modal */}
      {viewingMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setViewingMember(null)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-md bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">
                Staff Details
              </h2>
              <button
                onClick={() => setViewingMember(null)}
                className="rounded p-1.5 text-slate-400 transition hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded bg-slate-100 text-lg font-semibold text-slate-600">
                  {viewingMember.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-slate-900">
                    {viewingMember.fullName}
                  </h3>
                  <p className="truncate text-xs text-slate-500">
                    {viewingMember.email}
                  </p>
                  <div className="mt-1.5">
                    {getRoleBadge(viewingMember.role)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </p>
                  <p
                    className={`mt-1 flex items-center gap-1 text-sm font-medium ${
                      viewingMember.isActive
                        ? "text-emerald-600"
                        : "text-red-600"
                    }`}
                  >
                    {viewingMember.isActive ? (
                      <UserCheck size={13} />
                    ) : (
                      <UserX size={13} />
                    )}
                    {viewingMember.isActive ? "Active" : "Inactive"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Mobile
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {viewingMember.phoneNumber || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Created On
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-900">
                    {formatDate(viewingMember.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Last Login
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-900">
                    {formatDate(viewingMember.lastLoginAt)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-200 px-4 py-2.5">
              <button
                onClick={() => setViewingMember(null)}
                className="h-8 rounded bg-slate-900 px-3 text-xs font-medium text-white transition hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Staff Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-md bg-white shadow-xl my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">
                {modalMode === "CREATE"
                  ? "Create Staff Member"
                  : "Edit Staff Member"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded p-1.5 text-slate-400 transition hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} noValidate className="p-4">
              {modalError && (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {modalError}
                </div>
              )}

              <div className="space-y-3.5">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Full Name
                  </label>
                  <div className="relative">
                    <UserRound
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => {
                        setFormData({ ...formData, fullName: e.target.value });
                        if (fieldErrors.fullName)
                          setFieldErrors({ ...fieldErrors, fullName: "" });
                      }}
                      className={`h-9 w-full rounded-md border pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-slate-100 ${
                        fieldErrors.fullName
                          ? "border-red-400 bg-red-50 focus:border-red-500"
                          : "border-slate-200 bg-white focus:border-slate-400"
                      }`}
                      placeholder="John Doe"
                    />
                  </div>
                  {fieldErrors.fullName && (
                    <p className="mt-1 text-xs font-medium text-red-600">
                      {fieldErrors.fullName}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({ ...formData, email: e.target.value });
                        if (fieldErrors.email)
                          setFieldErrors({ ...fieldErrors, email: "" });
                      }}
                      className={`h-9 w-full rounded-md border pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-slate-100 ${
                        fieldErrors.email
                          ? "border-red-400 bg-red-50 focus:border-red-500"
                          : "border-slate-200 bg-white focus:border-slate-400"
                      }`}
                      placeholder="john@company.com"
                    />
                  </div>
                  {fieldErrors.email && (
                    <p className="mt-1 text-xs font-medium text-red-600">
                      {fieldErrors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Mobile Number
                  </label>
                  <div className="relative">
                    <Phone
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={(e) => {
                        const val = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 10);
                        setFormData({ ...formData, phoneNumber: val });
                        if (fieldErrors.phoneNumber)
                          setFieldErrors({ ...fieldErrors, phoneNumber: "" });
                      }}
                      className={`h-9 w-full rounded-md border pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-slate-100 ${
                        fieldErrors.phoneNumber
                          ? "border-red-400 bg-red-50 focus:border-red-500"
                          : "border-slate-200 bg-white focus:border-slate-400"
                      }`}
                      placeholder="9876543210"
                    />
                  </div>
                  {fieldErrors.phoneNumber && (
                    <p className="mt-1 text-xs font-medium text-red-600">
                      {fieldErrors.phoneNumber}
                    </p>
                  )}
                </div>

                {modalMode === "CREATE" && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Password
                    </label>
                    <div className="relative">
                      <Lock
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            password: e.target.value,
                          });
                          if (fieldErrors.password)
                            setFieldErrors({ ...fieldErrors, password: "" });
                        }}
                        className={`h-9 w-full rounded-md border pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-slate-100 ${
                          fieldErrors.password
                            ? "border-red-400 bg-red-50 focus:border-red-500"
                            : "border-slate-200 bg-white focus:border-slate-400"
                        }`}
                        placeholder="••••••••"
                      />
                    </div>
                    {fieldErrors.password && (
                      <p className="mt-1 text-xs font-medium text-red-600">
                        {fieldErrors.password}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        role: e.target.value as StaffRole,
                      })
                    }
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  >
                    <option value="REGISTRATION_ADMIN">
                      Registration Admin
                    </option>
                    <option value="ENTRY_SCANNER">Entry Scanner</option>
                    <option value="FOOD_SCANNER">Food Scanner</option>
                  </select>
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="h-9 rounded-md border border-slate-200 px-3.5 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-slate-900 px-3.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSubmitting && (
                    <Loader2 size={14} className="animate-spin" />
                  )}
                  {isSubmitting
                    ? modalMode === "CREATE"
                      ? "Creating..."
                      : "Saving..."
                    : modalMode === "CREATE"
                      ? "Create Staff"
                      : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
