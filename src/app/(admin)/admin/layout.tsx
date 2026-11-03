import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { getCurrentAdmin } from "@/lib/auth/session";
import { withBasePath } from "@/config/base-path";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";

/**
 * The auth check and layout rendering happen inside this async
 * component. It is wrapped in <Suspense> below so Next.js 16's
 * cacheComponents can prerender the shell while this resolves.
 */
async function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();

  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect(withBasePath("/admin-login"));
  }

  if (
    admin.role !== "SUPER_ADMIN" &&
    admin.role !== "REGISTRATION_ADMIN"
  ) {
    if (admin.role === "ENTRY_SCANNER") {
      redirect(withBasePath("/entry-scanner"));
    }

    if (admin.role === "FOOD_SCANNER") {
      redirect(withBasePath("/food-scanner"));
    }

    redirect(withBasePath("/admin-login"));
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <AdminSidebar
        adminName={admin.fullName}
        adminEmail={admin.email}
        adminRole={admin.role}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader
          adminName={admin.fullName}
          adminEmail={admin.email}
        />

        <main className="flex-1 overflow-y-auto w-full bg-slate-50">
          <div className="p-5">
            {children}
          </div>
        </main>
      </div>

    </div>
  );
}

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-start justify-start bg-slate-50 text-sm text-slate-500">
          Loading admin portal…
        </div>
      }
    >
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
