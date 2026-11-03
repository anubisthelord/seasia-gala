import { Suspense } from "react";
import PartnerVerificationClient from "./partner-verification-client";

export default function PartnerVerificationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
          Loading partner verification records…
        </div>
      }
    >
      <PartnerVerificationClient />
    </Suspense>
  );
}