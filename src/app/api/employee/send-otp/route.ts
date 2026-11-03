
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { connectDB } from "@/lib/mongodb";
import { sendEmail } from "@/lib/email";

import Employee from "@/models/Employee";
import EmailOtp from "@/models/EmailOtp";
import { generateOtp, hashOtp } from "@/lib/security/otp";
import { isOfficialEmailAllowed } from "@/lib/security/email-domain";

const requestSchema = z.object({
  officialEmail: z.string().trim().email().max(254),
  employeeId: z.string().trim().min(1).max(50),
});

const OTP_EXPIRY_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_OTP_ATTEMPTS = 5;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, message: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const officialEmail = validation.data.officialEmail.toLowerCase();
    const employeeId = validation.data.employeeId.toUpperCase();
// Validate whether the email domain is officially approved.
const isAllowedDomain = await isOfficialEmailAllowed(officialEmail);

if (!isAllowedDomain) {
  return NextResponse.json(
    {
      success: false,
      message:
        "Please use an official company email address. Personal or unapproved email domains are not accepted.",
    },
    { status: 403 }
  );
}
    await connectDB();

    // Reject known employee IDs and emails before issuing an OTP.
    const existingEmployee = await Employee.findOne({
      $or: [{ officialEmail }, { employeeId }],
    }).select("officialEmail employeeId").lean();

    if (existingEmployee) {
      const duplicateEmail = existingEmployee.officialEmail === officialEmail;
      const duplicateEmployeeId = existingEmployee.employeeId === employeeId;
      const message = duplicateEmail && duplicateEmployeeId
        ? "This email address and Employee ID are already registered. Please contact the administrator if you need help."
        : duplicateEmail
          ? "This email address is already registered. Please use a different email or contact the administrator."
          : "This Employee ID is already registered. Please check the ID or contact the administrator.";

      return NextResponse.json(
        { success: false, code: "EMPLOYEE_ALREADY_REGISTERED", message },
        { status: 409 }
      );
    }

    const now = new Date();

    const existingOtp = await EmailOtp.findOne({
      officialEmail,
      purpose: "EMPLOYEE_REGISTRATION",
    });

    if (existingOtp?.verifiedAt && !existingOtp.consumedAt) {
      return NextResponse.json({
        success: true,
        message: "This email has already been verified.",
      });
    }

    if (
      existingOtp &&
      existingOtp.resendAvailableAt.getTime() > now.getTime()
    ) {
      const remainingSeconds = Math.ceil(
        (existingOtp.resendAvailableAt.getTime() - now.getTime()) / 1000
      );

      return NextResponse.json(
        {
          success: false,
          message: `Please wait ${remainingSeconds} seconds before requesting another code.`,
          remainingSeconds,
        },
        { status: 429 }
      );
    }

    const otp = generateOtp();
    const codeHash = hashOtp(officialEmail, otp);

    const expiresAt = new Date(
      now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000
    );

    const resendAvailableAt = new Date(
      now.getTime() + RESEND_COOLDOWN_SECONDS * 1000
    );

    // Update the existing OTP or create a new one.
    const otpRecord = await EmailOtp.findOneAndUpdate(
      {
        officialEmail,
        purpose: "EMPLOYEE_REGISTRATION",
      },
      {
        $set: {
          codeHash,
          expiresAt,
          attempts: 0,
          maxAttempts: MAX_OTP_ATTEMPTS,
          resendAvailableAt,
          verifiedAt: null,
          consumedAt: null,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    try {
      await sendEmail({
        to: officialEmail,
        subject: "Your Seasia Gala Event verification code",
        text: `Your verification code is ${otp}. It expires in 5 minutes. Do not share this code with anyone.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 520px; margin: auto; padding: 30px; color: #222;">
            <h2>Seasia Gala Event</h2>
            <p>Please use the following code to verify your official email address.</p>
            <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px;">
              <h1 style="letter-spacing: 8px; margin: 0;">${otp}</h1>
            </div>
            <p>This code expires in <strong>5 minutes</strong>.</p>
            <p>Do not share this code with anyone.</p>
          </div>
        `,
      });
    } catch (emailError) {
      // Remove this OTP if email delivery submission fails.
      await EmailOtp.deleteOne({ _id: otpRecord._id });

      throw emailError;
    }

    return NextResponse.json({
      success: true,
      message: "If this email is eligible, a verification code will be sent.",
      expiresIn: OTP_EXPIRY_MINUTES * 60,
      resendAfter: RESEND_COOLDOWN_SECONDS,
    });
  } catch (error) {
    console.error("Send OTP API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to process your request right now. Please try again.",
      },
      { status: 500 }
    );
  }
}
