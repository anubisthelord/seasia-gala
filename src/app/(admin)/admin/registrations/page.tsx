import { Suspense } from "react";
import RegistrationsClient from "./registrations-client";

export default function RegistrationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
          Loading registrations…
        </div>
      }
    >
      <RegistrationsClient />
    </Suspense>
  );
}