
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { connectDB } from "@/lib/mongodb";
import Admin from "@/models/Admin";
import { createAdminSession } from "@/lib/auth/session";

const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform(v => v.toLowerCase()),
  password: z.string().min(1).max(128),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { message: "Please enter a valid email and password." },
        { status: 400 }
      );
    }

    await connectDB();

    const { email, password } = result.data;

    const admin = await Admin.findOne({
      email,
      isActive: true,
    }).select("+passwordHash");

    if (!admin) {
      return NextResponse.json(
        { message: "Invalid email or password." },
        { status: 401 }
      );
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      admin.passwordHash
    );

    if (!isPasswordValid) {
      return NextResponse.json(
        { message: "Invalid email or password." },
        { status: 401 }
      );
    }

    await createAdminSession(admin._id.toString());

    await Admin.updateOne(
      { _id: admin._id },
      { $set: { lastLoginAt: new Date() } }
    );

    return NextResponse.json({
      success: true,
      message: "Login successful.",
      admin: {
        fullName: admin.fullName,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);

    return NextResponse.json(
      { message: "Unable to process login. Please try again." },
      { status: 500 }
    );
  }
}
