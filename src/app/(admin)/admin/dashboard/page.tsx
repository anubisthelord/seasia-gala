import Link from "next/link";
import {
  Users,
  FileCheck,
  QrCode,
  ScanLine,
  Utensils,
  ShieldCheck,
  ArrowUpRight,
  LayoutDashboard,
  Activity,
} from "lucide-react";

const dashboardModules = [
  {
    title: "Registrations",
    description: "View employee registrations and manage approval requests.",
    href: "/admin/registrations",
    icon: Users,
    iconClass: "bg-blue-50 text-blue-600",
    group: "Core",
  },
  {
    title: "Partner Verification",
    description: "Review and verify uploaded partner documents.",
    href: "/admin/partner-verification",
    icon: FileCheck,
    iconClass: "bg-emerald-50 text-emerald-600",
    group: "Core",
  },
  {
    title: "QR Passes",
    description: "Generate, view and manage attendee QR passes.",
    href: "/admin/qr-passes",
    icon: QrCode,
    iconClass: "bg-purple-50 text-purple-600",
    group: "Core",
  },
  {
    title: "Entry Scanner Records",
    description: "View entry check-in activity and scan reports.",
    href: "/admin/scanner/entry-records",
    icon: ScanLine,
    iconClass: "bg-amber-50 text-amber-600",
    group: "Operations",
  },
  {
    title: "Food Scanner Records",
    description: "View food collection activity and scan reports.",
    href: "/admin/scanner/food-records",
    icon: Utensils,
    iconClass: "bg-orange-50 text-orange-600",
    group: "Operations",
  },
  {
    title: "Staff Management",
    description: "Manage admin and scanner staff accounts.",
    href: "/admin/staff",
    icon: ShieldCheck,
    iconClass: "bg-slate-100 text-slate-600",
    group: "Management",
  },
];

const groups = ["Core", "Operations", "Management"] as const;

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-slate-900 text-white">
              <LayoutDashboard size={15} />
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">
              Admin Dashboard
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Central control panel for event operations and management.
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 self-start rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 sm:self-auto">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          System operational
        </div>
      </div>

      {/* Module groups */}
      <div className="space-y-5">
        {groups.map((group) => {
          const modules = dashboardModules.filter((m) => m.group === group);
          if (modules.length === 0) return null;

          return (
            <div key={group}>
              <div className="mb-2 flex items-center gap-2">
                <Activity size={13} className="text-slate-400" />
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {group}
                </h2>
                <span className="text-[11px] text-slate-400">
                  · {modules.length} {modules.length === 1 ? "module" : "modules"}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {modules.map((module) => {
                  const Icon = module.icon;

                  return (
                    <Link
                      key={module.href}
                      href={module.href}
                      className="group relative flex flex-col rounded-md border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:bg-slate-50/50"
                    >
                      <div className="flex items-start justify-between">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded ${module.iconClass}`}
                        >
                          <Icon size={17} />
                        </div>

                        <ArrowUpRight
                          size={15}
                          className="text-slate-300 transition group-hover:text-slate-900"
                        />
                      </div>

                      <h3 className="mt-3 text-sm font-semibold text-slate-900">
                        {module.title}
                      </h3>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {module.description}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        Tip: Use{" "}
        <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
          ⌘K
        </kbd>{" "}
        to jump to any module quickly (coming soon).
      </div>
    </div>
  );
}