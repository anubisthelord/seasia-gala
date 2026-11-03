import "server-only";

import { Types } from "mongoose";
import ScannerScanLog, {
  ScannerType,
  ScannerResult,
  ScannerAttendeeType,
} from "@/models/ScannerScanLog";

interface RecordScanInput {
  scannerType: ScannerType;
  result: ScannerResult;
  scannedBy: Types.ObjectId;

  qrPass?: Types.ObjectId | null;
  registration?: Types.ObjectId | null;
  attendee?: Types.ObjectId | null;

  attendeeName?: string | null;
  employeeId?: string | null;
  attendeeType?: ScannerAttendeeType | null;

  message: string;
}

export async function recordScannerScan(
  input: RecordScanInput
): Promise<void> {
  // A repeat scan does not change the pass state, so it is not a new record.
  if (
    input.result === "ALREADY_CHECKED_IN" ||
    input.result === "ALREADY_COLLECTED"
  ) {
    return;
  }

  try {
    await ScannerScanLog.create({
      scannerType: input.scannerType,
      result: input.result,
      scannedBy: input.scannedBy,

      qrPass: input.qrPass ?? null,
      registration: input.registration ?? null,
      attendee: input.attendee ?? null,

      attendeeName: input.attendeeName ?? null,
      employeeId: input.employeeId ?? null,
      attendeeType: input.attendeeType ?? null,

      // FIX: Truncate message to match model's 300-char maxlength
      message: input.message.slice(0, 300),
      scannedAt: new Date(),
    });
  } catch (error) {
    // A history failure must not reverse a completed scan.
    console.error("Scanner history write failed:", error);
  }
}
