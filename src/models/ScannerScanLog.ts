import mongoose, { Schema, Model, Types } from "mongoose";

export type ScannerType = "ENTRY" | "FOOD";

export type ScannerResult =
  | "CHECKED_IN"
  | "COLLECTED"
  | "ALREADY_CHECKED_IN"
  | "ALREADY_COLLECTED"
  | "ENTRY_REQUIRED"
  | "INVALID_QR"
  | "REVOKED"
  | "NOT_APPROVED"
  | "PARTNER_NOT_APPROVED"
  | "SCAN_CONFLICT"
  | "ATTENDEE_NOT_FOUND";

export type ScannerAttendeeType = "EMPLOYEE" | "PARTNER";

export interface IScannerScanLog {
  scannerType: ScannerType;
  result: ScannerResult;

  scannedBy: Types.ObjectId;

  qrPass: Types.ObjectId | null;
  registration: Types.ObjectId | null;
  attendee: Types.ObjectId | null;

  attendeeName: string | null;
  employeeId: string | null;
  attendeeType: ScannerAttendeeType | null;

  message: string;
  scannedAt: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

const ScannerScanLogSchema = new Schema<IScannerScanLog>(
  {
    scannerType: {
      type: String,
      enum: ["ENTRY", "FOOD"],
      required: true,
    },

    result: {
      type: String,
      enum: [
        "CHECKED_IN",
        "COLLECTED",
        "ALREADY_CHECKED_IN",
        "ALREADY_COLLECTED",
        "ENTRY_REQUIRED",
        "INVALID_QR",
        "REVOKED",
        "NOT_APPROVED",
        "PARTNER_NOT_APPROVED",
        "SCAN_CONFLICT",
        "ATTENDEE_NOT_FOUND",
      ],
      required: true,
    },

    scannedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    qrPass: {
      type: Schema.Types.ObjectId,
      ref: "QRPass",
      default: null,
    },

    registration: {
      type: Schema.Types.ObjectId,
      ref: "Registration",
      default: null,
    },

    attendee: {
      type: Schema.Types.ObjectId,
      ref: "Attendee",
      default: null,
    },

    attendeeName: {
      type: String,
      default: null,
      trim: true,
    },

    employeeId: {
      type: String,
      default: null,
      trim: true,
    },

    attendeeType: {
      type: String,
      enum: ["EMPLOYEE", "PARTNER", null],
      default: null,
    },

    message: {
      type: String,
      required: true,
      maxlength: 300,
    },

    scannedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Scanner-specific history
ScannerScanLogSchema.index({
  scannerType: 1,
  scannedAt: -1,
});

// Filter records by scan result
ScannerScanLogSchema.index({
  result: 1,
  scannedAt: -1,
});

// Attendee scan history
ScannerScanLogSchema.index({
  attendee: 1,
  scannedAt: -1,
});

// Staff member activity
ScannerScanLogSchema.index({
  scannedBy: 1,
  scannedAt: -1,
});

// Registration scan history
ScannerScanLogSchema.index({
  registration: 1,
  scannedAt: -1,
});

// FIX: Added compound index for scanner type + result + date reporting queries
ScannerScanLogSchema.index({
  scannerType: 1,
  result: 1,
  scannedAt: -1,
});

const ScannerScanLog: Model<IScannerScanLog> =
  mongoose.models.ScannerScanLog ||
  mongoose.model<IScannerScanLog>(
    "ScannerScanLog",
    ScannerScanLogSchema
  );

export default ScannerScanLog;
