"use client";

import { useState } from "react";
import { withBasePath } from "@/config/base-path";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, LoaderCircle, ChevronDown } from "lucide-react";

interface AdminHeaderProps {
  adminName: string;
  adminEmail: string;
}

const pageMetadata: Record<string, { title: string; description: string }> = {
  "/admin/dashboard": {
    title: "Dashboard",
    description: "Overview of event metrics and activity.",
  },
  "/admin/registrations": {
    title: "Registrations",
    description: "View and manage employee event registrations.",
  },
  "/admin/partner-verification": {
    title: "Partner Verification",
    description: "Review and manage partner identity documents.",
  },
  "/admin/qr-passes": {
    title: "QR Pass Management",
    description: "Manage attendee passes, eligibility and QR issuance.",
  },
  "/admin/staff": {
    title: "Staff Management",
    description: "Manage event staff accounts and access.",
  },
  "/admin/scanner/entry-records": {
    title: "Entry Scanner Records",
    description: "View and export entry verification scans.",
  },
  "/admin/scanner/food-records": {
    title: "Food Scanner Records",
    description: "View and export food collection scans.",
  },
  "/admin/settings": {
    title: "Settings",
    description: "Configure system preferences.",
  },
};

export default function AdminHeader({
  adminName,
  adminEmail,
}: AdminHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Find matching metadata for the current route
  const currentMeta = pageMetadata[pathname] || {
    title: "Admin Portal",
    description: "",
  };

  async function handleLogout() {
    setLoggingOut(true);

    try {
      const response = await fetch(withBasePath("/api/admin/logout"), {
        method: "POST",
      });

      if (!response.ok) throw new Error("Logout failed");

      router.replace("/admin-login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <header className="flex py-2 shrink-0 items-center justify-between border-b border-purple-200 bg-white px-6 lg:px-8">
      {/* Left Side: Dynamic Page Title & Description */}
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">
          {currentMeta.title}
        </h1>

        {currentMeta.description && (
          <p className=" text-xs font-medium text-slate-500">
            {currentMeta.description}
          </p>
        )}
      </div>

      {/* Right Controls: Notifications + Profile Quick Menu */}
      <div className="flex items-center gap-4">
        {/* Notification Bell Dropdown */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative flex h-9 w-9 items-center justify-center rounded-md border border-purple-200 bg-white text-slate-600 shadow-xs transition hover:bg-purple-50 hover:text-purple-800"
            aria-label="Notifications"
          >
            <Bell size={17} />

            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-purple-600 ring-2 ring-white" />
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-purple-200 bg-white p-4 shadow-xl animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between border-b border-purple-100 pb-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  Notifications
                </h3>

                <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-800">
                  1 New
                </span>
              </div>

              <div className="max-h-64 divide-y divide-purple-100 overflow-y-auto py-3">
                <div className="py-2.5 first:pt-0 last:pb-0">
                  <p className="text-sm font-semibold text-slate-800">
                    New partner registration submitted
                  </p>

                  <p className="mt-0.5 text-xs font-medium leading-relaxed text-slate-500">
                    Sanjay Singh submitted identity documents for review.
                  </p>

                  <span className="mt-1 block text-[11px] font-medium text-slate-400">
                    2 minutes ago
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Profile & Logout Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 rounded-md border border-purple-200 bg-white p-1.5 pr-3 text-left shadow-xs transition hover:bg-purple-50"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-purple-100 text-xs font-bold text-purple-800">
              {adminName.charAt(0).toUpperCase()}
            </div>

            <span className="hidden max-w-[120px] truncate text-sm font-semibold text-slate-800 sm:inline-block">
              {adminName}
            </span>

            <ChevronDown
              size={14}
              className="text-slate-500"
            />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-purple-200 bg-white p-1.5 shadow-xl animate-in fade-in slide-in-from-top-2">
              <div className="mb-1 border-b border-purple-100 px-3 py-2.5">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {adminName}
                </p>

                <p className="truncate text-xs font-medium text-slate-500">
                  {adminEmail}
                </p>
              </div>

              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                {loggingOut ? (
                  <LoaderCircle size={15} className="animate-spin" />
                ) : (
                  <LogOut size={15} />
                )}

                <span>
                  {loggingOut ? "Signing out..." : "Sign out"}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
