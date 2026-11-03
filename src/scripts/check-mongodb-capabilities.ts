
import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../lib/mongodb";

async function checkMongoDB() {
  try {
    await connectDB();

    const result = await mongoose.connection.db!
      .admin()
      .command({ hello: 1 });

    console.log("\n--- MongoDB Configuration ---");
    console.log("Connected:", mongoose.connection.readyState === 1);
    console.log("Replica Set:", result.setName ?? "Not configured");
    console.log(
      "Logical Sessions:",
      result.logicalSessionTimeoutMinutes ?? "Not available"
    );

    if (result.setName) {
      console.log("\nTransactions: Supported");
    } else {
      console.log("\nTransactions: Replica set not detected");
    }
  } catch (error) {
    console.error("MongoDB check failed:", error);
  } finally {
    await mongoose.disconnect();
  }
}

checkMongoDB();
