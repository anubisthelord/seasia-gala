import { Suspense } from "react";
import FoodScannerClient from "./food-scanner-client";

export default function FoodScannerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500">
          Loading scanner…
        </div>
      }
    >
      <FoodScannerClient />
    </Suspense>
  );
}