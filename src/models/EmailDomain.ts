
import mongoose, { Schema, Model } from "mongoose";

export type EmailDomainPolicy = "ALLOW" | "BLOCK";

export interface IEmailDomain {
  domain: string;
  policy: EmailDomainPolicy;
  isActive: boolean;
  addedBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const EmailDomainSchema = new Schema<IEmailDomain>(
  {
    domain: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    policy: {
      type: String,
      enum: ["ALLOW", "BLOCK"],
      default: "ALLOW",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    addedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { timestamps: true }
);

const EmailDomain: Model<IEmailDomain> =
  mongoose.models.EmailDomain ||
  mongoose.model<IEmailDomain>("EmailDomain", EmailDomainSchema);

export default EmailDomain;
