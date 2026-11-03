
interface ExportScanRecord {
    attendeeName?: string | null;
    employeeId?: string | null;
    attendeeType?: string | null;
    result: string;
    message: string;
    scannedAt: Date | string;
    scannedBy?: {
      fullName?: string;
      email?: string;
    } | null;
  }
  
  function escapeCSV(value: unknown): string {
    let text = String(value ?? "");
  
    // Prevent spreadsheet formula injection.
    if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) {
      text = `'${text}`;
    }
  
    return `"${text.replace(/"/g, '""')}"`;
  }
  
  function formatScannedAt(value: Date | string): string {
    const date = new Date(value);
  
    if (Number.isNaN(date.getTime())) {
      return "";
    }
  
    return date.toISOString();
  }
  
  export function createScannerCsvResponse(
    records: ExportScanRecord[],
    filename: string
  ): Response {
    const headers = [
      "Attendee Name",
      "Employee ID",
      "Attendee Type",
      "Result",
      "Message",
      "Scanned By",
      "Scanner Email",
      "Scanned At",
    ];
  
    const rows = records.map((record) => [
      record.attendeeName,
      record.employeeId,
      record.attendeeType,
      record.result,
      record.message,
      record.scannedBy?.fullName,
      record.scannedBy?.email,
      formatScannedAt(record.scannedAt),
    ]);
  
    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCSV).join(","))
      .join("\r\n");
  
    const safeFilename =
      filename.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "") ||
      "scanner-records.csv";
  
    return new Response("\uFEFF" + csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
        "Cache-Control": "no-store",
      },
    });
  }
  