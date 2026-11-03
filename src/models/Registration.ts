
import mongoose, { Schema, Model } from "mongoose";

export type AttendanceType = "SINGLE" | "COUPLE";

export type RegistrationStatus =
  | "PENDING_ADMIN_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "CORRECTION_REQUESTED"
  | "CANCELLED";

export interface IRegistration {
  employee: mongoose.Types.ObjectId;
  attendanceType: AttendanceType;
  status: RegistrationStatus;

  submittedAt: Date;

  reviewedBy: mongoose.Types.ObjectId | null;
  reviewedAt: Date | null;

  rejectionReason: string | null;
  correctionReason: string | null;

  lockedAt: Date | null;

  createdAt?: Date;
  updatedAt?: Date;
}

const RegistrationSchema = new Schema<IRegistration>(
  {
    employee: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      unique: true,
    },

    attendanceType: {
      type: String,
      enum: ["SINGLE", "COUPLE"],
      required: true,
    },

    status: {
      type: String,
      enum: [
        "PENDING_ADMIN_APPROVAL",
        "APPROVED",
        "REJECTED",
        "CORRECTION_REQUESTED",
        "CANCELLED",
      ],
      default: "PENDING_ADMIN_APPROVAL",
      required: true,
    },

    submittedAt: {
      type: Date,
      default: Date.now,
    },

    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    rejectionReason: {
      type: String,
      default: null,
      trim: true,
    },

    correctionReason: {
      type: String,
      default: null,
      trim: true,
    },

    lockedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Registration: Model<IRegistration> =
  mongoose.models.Registration ||
  mongoose.model<IRegistration>("Registration", RegistrationSchema);

export default Registration;
