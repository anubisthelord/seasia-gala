"use client";

import { useState } from "react";
import { withBasePath } from "@/config/base-path";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Ticket,
  ScanLine,
  Utensils,
  Settings,
  LogOut,
  LoaderCircle,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

type AdminRole =
  | "SUPER_ADMIN"
  | "REGISTRATION_ADMIN"
  | "ENTRY_SCANNER"
  | "FOOD_SCANNER";

interface AdminSidebarProps {
  adminName: string;
  adminEmail: string;
  adminRole: AdminRole;
}

const roleLabels: Record<AdminRole, string> = {
  SUPER_ADMIN: "Super Admin",
  REGISTRATION_ADMIN: "Registration Admin",
  ENTRY_SCANNER: "Entry Scanner",
  FOOD_SCANNER: "Food Scanner",
};

const navigation = [
  {
    label: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
    roles: ["SUPER_ADMIN", "REGISTRATION_ADMIN"],
    section: "Overview",
  },
  {
    label: "Registrations",
    href: "/admin/registrations",
    icon: Users,
    roles: ["SUPER_ADMIN", "REGISTRATION_ADMIN"],
    section: "Operations",
  },
  {
    label: "Partner Verification",
    href: "/admin/partner-verification",
    icon: ShieldCheck,
    roles: ["SUPER_ADMIN", "REGISTRATION_ADMIN"],
    section: "Operations",
  },
  {
    label: "QR Passes",
    href: "/admin/qr-passes",
    icon: Ticket,
    roles: ["SUPER_ADMIN", "REGISTRATION_ADMIN"],
    section: "Operations",
  },
  {
    label: "Entry Records",
    href: "/admin/scanner/entry-records",
    icon: ScanLine,
    roles: ["SUPER_ADMIN", "REGISTRATION_ADMIN"],
    section: "Scanners",
  },
  {
    label: "Food Records",
    href: "/admin/scanner/food-records",
    icon: Utensils,
    roles: ["SUPER_ADMIN", "REGISTRATION_ADMIN"],
    section: "Scanners",
  },
  {
    label: "Staff Management",
    href: "/admin/staff",
    icon: ShieldAlert,
    roles: ["SUPER_ADMIN"],
    section: "Administration",
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
    roles: ["SUPER_ADMIN"],
    section: "Administration",
    available: false,
  },
] as const;

export default function AdminSidebar({
  adminName,
  adminEmail,
  adminRole,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  const visibleNavigation = navigation.filter((item) =>
    (item.roles as readonly AdminRole[]).includes(adminRole)
  );

  // Group items by section
  const sections = Array.from(
    new Set(visibleNavigation.map((i) => i.section))
  );

  async function handleLogout() {
    setLoggingOut(true);
    setError("");

    try {
      const response = await fetch(withBasePath("/api/admin/logout"), {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Logout failed. Please try again.");
      }

      router.replace("/admin-login");
      router.refresh();
    } catch {
      setError("Unable to log out. Please try again.");
      setLoggingOut(false);
    }
  }

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-purple-200 bg-[#f8f5fc] text-slate-900 select-none">
      {/* Brand Header */}
      <div className="flex h-16 shrink-0 items-center gap-3 px-5 border-b border-purple-200 bg-white/80">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-purple-600 text-white shadow-xs shadow-purple-200">
          <ShieldCheck size={18} />
        </div>

        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-wide text-slate-900">
            Event Admin
          </span>
          <span className="text-xs font-medium text-purple-700">
            Management Portal
          </span>
        </div>
      </div>

      {/* Navigation Links Area */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {sections.map((sectionName) => {
          const sectionItems = visibleNavigation.filter(
            (item) => item.section === sectionName
          );

          return (
            <div key={sectionName} className="space-y-1">
              <p className="px-3 text-xs font-semibold uppercase  text-purple-700 mb-2">
                {sectionName}
              </p>

              {sectionItems.map((item) => {
                const Icon = item.icon;

                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);

                if ("available" in item && item.available === false) {
                  return (
                    <div
                      key={item.href}
                      title="Coming soon"
                      className="group flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-500 bg-purple-100/40"
                    >
                      <Icon size={16} className="text-slate-500" />

                      <span className="flex-1 font-medium">
                        {item.label}
                      </span>

                      <span className="rounded bg-purple-200 px-1.5 py-0.5 text-[10px] font-semibold text-purple-800 uppercase">
                        Soon
                      </span>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-150 ${active
                        ? "bg-purple-200/90 text-purple-950 font-semibold shadow-xs"
                        : "text-slate-700 font-medium hover:bg-purple-100/70 hover:text-slate-900"
                      }`}
                  >
                    <Icon
                      size={16}
                      className={`transition-colors ${active
                          ? "text-purple-800"
                          : "text-slate-500 group-hover:text-slate-700"
                        }`}
                    />

                    <span className="flex-1">{item.label}</span>

                    {active && (
                      <div className="absolute right-2 h-1.5 w-1.5 rounded-full bg-purple-700" />
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* User Footer Profile & Logout */}
      <div className="shrink-0 border-t border-purple-200 p-3 bg-white/60">
        {/* <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-purple-700">
            Role
          </span>

          <span className="inline-flex items-center rounded-md bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800 border border-purple-200">
            {roleLabels[adminRole]}
          </span>
        </div>
        <div className="my-3 flex items-center gap-3 rounded-md bg-white p-2.5 border border-purple-200 shadow-xs">
          <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-purple-100 text-purple-800 font-bold text-xs">
            {adminName.charAt(0).toUpperCase()}

            <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">
              {adminName}
            </p>

            <p className="truncate text-xs font-medium text-slate-500">
              {adminEmail}
            </p>
          </div>
        </div> */}



        {error && (
          <p
            role="alert"
            className="mb-2 text-xs text-red-600 font-medium px-1"
          >
            {error}
          </p>
        )}

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-purple-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-xs transition hover:bg-red-50 hover:border-red-200 hover:text-red-600 disabled:opacity-60"
        >
          {loggingOut ? (
            <LoaderCircle
              size={14}
              className="animate-spin text-red-600"
            />
          ) : (
            <LogOut
              size={14}
              className="text-slate-500 group-hover:text-red-600"
            />
          )}

          <span>{loggingOut ? "Signing out..." : "Sign out"}</span>
        </button>
      </div>
    </aside>
  );
}
