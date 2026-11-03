import { Suspense } from "react";
import EntryScannerClient from "./entry-scanner-client";

export default function EntryScannerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-400">
          Loading scanner…
        </div>
      }
    >
      <EntryScannerClient />
    </Suspense>
  );
}