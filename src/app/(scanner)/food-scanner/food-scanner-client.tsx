"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  CameraOff,
  Loader2,
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
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
  attendees?: Array<{ fullName?: string; attendeeType?: "EMPLOYEE" | "PARTNER" }>;
};

export default function FoodScannerClient() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);
  const startingRef = useRef(false);
  const mountedRef = useRef(false);

  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;

    if (!scanner) {
      return;
    }

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch (err) {
      console.error("Unable to stop food scanner:", err);
    } finally {
      try {
        scanner.clear();
      } catch (err) {
        console.error("Unable to clear food scanner:", err);
      }

      if (scannerRef.current === scanner) {
        scannerRef.current = null;
      }
      if (mountedRef.current) setIsScanning(false);
    }
  }, []);

  const processScan = useCallback(async (token: string) => {
    if (processingRef.current) return;

    processingRef.current = true;
    setIsProcessing(true);
    setError("");

    await stopScanner();

    try {
      const data = await submitScannerToken(
        withBasePath("/api/scanner/food/check-in"),
        token
      );

      if (!mountedRef.current) return;

      setResult(data);
    } catch (err) {
      console.error("Food scan request failed:", err);

      if (mountedRef.current) {
        setError(
          err instanceof Error 
            ? err.message 
            : "Unable to connect to the server. Please check your connection and try again."
        );
      }
    } finally {
      processingRef.current = false;

      if (mountedRef.current) {
        setIsProcessing(false);
      }
    }
  }, [stopScanner]);

  const startScanner = useCallback(async () => {
    if (startingRef.current || processingRef.current || scannerRef.current?.isScanning) return;

    startingRef.current = true;
    setIsStarting(true);
    setError("");
    setResult(null);

    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("Live camera access requires opening this site over HTTPS on your phone.");
      }

      await stopScanner();
      if (!mountedRef.current) return;

      const scanner = new Html5Qrcode("food-qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
        (decodedText) => void processScan(decodedText.trim()),
        () => {}
      );

      if (mountedRef.current) setIsScanning(true);
      else await stopScanner();
    } catch (err) {
      await stopScanner();
      if (mountedRef.current) {
        console.error("Unable to start food live scanner:", err);
        setError(err instanceof Error ? err.message : "Unable to start the live camera. Check camera permissions and try again.");
      }
    } finally {
      startingRef.current = false;
      if (mountedRef.current) setIsStarting(false);
    }
  }, [processScan, stopScanner]);

  const scanNext = useCallback(() => {
    setResult(null);
    setError("");
    processingRef.current = false;
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      const scanner = scannerRef.current;
      scannerRef.current = null;

      if (scanner) {
        void (async () => {
          try {
            if (scanner.isScanning) {
              await scanner.stop();
            }

            scanner.clear();
          } catch (err) {
            console.error("Food scanner cleanup error:", err);
          }
        })();
      }
    };
  }, []);

  const isSuccess = result?.status === "COLLECTED";
  const isDuplicate = result?.status === "ALREADY_COLLECTED";

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-900">
              Scan Attendee QR Code
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Scan the event pass to record food collection for the listed attendee or couple.
            </p>
          </div>

          <div className="p-5">
            {!result && !error && (
              <>
                <div className="relative overflow-hidden rounded-xl bg-slate-950">
                  <div
                    id="food-qr-reader"
                    className="min-h-[300px] w-full overflow-hidden"
                  />

                  {!isScanning && !isProcessing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 px-6 text-center">
                      <CameraOff
                        size={42}
                        className="mb-3 text-slate-500"
                      />
                      <p className="font-medium text-white">
                        Camera is not active
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        Start the live scanner and point it at the QR code.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={() => void (isScanning ? stopScanner() : startScanner())}
                    disabled={isStarting || isProcessing}
                    className="flex min-h-12 flex-1 touch-manipulation items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3.5 font-semibold text-white transition hover:bg-orange-700 disabled:cursor-wait disabled:opacity-60"
                  >
                    {isStarting ? <Loader2 size={19} className="animate-spin" /> : isScanning ? <CameraOff size={19} /> : <Camera size={19} />}
                    {isStarting ? "Starting..." : isScanning ? "Stop Scanner" : "Start Live Scanner"}
                  </button>
                </div>
              </>
            )}

            {isProcessing && (
              <div className="flex flex-col items-center py-12 text-center">
                <Loader2
                  size={42}
                  className="animate-spin text-orange-600"
                />
                <p className="mt-4 font-semibold text-slate-900">
                  Verifying QR code...
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Please wait while the server validates this pass.
                </p>
              </div>
            )}

            {result && !isProcessing && (
              <div className="py-8 text-center">
                {isSuccess && (
                  <CheckCircle2
                    size={64}
                    className="mx-auto text-green-600"
                  />
                )}

                {isDuplicate && (
                  <AlertTriangle
                    size={64}
                    className="mx-auto text-amber-500"
                  />
                )}

                {!isSuccess && !isDuplicate && (
                  <XCircle
                    size={64}
                    className="mx-auto text-red-600"
                  />
                )}

                <h3 className="mt-4 text-xl font-bold text-slate-900">
                  {result.message ||
                    (isSuccess
                      ? "Food collection recorded"
                      : isDuplicate
                        ? "Food already collected"
                        : "Unable to process QR code")}
                </h3>

                {result.attendees?.length ? (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pass covers</p>
                    <div className="mt-2 space-y-1">
                      {result.attendees.map((attendee) => <p key={`${attendee.attendeeType}-${attendee.fullName}`} className="text-sm font-semibold text-slate-900">{attendee.attendeeType === "EMPLOYEE" ? "Employee" : "Partner"}: {attendee.fullName}</p>)}
                    </div>
                  </div>
                ) : result.attendee?.fullName && (
                  <div className="mx-auto mt-4 max-w-sm rounded-xl bg-slate-50 p-4 text-left">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Attendee
                    </p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {result.attendee.fullName}
                    </p>
                    {result.attendee.attendeeType && (
                      <p className="mt-1 text-sm text-slate-500">
                        {result.attendee.attendeeType === "EMPLOYEE"
                          ? "Employee"
                          : "Partner"}
                      </p>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={scanNext}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3.5 font-semibold text-white transition hover:bg-slate-800"
                >
                  <RefreshCw size={18} />
                  Scan Next Attendee
                </button>
              </div>
            )}

            {error && !isProcessing && (
              <div className="py-8 text-center">
                <AlertTriangle
                  size={52}
                  className="mx-auto text-amber-500"
                />
                <h3 className="mt-4 font-semibold text-slate-900">
                  Scanner Error
                </h3>
                <p className="mt-2 text-sm text-slate-600">{error}</p>

                <button
                  type="button"
                  onClick={() => {
                    void stopScanner().then(() => {
                      setError("");
                      setResult(null);
                    });
                  }}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800"
                >
                  <RefreshCw size={18} />
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-orange-200 bg-orange-50 p-4">
          <h3 className="font-semibold text-orange-900">
            Scanner Instructions
          </h3>
          <ul className="mt-2 space-y-2 text-sm text-orange-900/80">
            <li>• Scan one attendee QR code at a time.</li>
            <li>• A successful scan records food collection only once.</li>
            <li>• Duplicate food collections will be flagged.</li>
            <li>• An active internet connection is required.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
