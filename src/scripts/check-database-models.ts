
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ path: ".env.local" });

import { connectDB } from "../lib/mongodb";

import Employee from "../models/Employee";
import Registration from "../models/Registration";
import Attendee from "../models/Attendee";
import PartnerDocument from "../models/PartnerDocument";
import EmailOtp from "@/models/EmailOtp";

async function checkDatabaseModels() {
  try {
    console.log("\nConnecting to MongoDB...");

    await connectDB();

    console.log("MongoDB connected successfully.\n");
    console.log("Checking models and creating indexes...\n");

    const models = [
      Employee,
      Registration,
      Attendee,
      PartnerDocument,
      EmailOtp,
    ];

    for (const model of models) {
      await model.init();
      console.log(`✓ ${model.modelName} model is ready`);
    }

    console.log("\nAll four models initialized successfully!");
  } catch (error) {
    console.error("\nDatabase model check failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

checkDatabaseModels();
