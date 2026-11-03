"use client";

import { useEffect, useState } from "react";
import { Download, QrCode } from "lucide-react";

interface DownloadPayload {
  imageDataUrl: string;
  fileName: string;
}

export default function DownloadQrPage() {
  const [payload, setPayload] = useState<DownloadPayload | null>(null);
  const [message, setMessage] = useState("Preparing your QR code download...");

  function downloadImage(data: DownloadPayload) {
    const link = document.createElement("a");
    link.href = data.imageDataUrl;
    link.download = data.fileName || "Seasia-Gala-QR.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  useEffect(() => {
    const stored = sessionStorage.getItem("seasia-gala-qr-download");
    if (!stored) {
      setMessage("QR code details were not found. Return to registration and try again.");
      return;
    }

    try {
      const data = JSON.parse(stored) as DownloadPayload;
      if (!data.imageDataUrl?.startsWith("data:image/svg+xml;")) {
        throw new Error("Invalid ticket image");
      }

      setPayload(data);
      setMessage("Your complete ticket image is ready. The download should start automatically.");
      downloadImage(data);
    } catch {
      sessionStorage.removeItem("seasia-gala-qr-download");
        setMessage("Unable to prepare the ticket image. Return to registration and try again.");
    }
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          <QrCode size={27} />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-slate-900">Your Event Ticket</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>

        {payload && (
          <>
            <img
              src={payload.imageDataUrl}
              alt="Complete Seasia Gala event ticket"
              className="mx-auto mt-6 h-auto max-h-[560px] w-full max-w-[420px] rounded-lg border border-slate-200"
            />
            <button
              type="button"
              onClick={() => downloadImage(payload)}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
            >
              <Download size={16} />
              Download Full Ticket Image
            </button>
          </>
        )}
      </section>
    </main>
  );
}
