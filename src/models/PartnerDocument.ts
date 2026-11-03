import mongoose, { Schema, Model } from "mongoose";

export type PartnerDocumentType = "IMAGE";

export type DocumentVerificationStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

export interface IPartnerDocument {
  attendee: mongoose.Types.ObjectId;
  documentType: PartnerDocumentType;

  // Private storage reference, not a public URL.
  storageKey: string;

  verificationStatus: DocumentVerificationStatus;

  reviewedBy: mongoose.Types.ObjectId | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;

  createdAt?: Date;
  updatedAt?: Date;
}

const PartnerDocumentSchema = new Schema<IPartnerDocument>(
  {
    attendee: {
      type: Schema.Types.ObjectId,
      ref: "Attendee",
      required: true,
      unique: true,
    },

    documentType: {
      type: String,
      enum: ["IMAGE"],
      default: "IMAGE",
      required: true,
    },

    storageKey: {
      type: String,
      required: true,
      trim: true,
    },

    verificationStatus: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      required: true,
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
  },
  {
    timestamps: true,
  }
);

const PartnerDocument: Model<IPartnerDocument> =
  mongoose.models.PartnerDocument ||
  mongoose.model<IPartnerDocument>(
    "PartnerDocument",
    PartnerDocumentSchema
  );

export default PartnerDocument;