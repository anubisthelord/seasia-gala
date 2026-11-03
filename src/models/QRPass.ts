
import mongoose, { Schema, Model, Types } from "mongoose";

export type QRPassStatus = "ACTIVE" | "REVOKED";
export type QREmailStatus = "PENDING" | "SENT" | "FAILED";

export interface IQRPass {
  attendee: Types.ObjectId;
  registration: Types.ObjectId;

  tokenHash: string;
  encryptedToken: string;

  status: QRPassStatus;

  issuedAt: Date;
  issuedBy: Types.ObjectId | null;

  revokedAt: Date | null;
  revokedBy: Types.ObjectId | null;
  revocationReason: string | null;

  // Entry check-in
  entryCheckedInAt: Date | null;
  entryCheckedInBy: Types.ObjectId | null;

  // Food collection
  foodCollectedAt: Date | null;
  foodCollectedBy: Types.ObjectId | null;

  // QR email delivery tracking
  emailStatus: QREmailStatus;
  emailAttempts: number;
  emailLastAttemptAt: Date | null;
  emailSentAt: Date | null;
  emailProviderMessageId: string | null;
  emailLastError: string | null;

  createdAt?: Date;
  updatedAt?: Date;
}

const QRPassSchema = new Schema<IQRPass>(
  {
    attendee: {
      type: Schema.Types.ObjectId,
      ref: "Attendee",
      required: true,
      unique: true,
    },

    registration: {
      type: Schema.Types.ObjectId,
      ref: "Registration",
      required: true,
      index: true,
    },

    tokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },

    encryptedToken: {
      type: String,
      required: true,
      select: false,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "REVOKED"],
      default: "ACTIVE",
      required: true,
      index: true,
    },

    issuedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },

    issuedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    revokedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    revocationReason: {
      type: String,
      default: null,
      maxlength: 1000,
    },

    // Entry check-in fields
    entryCheckedInAt: {
      type: Date,
      default: null,
    },

    entryCheckedInBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    // Food collection fields
    foodCollectedAt: {
      type: Date,
      default: null,
    },

    foodCollectedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    // QR email delivery tracking
    emailStatus: {
      type: String,
      enum: ["PENDING", "SENT", "FAILED"],
      default: "PENDING",
      required: true,
    },

    emailAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    emailLastAttemptAt: {
      type: Date,
      default: null,
    },

    emailSentAt: {
      type: Date,
      default: null,
    },

    emailProviderMessageId: {
      type: String,
      default: null,
    },

    emailLastError: {
      type: String,
      default: null,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);

QRPassSchema.index({ registration: 1, status: 1 });

const QRPass: Model<IQRPass> =
  mongoose.models.QRPass ||
  mongoose.model<IQRPass>("QRPass", QRPassSchema);

export default QRPass;
