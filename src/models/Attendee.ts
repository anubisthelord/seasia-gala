
import mongoose, { Schema, Model } from "mongoose";

export type AttendeeType = "EMPLOYEE" | "PARTNER";

export type PartnerTitle =
  | "MR"
  | "MRS";

export interface IAttendee {
  registration: mongoose.Types.ObjectId;
  attendeeType: AttendeeType;
  fullName: string;
  title: PartnerTitle | null;

  createdAt?: Date;
  updatedAt?: Date;
}

const AttendeeSchema = new Schema<IAttendee>(
  {
    registration: {
      type: Schema.Types.ObjectId,
      ref: "Registration",
      required: true,
    },

    attendeeType: {
      type: String,
      enum: ["EMPLOYEE", "PARTNER"],
      required: true,
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    title: {
      type: String,
      enum: ["MR", "MRS", null],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// One employee attendee and at most one partner attendee per registration.
AttendeeSchema.index(
  { registration: 1, attendeeType: 1 },
  { unique: true }
);

const Attendee: Model<IAttendee> =
  mongoose.models.Attendee ||
  mongoose.model<IAttendee>("Attendee", AttendeeSchema);

export default Attendee;
