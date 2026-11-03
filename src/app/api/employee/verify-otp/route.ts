import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";

import { connectDB } from "@/lib/mongodb";
import { hashOtp } from "@/lib/security/otp";
import { isOfficialEmailAllowed } from "@/lib/security/email-domain";

import EmailOtp from "@/models/EmailOtp";
import Employee from "@/models/Employee";
import {
  createEmployeeRegistrationSession,
} from "@/lib/auth/employee-registration-session";

const requestSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  officialEmail: z.string().trim().email().max(254),
  phoneNumber: z.string().trim().regex(/^[6-9]\d{9}$/),
  employeeId: z.string().trim().min(1).max(50),
  otp: z.string().regex(/^\d{6}$/),
});

function compareHashes(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(actual, "hex");

  return (
    expectedBuffer.length === 32 &&
    actualBuffer.length === 32 &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          message: "Please provide valid employee details and a six-digit OTP.",
        },
        { status: 400 }
      );
    }

    const {
      fullName,
      officialEmail: rawEmail,
      phoneNumber,
      employeeId,
      otp: submittedOtp,
    } = validation.data;

    const officialEmail = rawEmail.toLowerCase().trim();
    const normalizedEmployeeId = employeeId.toUpperCase().trim();

    await connectDB();

    // Recheck the official email domain on the server.
    const domainAllowed = await isOfficialEmailAllowed(officialEmail);

    if (!domainAllowed) {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          message: "This email domain is not permitted for registration.",
        },
        { status: 403 }
      );
    }

    const otpRecord = await EmailOtp.findOne({
      officialEmail,
      purpose: "EMPLOYEE_REGISTRATION",
    }).select("+codeHash");

    if (!otpRecord || otpRecord.consumedAt) {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          message: "Invalid or expired verification code. Please request a new one.",
        },
        { status: 400 }
      );
    }

    if (otpRecord.expiresAt.getTime() <= Date.now()) {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          message: "Verification code has expired. Please request a new one.",
        },
        { status: 400 }
      );
    }

    const submittedHash = hashOtp(officialEmail, submittedOtp);

    if (!compareHashes(otpRecord.codeHash, submittedHash)) {
      if (!otpRecord.verifiedAt && otpRecord.attempts < otpRecord.maxAttempts) {
        const updatedRecord = await EmailOtp.findOneAndUpdate(
          {
            _id: otpRecord._id,
            verifiedAt: null,
            consumedAt: null,
            expiresAt: { $gt: new Date() },
            $expr: { $lt: ["$attempts", "$maxAttempts"] },
          },
          { $inc: { attempts: 1 } },
          { new: true }
        );

        const remainingAttempts = updatedRecord
          ? Math.max(0, updatedRecord.maxAttempts - updatedRecord.attempts)
          : 0;

        return NextResponse.json(
          {
            success: false,
            verified: false,
            message: remainingAttempts
              ? `Incorrect verification code. ${remainingAttempts} attempts remaining.`
              : "Maximum attempts reached. Please request a new code.",
            remainingAttempts,
          },
          { status: remainingAttempts ? 400 : 429 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          verified: false,
          message: "Invalid verification code.",
        },
        { status: 400 }
      );
    }

    if (!otpRecord.verifiedAt) {
      const verifiedRecord = await EmailOtp.findOneAndUpdate(
        {
          _id: otpRecord._id,
          codeHash: otpRecord.codeHash,
          verifiedAt: null,
          consumedAt: null,
          expiresAt: { $gt: new Date() },
          $expr: { $lt: ["$attempts", "$maxAttempts"] },
        },
        { $set: { verifiedAt: new Date() } },
        { new: true }
      );

      if (!verifiedRecord) {
        return NextResponse.json(
          {
            success: false,
            verified: false,
            message: "Verification code is no longer valid. Please try again.",
          },
          { status: 400 }
        );
      }
    }

    // Check whether this employee already exists.
    let employee = await Employee.findOne({ officialEmail });

    if (employee) {
      const detailsMatch =
        employee.fullName === fullName &&
        employee.phoneNumber === phoneNumber &&
        employee.employeeId === normalizedEmployeeId;

      if (!detailsMatch) {
        return NextResponse.json(
          {
            success: false,
            verified: false,
            message: "An employee record already exists with different details. Please contact the administrator.",
          },
          { status: 409 }
        );
      }
    } else {
      try {
        employee = await Employee.create({
          fullName,
          officialEmail,
          phoneNumber,
          employeeId: normalizedEmployeeId,
          emailVerifiedAt: new Date(),
        });
      } catch (error: unknown) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === 11000
        ) {
          return NextResponse.json(
            {
              success: false,
              verified: false,
              message: "This email or Employee ID is already registered.",
            },
            { status: 409 }
          );
        }

        throw error;
      }
    }

    // Consume OTP only after the employee has been saved successfully.
    await EmailOtp.findOneAndUpdate(
      {
        _id: otpRecord._id,
        verifiedAt: { $ne: null },
        consumedAt: null,
      },
      { $set: { consumedAt: new Date() } }
    );

    // ==========================================
    // NEW CODE ADDED HERE
    // ==========================================
    const sessionToken = await createEmployeeRegistrationSession(
      employee._id.toString(),
      officialEmail
    );

    const response = NextResponse.json({
      success: true,
      verified: true,
      message: "Email verified and employee details saved successfully.",
    });

    response.cookies.set("employee_registration_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 60, // 30 minutes
    });

    return response;

  } catch (error) {
    console.error("Verify OTP API error:", error);

    return NextResponse.json(
      {
        success: false,
        verified: false,
        message: "Unable to verify your email right now. Please try again.",
      },
      { status: 500 }
    );
  }
}