
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import Admin from "@/models/Admin";


const rl = readline.createInterface({ input, output });

async function createSuperAdmin() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is missing from .env.local");
  }

  try {
    await mongoose.connect(uri);

    const fullName = (
      await rl.question("Super Admin full name: ")
    ).trim();

    const email = (
      await rl.question("Super Admin email: ")
    ).trim().toLowerCase();

    const password = await rl.question(
      "Super Admin password (minimum 12 characters): "
    );

    if (!fullName || !email || password.length < 12) {
      throw new Error("Invalid details. Check name, email and password.");
    }

    const existingAdmin = await Admin.findOne({ email });

    if (existingAdmin) {
      throw new Error("An admin with this email already exists.");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await Admin.create({
      fullName,
      email,
      passwordHash,
      role: "SUPER_ADMIN",
      isActive: true,
    });

    console.log("\nSuper Admin created successfully!");
  } finally {
    await mongoose.disconnect();
    rl.close();
  }
}

createSuperAdmin().catch((error) => {
  console.error("Setup failed:", error.message);
  process.exitCode = 1;
});
