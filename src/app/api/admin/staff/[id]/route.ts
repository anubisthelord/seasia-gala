import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { connectDB } from "@/lib/mongodb";
import { getCurrentAdmin } from "@/lib/auth/session";
import Admin, { IAdmin } from "@/models/Admin"; // Ensure IAdmin is exported from your model
import AdminSession from "@/models/AdminSession";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const UpdateStaffSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().email().max(254).optional(),
    phoneNumber: z
      .string()
      .trim()
      .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number")
      .optional(),
    role: z
      .enum(["REGISTRATION_ADMIN", "ENTRY_SCANNER", "FOOD_SCANNER"])
      .optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required.",
  });

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // 1. Authentication
    const currentAdmin = await getCurrentAdmin(request);

    if (!currentAdmin) {
      return NextResponse.json(
        { success: false, message: "Unauthorized access." },
        { status: 401 }
      );
    }

    // 2. Authorization
    if (currentAdmin.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message: "Only Super Admin can manage staff accounts.",
        },
        { status: 403 }
      );
    }

    // 3. Validate staff ID
    const { id } = await context.params;

    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid staff ID." },
        { status: 400 }
      );
    }

    // 4. Validate request body
    const body = await request.json();
    const validation = UpdateStaffSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid staff details.",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    await connectDB();

    // 5. Find existing staff member
    const existingStaff = await Admin.findById(id).select(
      "_id role isActive email"
    );

    if (!existingStaff) {
      return NextResponse.json(
        { success: false, message: "Staff member not found." },
        { status: 404 }
      );
    }

    // 6. Protect Super Admin accounts
    if (existingStaff.role === "SUPER_ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message: "Super Admin accounts cannot be modified here.",
        },
        { status: 403 }
      );
    }

    // 7. Prevent self-deactivation
    if (
      String(existingStaff._id) === String(currentAdmin._id) &&
      validation.data.isActive === false
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "You cannot deactivate your own account.",
        },
        { status: 403 }
      );
    }

    // 8. Build update object (FIX: Use Partial<IAdmin>)
    const updateData: Partial<IAdmin> = {};

    if (validation.data.fullName !== undefined) {
      updateData.fullName = validation.data.fullName;
    }

    if (validation.data.phoneNumber !== undefined) {
      updateData.phoneNumber = validation.data.phoneNumber;
    }

    if (validation.data.role !== undefined) {
      updateData.role = validation.data.role as IAdmin["role"];
    }

    if (validation.data.isActive !== undefined) {
      updateData.isActive = validation.data.isActive;
    }

    // 9. Normalize email and check duplicates
    if (validation.data.email !== undefined) {
      const normalizedEmail = validation.data.email.toLowerCase();
      updateData.email = normalizedEmail;

      const emailExists = await Admin.findOne({
        email: normalizedEmail,
        _id: { $ne: id },
      });

      if (emailExists) {
        return NextResponse.json(
          {
            success: false,
            message: "This email address is already in use.",
          },
          { status: 409 }
        );
      }
    }

    // 10. Detect role changes and deactivation
    const roleChanged =
      updateData.role !== undefined &&
      updateData.role !== existingStaff.role;

    const accountDeactivated =
      updateData.isActive === false && existingStaff.isActive;

    // 11. Update staff account
    const updatedStaff = await Admin.findOneAndUpdate(
      {
        _id: id,
        role: {
          $in: [
            "REGISTRATION_ADMIN",
            "ENTRY_SCANNER",
            "FOOD_SCANNER",
          ],
        },
      },
      { $set: updateData },
      { new: true, runValidators: true }
    ).select(
      "fullName email phoneNumber role isActive lastLoginAt createdAt"
    );

    if (!updatedStaff) {
      return NextResponse.json(
        {
          success: false,
          message: "Staff account could not be updated.",
        },
        { status: 409 }
      );
    }

    // 12. Invalidate sessions after role change or deactivation
    if (roleChanged || accountDeactivated) {
      await AdminSession.deleteMany({
        adminId: updatedStaff._id,
      });
    }

    // 13. Success response
    return NextResponse.json({
      success: true,
      message: "Staff account updated successfully.",
      data: updatedStaff,
      sessionsInvalidated: roleChanged || accountDeactivated,
    });
  } catch (error) {
    console.error("Staff update error:", error);

    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: number }).code === 11000
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "This email address is already in use.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Unable to update staff account." },
      { status: 500 }
    );
  }
}