
import mongoose, { Schema, Model } from "mongoose";

export type AdminRole =
  | "SUPER_ADMIN"
  | "REGISTRATION_ADMIN"
  | "ENTRY_SCANNER"
  | "FOOD_SCANNER";

export interface IAdmin {
  fullName: string;
  email: string;
  phoneNumber: string;
  passwordHash: string;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const AdminSchema = new Schema<IAdmin>(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    phoneNumber: {
      type: String,
      required: false, // Or remove this line entirely
      trim: true,
      default: null,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: [
        "SUPER_ADMIN",
        "REGISTRATION_ADMIN",
        "ENTRY_SCANNER",
        "FOOD_SCANNER",
      ],
      default: "REGISTRATION_ADMIN",
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Admin: Model<IAdmin> =
  mongoose.models.Admin ||
  mongoose.model<IAdmin>("Admin", AdminSchema);

export default Admin;
