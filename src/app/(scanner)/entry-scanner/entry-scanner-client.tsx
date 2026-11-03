"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Html5Qrcode,
  Html5QrcodeScannerState,
} from "html5-qrcode";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ScanLine,
  User,
} from "lucide-react";
import { submitScannerToken } from "@/lib/scanner/scan-request";
import { withBasePath } from "@/config/base-path";

type ScanResult = {
  success: boolean;
  status: string;
  message: string;
  attendee?: {
    fullName?: string;
    attendeeType?: "EMPLOYEE" | "PARTNER";
  };
};

export default function EntryScannerClient() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const mountedRef = useRef(false);

  const [isScanning, setIsScanning] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;

    if (!scanner) {
      return;
    }

    try {
      const state = scanner.getState();

      if (state === Html5QrcodeScannerState.SCANNING) {
        await scanner.stop();
      }
    } catch (err) {
      console.error("Unable to stop scanner:", err);
    } finally {
      if (mountedRef.current) setIsScanning(false);
    }
  }, []);

  const handleScan = useCallback(
    async (decodedText: string) => {
      if (isProcessingRef.current) return;

      isProcessingRef.current = true;
      setIsLoading(true);
      setError("");

      await stopScanner();

      try {
        const data = await submitScannerToken(
          withBasePath("/api/scanner/entry/check-in"),
          decodedText.trim()
        );

        if (mountedRef.current) {
          setResult(data);
        }
      } catch (err) {
        console.error("Check-in request failed:", err);
        if (mountedRef.current) {
          setError(
            err instanceof Error 
              ? err.message 
              : "Unable to connect to the server. Please check your internet connection."
          );
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [stopScanner]
  );

  const startScanner = useCallback(async () => {
    if (isStartingRef.current || isScanning || isProcessingRef.current) return;

    isStartingRef.current = true;
    setIsStarting(true);
    setError("");
    setResult(null);

    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("Live camera access requires opening this site over HTTPS on your phone.");
      }

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("entry-qr-reader", {
          verbose: false,
        });
      }

      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
        (decodedText) => void handleScan(decodedText),
        () => {}
      );

      if (mountedRef.current) setIsScanning(true);
    } catch (err) {
      if (mountedRef.current) {
        console.error("Unable to start entry camera:", err);
        setError(err instanceof Error ? err.message : "Unable to start the live camera. Check camera permissions and try again.");
      }
    } finally {
      isStartingRef.current = false;
      if (mountedRef.current) setIsStarting(false);
    }
  }, [handleScan, isScanning]);

  const resetScanner = useCallback(async () => {
    isProcessingRef.current = false;
    setResult(null);
    setError("");
    await startScanner();
  }, [startScanner]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      const scanner = scannerRef.current;
      scannerRef.current = null;

      if (scanner) {
        void (async () => {
          try {
            if (
              scanner.getState() === Html5QrcodeScannerState.SCANNING
            ) {
              await scanner.stop();
            }

            scanner.clear();
          } catch (err) {
            console.error("Scanner cleanup error:", err);
          }
        })();
      }
    };
  }, []);

  const isSuccess = result?.status === "CHECKED_IN";
  const isDuplicate = result?.status === "ALREADY_CHECKED_IN";

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto max-w-xl px-4 py-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-400">
            <ScanLine size={28} />
          </div>

          <h1 className="text-2xl font-bold">Scan Entry Pass</h1>

          <p className="mt-2 text-sm text-slate-400">
            Scan the attendee&apos;s QR code to verify event entry.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900 p-4">
          <div className="relative min-h-[300px] overflow-hidden rounded-xl bg-black">
            <div
              id="entry-qr-reader"
              className="min-h-[300px] w-full"
            />

            {!isScanning && !isLoading && !result && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950">
                <CameraOff
                  size={42}
                  className="mb-4 text-slate-500"
                />
                <p className="text-sm text-slate-300">
                  Camera is not active
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Start the live scanner and point it at the QR code
                </p>
              </div>
            )}

            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95">
                <RefreshCw
                  size={36}
                  className="animate-spin text-emerald-400"
                />
                <p className="mt-4 text-sm font-medium">
                  Verifying QR pass...
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
              <AlertTriangle size={19} className="mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {!result && !isLoading && !error && (
            <button
              type="button"
              onClick={() => void (isScanning ? stopScanner() : startScanner())}
              disabled={isStarting}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3.5 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60"
            >
              {isStarting ? <RefreshCw size={19} className="animate-spin" /> : isScanning ? <CameraOff size={19} /> : <Camera size={19} />}
              {isStarting ? "Starting camera..." : isScanning ? "Stop Live Scanner" : "Start Live Scanner"}
            </button>
          )}

        </div>

        {result && (
          <div
            className={`mt-5 overflow-hidden rounded-2xl border ${
              isSuccess
                ? "border-emerald-400/30 bg-emerald-400/10"
                : isDuplicate
                  ? "border-amber-400/30 bg-amber-400/10"
                  : "border-red-400/30 bg-red-400/10"
            }`}
          >
            <div className="p-5 text-center">
              {isSuccess ? (
                <CheckCircle2
                  size={54}
                  className="mx-auto mb-3 text-emerald-400"
                />
              ) : isDuplicate ? (
                <AlertTriangle
                  size={54}
                  className="mx-auto mb-3 text-amber-400"
                />
              ) : (
                <XCircle
                  size={54}
                  className="mx-auto mb-3 text-red-400"
                />
              )}

              <h2 className="text-xl font-bold">
                {isSuccess
                  ? "Entry Approved"
                  : isDuplicate
                    ? "Already Checked In"
                    : "Entry Denied"}
              </h2>

              <p className="mt-2 text-sm text-slate-300">
                {result.message}
              </p>
            </div>

            {result.attendee && (
              <div className="border-t border-white/10 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
                    <User size={21} />
                  </div>

                  <div>
                    <p className="font-semibold">
                      {result.attendee.fullName || "Unknown attendee"}
                    </p>

                    <p className="text-xs text-slate-400">
                      {result.attendee.attendeeType === "PARTNER"
                        ? "Partner"
                        : "Employee"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {(result || error) && !isLoading && (
          <button
            type="button"
            onClick={() => void resetScanner()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 font-semibold text-slate-950 transition hover:bg-slate-200"
          >
            <RefreshCw size={18} />
            Scan Next Attendee
          </button>
        )}

        <p className="mt-6 text-center text-xs text-slate-500">
          Authorized event staff only. Every attendee can enter once.
        </p>
      </section>
    </main>
  );
}
