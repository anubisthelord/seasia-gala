
import mongoose, { Schema, Model } from "mongoose";

export interface IEmailOtp {
  officialEmail: string;
  codeHash: string;
  purpose: "EMPLOYEE_REGISTRATION";

  expiresAt: Date;
  attempts: number;
  maxAttempts: number;

  resendAvailableAt: Date;
  verifiedAt: Date | null;
  consumedAt: Date | null;

  createdAt?: Date;
  updatedAt?: Date;
}

const EmailOtpSchema = new Schema<IEmailOtp>(
  {
    officialEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    codeHash: {
      type: String,
      required: true,
      select: false,
    },

    purpose: {
      type: String,
      enum: ["EMPLOYEE_REGISTRATION"],
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    maxAttempts: {
      type: Number,
      default: 5,
    },

    resendAvailableAt: {
      type: Date,
      required: true,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    consumedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// One active OTP record per email and purpose.
EmailOtpSchema.index(
  { officialEmail: 1, purpose: 1 },
  { unique: true }
);

// Automatically clean expired OTP records.
EmailOtpSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

const EmailOtp: Model<IEmailOtp> =
  mongoose.models.EmailOtp ||
  mongoose.model<IEmailOtp>("EmailOtp", EmailOtpSchema);

export default EmailOtp;
