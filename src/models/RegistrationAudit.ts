
import mongoose, { Schema, Model } from "mongoose";

export type RegistrationAuditAction =
  | "APPROVE_REGISTRATION"
  | "REJECT_REGISTRATION"
  | "REQUEST_CORRECTION"
  | "APPROVE_PARTNER_DOCUMENT"
  | "REJECT_PARTNER_DOCUMENT";

export interface IRegistrationAudit {
  registration: mongoose.Types.ObjectId;
  admin: mongoose.Types.ObjectId;

  action: RegistrationAuditAction;

  previousStatus: string;
  newStatus: string;

  attendee: mongoose.Types.ObjectId | null;
  reason: string | null;

  createdAt?: Date;
}

const RegistrationAuditSchema = new Schema<IRegistrationAudit>(
  {
    registration: {
      type: Schema.Types.ObjectId,
      ref: "Registration",
      required: true,
      index: true,
    },

    admin: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    action: {
      type: String,
      enum: [
        "APPROVE_REGISTRATION",
        "REJECT_REGISTRATION",
        "REQUEST_CORRECTION",
        "APPROVE_PARTNER_DOCUMENT",
        "REJECT_PARTNER_DOCUMENT",
      ],
      required: true,
    },

    previousStatus: {
      type: String,
      required: true,
    },

    newStatus: {
      type: String,
      required: true,
    },

    attendee: {
      type: Schema.Types.ObjectId,
      ref: "Attendee",
      default: null,
    },

    reason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1000,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

RegistrationAuditSchema.index({
  registration: 1,
  createdAt: -1,
});

const RegistrationAudit: Model<IRegistrationAudit> =
  mongoose.models.RegistrationAudit ||
  mongoose.model<IRegistrationAudit>(
    "RegistrationAudit",
    RegistrationAuditSchema
  );

export default RegistrationAudit;
