
import mongoose, { Schema, Model, Types } from "mongoose";

export interface IAdminSession {
  adminId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  lastUsedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const AdminSessionSchema = new Schema<IAdminSession>(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },

    tokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },

    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const AdminSession: Model<IAdminSession> =
  mongoose.models.AdminSession ||
  mongoose.model<IAdminSession>(
    "AdminSession",
    AdminSessionSchema
  );

export default AdminSession;
