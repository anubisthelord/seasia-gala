import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { getCurrentAdmin } from "@/lib/auth/session";
import { withBasePath } from "@/config/base-path";
import ScannerHeader from "@/components/scanner/ScannerHeader";

export const instant = false;

export default async function EntryScannerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection();

  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect(withBasePath("/admin-login"));
  }

  if (admin.role !== "ENTRY_SCANNER") {
    if (
      admin.role === "SUPER_ADMIN" ||
      admin.role === "REGISTRATION_ADMIN"
    ) {
      redirect(withBasePath("/admin/dashboard"));
    }

    if (admin.role === "FOOD_SCANNER") {
      redirect(withBasePath("/food-scanner"));
    }

    redirect(withBasePath("/admin-login"));
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <ScannerHeader
        scannerType="ENTRY"
        adminName={admin.fullName}
        adminEmail={admin.email}
      />
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
            Loading scanner…
          </div>
        }
      >
        {children}
      </Suspense>
    </div>
  );
}
