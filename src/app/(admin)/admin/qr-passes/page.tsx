import { Suspense } from "react";
import QrPassesClient from "./qr-passes-client";

export default function QrPassesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
          Loading QR passes…
        </div>
      }
    >
      <QrPassesClient />
    </Suspense>
  );
}