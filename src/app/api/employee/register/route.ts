import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import QRCode from "qrcode";

import { connectDB } from "@/lib/mongodb";

import Employee from "@/models/Employee";
import Registration from "@/models/Registration";
import Attendee from "@/models/Attendee";
import PartnerDocument from "@/models/PartnerDocument";
import QRPass from "@/models/QRPass";

import {
  verifyEmployeeRegistrationSession,
} from "@/lib/auth/employee-registration-session";

import {
  savePartnerDocument,
  deletePartnerDocument,
} from "@/lib/storage/partner-documents";

import {
  generateQrToken,
  hashQrToken,
  encryptQrToken,
} from "@/lib/security/qr-token";

import { sendEmail } from "@/lib/email";
import { buildQrTicketSvg, qrTicketDataUrl } from "@/lib/qr-ticket";
import { withBasePath } from "@/config/base-path";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const partnerDocumentFileSchema = z
  .instanceof(File, {
    message: "Partner identity document is required.",
  })
  .refine((file) => file.size > 0, {
    message: "Partner identity document is empty.",
  })
  .refine((file) => file.size <= MAX_FILE_SIZE, {
    message: "Document image must be smaller than 5 MB.",
  })
  .refine(
    (file) =>
      (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type),
    {
      message: "Only JPG, PNG and WEBP images are allowed.",
    }
  );

const submissionSchema = z
  .object({
    attendanceType: z.enum(["SINGLE", "COUPLE"]),
    partnerFullName: z.string().trim().min(2).max(120).optional(),
    partnerTitle: z.enum(["MR", "MRS", "FIANCE", "FIANCEE"]).optional(),
    partnerDocument: partnerDocumentFileSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.attendanceType === "COUPLE") {
      if (!data.partnerFullName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["partnerFullName"],
          message: "Partner's full name is required for Couple registration.",
        });
      }

      if (!data.partnerTitle) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["partnerTitle"],
          message: "Partner's title is required for Couple registration.",
        });
      }

      if (!data.partnerDocument) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["partnerDocument"],
          message: "Partner identity document is required for Couple registration.",
        });
      }
    }
  });

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

export async function POST(request: NextRequest) {
  let registrationId: string | null = null;
  let qrPassId: string | null = null;

  const attendeeIds: string[] = [];
  let documentPath: string | null = null;

  // 1. QR image data URL — populated when the QR is generated, returned to the client
  let qrImageDataUrl: string | null = null;
  let qrTicketImageDataUrl: string | null = null;

  try {
    // 2. Verify employee registration session.
    const sessionToken = request.cookies.get(
      "employee_registration_session"
    )?.value;

    if (!sessionToken) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Your verification session has expired. Please verify your email again.",
        },
        { status: 401 }
      );
    }

    const session =
      await verifyEmployeeRegistrationSession(sessionToken);

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid or expired registration session. Please verify your email again.",
        },
        { status: 401 }
      );
    }

    await connectDB();

    // 3. Find the employee whose email was verified.
    const employee = await Employee.findOne({
      _id: session.employeeId,
      officialEmail: session.email,
      emailVerifiedAt: { $ne: null },
    });

    if (!employee) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Verified employee record not found. Please verify your email again.",
        },
        { status: 404 }
      );
    }

    // 4. Read and validate submitted form data.
    const formData = await request.formData();

    const fileEntry = formData.get("partnerDocument");

    const uploadedFile =
      typeof File !== "undefined" && fileEntry instanceof File
        ? fileEntry
        : undefined;

    const rawData = {
      attendanceType: formData.get("attendanceType"),
      partnerFullName:
        formData.get("partnerFullName") || undefined,
      partnerTitle:
        formData.get("partnerTitle") || undefined,
      partnerDocument: uploadedFile,
    };

    const validation = submissionSchema.safeParse(rawData);

    if (!validation.success) {
      const fieldErrors = validation.error.flatten().fieldErrors;

      const firstMessage =
        Object.values(fieldErrors).flat().find(Boolean) ||
        "Please provide valid registration and partner details.";

      return NextResponse.json(
        {
          success: false,
          message: firstMessage,
          errors: fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      attendanceType,
      partnerFullName,
      partnerTitle,
      partnerDocument,
    } = validation.data;

    // 5. Prevent duplicate registration.
    const existingRegistration = await Registration.findOne({
      employee: employee._id,
    });

    if (existingRegistration) {
      return NextResponse.json(
        {
          success: false,
          message: "You have already submitted a registration.",
        },
        { status: 409 }
      );
    }

    // 6. Save partner document privately, if applicable.
    let storageKey: string | null = null;

    if (attendanceType === "COUPLE" && partnerDocument) {
      const savedFile = await savePartnerDocument(partnerDocument);

      storageKey = savedFile.storageKey;
      documentPath = savedFile.absolutePath;
    }

    // 7. Create registration.
    // Single is automatically approved.
    // Couple remains pending admin approval.
    const registration = await Registration.create({
      employee: employee._id,
      attendanceType,
      status:
        attendanceType === "SINGLE"
          ? "APPROVED"
          : "PENDING_ADMIN_APPROVAL",
      submittedAt: new Date(),
      reviewedBy: null,
      reviewedAt: null,
      rejectionReason: null,
      correctionReason: null,
      lockedAt: null,
    });

    registrationId = registration._id.toString();

    // 8. Create employee attendee.
    const employeeAttendee = await Attendee.create({
      registration: registration._id,
      attendeeType: "EMPLOYEE",
      fullName: employee.fullName,
      title: null,
    });

    attendeeIds.push(employeeAttendee._id.toString());

    // 9. Create partner records for Couple registration.
    if (
      attendanceType === "COUPLE" &&
      partnerFullName &&
      partnerTitle &&
      storageKey
    ) {
      const partnerAttendee = await Attendee.create({
        registration: registration._id,
        attendeeType: "PARTNER",
        fullName: partnerFullName,
        title: partnerTitle,
      });

      attendeeIds.push(partnerAttendee._id.toString());

      await PartnerDocument.create({
        attendee: partnerAttendee._id,
        documentType: "IMAGE",
        storageKey,
        verificationStatus: "PENDING",
        reviewedBy: null,
        reviewedAt: null,
        rejectionReason: null,
      });
    }

    // 10. Generate an active QR immediately for Single registration.
    let qrEmailStatus: "NOT_APPLICABLE" | "PENDING" | "SENT" | "FAILED" =
      "NOT_APPLICABLE";

    if (attendanceType === "SINGLE") {
      const token = generateQrToken();

      const tokenHash = hashQrToken(token);
      const encryptedToken = encryptQrToken(token);

      const qrPass = await QRPass.create({
        attendee: employeeAttendee._id,
        registration: registration._id,

        tokenHash,
        encryptedToken,

        status: "ACTIVE",

        issuedAt: new Date(),
        issuedBy: null,

        revokedAt: null,
        revokedBy: null,
        revocationReason: null,

        entryCheckedInAt: null,
        entryCheckedInBy: null,

        foodCollectedAt: null,
        foodCollectedBy: null,

        emailStatus: "PENDING",
        emailAttempts: 0,
        emailLastAttemptAt: null,
        emailSentAt: null,
        emailProviderMessageId: null,
        emailLastError: null,
      });

      qrPassId = qrPass._id.toString();
      qrEmailStatus = "PENDING";

      // 11. Generate QR image and email it.
      // Email errors must never invalidate the registration or QR.
      const emailAttemptAt = new Date();

      await QRPass.updateOne(
        { _id: qrPass._id },
        {
          $inc: { emailAttempts: 1 },
          $set: { emailLastAttemptAt: emailAttemptAt },
        }
      );

      try {
        const qrImage = await QRCode.toBuffer(token, {
          type: "png",
          width: 400,
          margin: 2,
          errorCorrectionLevel: "M",
        });

        // Populate the data URL for the success page
        qrImageDataUrl = `data:image/png;base64,${qrImage.toString("base64")}`;
        const ticketSvg = buildQrTicketSvg(
          employee.fullName,
          employee.employeeId,
          qrImageDataUrl
        );
        qrTicketImageDataUrl = qrTicketDataUrl(ticketSvg);

        const safeName = escapeHtml(employee.fullName);
        const safeEmployeeId = escapeHtml(employee.employeeId);
        const safeEmail = escapeHtml(employee.officialEmail);
        const safePhone = escapeHtml(employee.phoneNumber);
        const qrDownloadUrl = new URL(
          withBasePath("/api/employee/qr-download"),
          request.nextUrl.origin
        );
        qrDownloadUrl.searchParams.set("token", token);
        const safeQrDownloadUrl = escapeHtml(qrDownloadUrl.toString());

        const emailResult = await sendEmail({
          to: employee.officialEmail,
          subject: "Your Seasia Gala Event QR Pass",

          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222;">
              <h2 style="margin-bottom:8px;">Your registration is confirmed!</h2>

              <p>Hello ${safeName},</p>

              <p>
                Your Single registration for the Seasia Gala Event has been
                approved automatically. Your QR pass is active and ready to use.
              </p>

          

              <!-- QR PASS CARD -->
              <div style="max-width:420px;margin:28px auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;font-family:Arial,sans-serif;">

                <div style="background:#171717;padding:22px;text-align:center;">
                  <h2 style="color:#ffffff;margin:0;font-size:21px;">
                    SEASIA GALA
                  </h2>
                  <p style="color:#d1d5db;margin:6px 0 0;font-size:12px;">
                    OFFICIAL EVENT QR PASS
                  </p>
                </div>

                <div style="padding:24px;text-align:center;">

                  <p style="color:#6b7280;font-size:12px;margin:0 0 6px;">
                    EMPLOYEE NAME
                  </p>

                  <h2 style="color:#171717;font-size:22px;margin:0 0 18px;">
                    ${safeName}
                  </h2>

                  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:20px;">
                    <p style="color:#6b7280;font-size:11px;margin:0 0 5px;">
                      EMPLOYEE ID
                    </p>
                    <strong style="font-size:16px;color:#171717;">
                      ${safeEmployeeId}
                    </strong>
                  </div>

                  <img
                    src="cid:seasia-gala-qr"
                    alt="Seasia Gala QR Pass"
                    width="240"
                    height="240"
                    style="display:block;width:240px;height:240px;margin:0 auto;"
                  />

                  <p style="font-size:13px;color:#374151;margin:18px 0 5px;">
                    Your Entry & Food QR Pass
                  </p>

                  <p style="font-size:12px;color:#6b7280;margin:0;">
                    Keep this QR code safe. It will be scanned separately
                    for event entry and food collection.
                  </p>

                  <a
                    href="${safeQrDownloadUrl}"
                    style="display:inline-block;margin-top:20px;padding:12px 20px;background:#047857;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:bold;"
                  >
                    Download Full Ticket Image
                  </a>

                  <div style="margin-top:22px;padding:12px;background:#ecfdf5;border-radius:8px;">
                    <strong style="color:#047857;font-size:13px;">
                      Registration Approved
                    </strong>
                  </div>

                </div>
              </div>

              <p>
                Please keep this email accessible on your phone or save the
                attached QR image before arriving.
              </p>

              <p>Regards,<br />Seasia Gala Event Team</p>
            </div>
          `,

          text: `
Your Seasia Gala Event registration is confirmed.

Name: ${employee.fullName}
Employee ID: ${employee.employeeId}
Email: ${employee.officialEmail}
Phone: ${employee.phoneNumber}
Attendance: Single
Registration Status: Approved
QR Pass Status: Active

Your full event ticket is attached to this email.
Download the complete ticket image: ${qrDownloadUrl.toString()}
Keep it safe. It will be scanned separately for entry and food collection.

Regards,
Seasia Gala Event Team
          `,

          attachments: [
            {
              content: qrImage.toString("base64"),
              filename: `Seasia-Gala-${employee.employeeId}-QR.png`,
              type: "image/png",
              disposition: "inline",
              content_id: "seasia-gala-qr",
            },
          ],
        });

        await QRPass.updateOne(
          { _id: qrPass._id },
          {
            $set: {
              emailStatus: "SENT",
              emailSentAt: new Date(),
              emailProviderMessageId: emailResult.messageId || null,
              emailLastError: null,
            },
          }
        );

        qrEmailStatus = "SENT";
      } catch (emailError: unknown) {
        const sendGridError = emailError as {
          code?: number;
          response?: {
            body?: unknown;
          };
        };

        console.error("Single QR email delivery failed:", {
          code: sendGridError.code,
          details: sendGridError.response?.body
            ? JSON.stringify(sendGridError.response.body, null, 2)
            : emailError instanceof Error
              ? emailError.message
              : "Unknown error",
        });

        const errorMessage =
          emailError instanceof Error
            ? emailError.message.slice(0, 1000)
            : "Unknown email delivery error.";

        try {
          await QRPass.updateOne(
            { _id: qrPass._id },
            {
              $set: {
                emailStatus: "FAILED",
                emailLastError: errorMessage,
              },
            }
          );
        } catch (trackingError) {
          console.error(
            "Unable to update QR email delivery status:",
            trackingError
          );
        }

        qrEmailStatus = "FAILED";
      }
    }

    // 12. Build response and clear employee registration session.
    const response = NextResponse.json(
      {
        success: true,
        message:
          attendanceType === "SINGLE"
            ? "Your registration is approved and your QR pass has been generated."
            : "Your Couple registration has been submitted successfully and is awaiting admin approval.",
        registration: {
          id: registration._id.toString(),
          attendanceType,
          status: registration.status,
        },
        qrPass:
          attendanceType === "SINGLE"
            ? {
                status: "ACTIVE",
                emailStatus: qrEmailStatus,
                ticketImageDataUrl: qrTicketImageDataUrl,
                fileName: `Seasia-Gala-${employee.employeeId}-Ticket.svg`,
                employeeName: employee.fullName,
                employeeId: employee.employeeId,
              }
            : null,
      },
      { status: 201 }
    );

    response.cookies.set("employee_registration_session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error: unknown) {
    console.error("Employee registration submission error:", error);

    // 13. Roll back partial database writes and uploaded files.
    // This runs for registration/QR creation failures, not email failures.
    try {
      if (qrPassId) {
        await QRPass.deleteOne({ _id: qrPassId });
      }

      if (attendeeIds.length > 0) {
        await PartnerDocument.deleteMany({
          attendee: { $in: attendeeIds },
        });

        await Attendee.deleteMany({
          _id: { $in: attendeeIds },
        });
      }

      if (registrationId) {
        await Registration.deleteOne({ _id: registrationId });
      }

      if (documentPath) {
        await deletePartnerDocument(documentPath);
      }
    } catch (rollbackError) {
      console.error("Registration rollback error:", rollbackError);
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "A registration already exists for this employee.",
        },
        { status: 409 }
      );
    }

    const isFileError =
      error instanceof Error &&
      (error.message.includes("5 MB") ||
        error.message.includes("JPG") ||
        error.message.includes("PNG") ||
        error.message.includes("WEBP") ||
        error.message.includes("match its file type"));

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error && isFileError
            ? error.message
            : "Unable to submit your registration. Please try again.",
      },
      { status: isFileError ? 400 : 500 }
    );
  }
}
