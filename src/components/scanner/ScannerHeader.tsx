
"use client";

import { useState } from "react";
import { withBasePath } from "@/config/base-path";
import { Camera, LogOut, Loader2, Utensils } from "lucide-react";

interface ScannerHeaderProps {
  scannerType: "ENTRY" | "FOOD";
  adminName: string;
  adminEmail: string;
}

export default function ScannerHeader({
  scannerType,
  adminName,
  adminEmail,
}: ScannerHeaderProps) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  const isEntry = scannerType === "ENTRY";

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setError("");

    try {
      const response = await fetch(withBasePath("/api/admin/logout"), {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Logout failed. Please try again.");
      }

      window.location.replace(withBasePath("/admin-login"));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to log out."
      );
      setLoggingOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              isEntry
                ? "bg-emerald-100 text-emerald-700"
                : "bg-orange-100 text-orange-700"
            }`}
          >
            {isEntry ? <Camera size={21} /> : <Utensils size={21} />}
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">
              Seasia Gala Event
            </p>
            <p className="text-xs font-medium text-slate-500">
              {isEntry ? "Entry Scanner" : "Food Scanner"}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="max-w-40 truncate text-sm font-semibold text-slate-800">
              {adminName}
            </p>
            <p className="max-w-40 truncate text-xs text-slate-500">
              {adminEmail}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loggingOut ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <LogOut size={16} />
            )}
            <span className="hidden sm:inline">
              {loggingOut ? "Logging out..." : "Logout"}
            </span>
          </button>
        </div>
      </div>

      {error && (
        <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-center text-xs text-red-700">
          {error}
        </p>
      )}
    </header>
  );
}
