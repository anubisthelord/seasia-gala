import { Suspense } from "react";
import StaffClient from "./staff-client";

export default function StaffManagementPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
          Loading staff management…
        </div>
      }
    >
      <StaffClient />
    </Suspense>
  );
}