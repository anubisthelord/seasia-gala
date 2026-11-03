import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { connectDB } from "@/lib/mongodb";
import { getCurrentAdmin } from "@/lib/auth/session";
import Admin from "@/models/Admin";

const CreateStaffSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  password: z.string().min(8).max(128),
  role: z.enum([
    "REGISTRATION_ADMIN",
    "ENTRY_SCANNER",
    "FOOD_SCANNER",
  ]),
});

export async function GET(request: NextRequest) {
  try {
    const currentAdmin = await getCurrentAdmin(request);

    if (!currentAdmin) {
      return NextResponse.json(
        { success: false, message: "Unauthorized access." },
        { status: 401 }
      );
    }

    if (currentAdmin.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message: "Only Super Admin can manage staff accounts.",
        },
        { status: 403 }
      );
    }

    await connectDB();

    const staff = await Admin.find({
      role: {
        $in: [
          "REGISTRATION_ADMIN",
          "ENTRY_SCANNER",
          "FOOD_SCANNER",
        ],
      },
    })
      .select("fullName email phoneNumber role isActive lastLoginAt createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: staff,
    });
  } catch (error) {
    console.error("Staff listing error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to fetch staff accounts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentAdmin = await getCurrentAdmin(request);

    if (!currentAdmin) {
      return NextResponse.json(
        { success: false, message: "Unauthorized access." },
        { status: 401 }
      );
    }

    if (currentAdmin.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message: "Only Super Admin can manage staff accounts.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = CreateStaffSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Please check the staff details.",
          errors: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    await connectDB();

    const { fullName, email, phoneNumber, password, role } =
      validation.data;

    const normalizedEmail = email.toLowerCase();

    const existingAdmin = await Admin.findOne({
      email: normalizedEmail,
    });

    if (existingAdmin) {
      return NextResponse.json(
        {
          success: false,
          message: "An account with this email already exists.",
        },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const newStaff = await Admin.create({
      fullName,
      email: normalizedEmail,
      phoneNumber,
      passwordHash,
      role,
      isActive: true,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Staff account created successfully.",
        data: {
          id: newStaff._id,
          fullName: newStaff.fullName,
          email: newStaff.email,
          phoneNumber: newStaff.phoneNumber,
          role: newStaff.role,
          isActive: newStaff.isActive,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Staff creation error:", error);

    if (
      error instanceof Error &&
      error.name === "ValidationError"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Please provide all required staff details.",
        },
        { status: 400 }
      );
    }

    if (
      error instanceof Error &&
      "code" in error &&
      error.code === 11000
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "An account with this email already exists.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Unable to create staff account." },
      { status: 500 }
    );
  }
}