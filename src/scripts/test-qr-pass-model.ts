import "dotenv/config";

import { connectDB } from "../lib/mongodb";
import QRPass from "../models/QRPass";

async function test() {
  try {
    await connectDB();

    await QRPass.init();

    console.log("QRPass model initialized successfully.");
    console.log("QRPass indexes:", await QRPass.collection.indexes());

    process.exit(0);
  } catch (error) {
    console.error("QRPass model test failed:", error);
    process.exit(1);
  }
}

test();