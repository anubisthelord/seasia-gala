
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getCurrentAdmin } from "@/lib/auth/session";

import Registration from "@/models/Registration";
import Attendee from "@/models/Attendee";
import PartnerDocument from "@/models/PartnerDocument";
import RegistrationAudit from "@/models/RegistrationAudit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

type ReviewAction =
  | "APPROVE_REGISTRATION"
  | "REJECT_REGISTRATION"
  | "REQUEST_CORRECTION"
  | "APPROVE_PARTNER_DOCUMENT"
  | "REJECT_PARTNER_DOCUMENT";

const VALID_ACTIONS: ReviewAction[] = [
  "APPROVE_REGISTRATION",
  "REJECT_REGISTRATION",
  "REQUEST_CORRECTION",
  "APPROVE_PARTNER_DOCUMENT",
  "REJECT_PARTNER_DOCUMENT",
];

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    // 1. Authenticate admin
    const admin = await getCurrentAdmin(request);

    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Unauthorized access." },
        { status: 401 }
      );
    }
    
    if (
      admin.role !== "SUPER_ADMIN" &&
      admin.role !== "REGISTRATION_ADMIN"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "You do not have permission to perform this review action.",
        },
        { status: 403 }
      );
    }

    // 2. Validate registration ID
    const { id } = await params;

    if (!/^[a-fA-F0-9]{24}$/.test(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid registration ID." },
        { status: 400 }
      );
    }

    // 3. Validate request body
    const body = await request.json();

    const action = body.action as ReviewAction;
    const reason =
      typeof body.reason === "string" ? body.reason.trim() : "";

    if (!VALID_ACTIONS.includes(action)) {
      return NextResponse.json(
        { success: false, message: "Invalid review action." },
        { status: 400 }
      );
    }

    if (reason.length > 1000) {
      return NextResponse.json(
        { success: false, message: "Reason cannot exceed 1000 characters." },
        { status: 400 }
      );
    }

    const requiresReason = [
      "REJECT_REGISTRATION",
      "REQUEST_CORRECTION",
      "REJECT_PARTNER_DOCUMENT",
    ].includes(action);

    if (requiresReason && !reason) {
      return NextResponse.json(
        {
          success: false,
          message: "A reason is required for this action.",
        },
        { status: 400 }
      );
    }

    await connectDB();

    const adminId = admin._id;

    // 4. Find registration
    const registration = await Registration.findById(id);

    if (!registration) {
      return NextResponse.json(
        { success: false, message: "Registration not found." },
        { status: 404 }
      );
    }

    // 5. Handle employee registration decisions
    if (
      action === "APPROVE_REGISTRATION" ||
      action === "REJECT_REGISTRATION" ||
      action === "REQUEST_CORRECTION"
    ) {
      if (registration.status !== "PENDING_ADMIN_APPROVAL") {
        return NextResponse.json(
          {
            success: false,
            message: `This registration cannot be reviewed because its current status is ${registration.status}.`,
          },
          { status: 409 }
        );
      }

      const previousStatus = registration.status;

      const newStatus =
        action === "APPROVE_REGISTRATION"
          ? "APPROVED"
          : action === "REJECT_REGISTRATION"
            ? "REJECTED"
            : "CORRECTION_REQUESTED";

      const reviewedAt = new Date();

      const updatedRegistration =
        await Registration.findOneAndUpdate(
          {
            _id: id,
            status: "PENDING_ADMIN_APPROVAL",
          },
          {
            $set: {
              status: newStatus,
              reviewedBy: adminId,
              reviewedAt,
              rejectionReason:
                action === "REJECT_REGISTRATION" ? reason : null,
              correctionReason:
                action === "REQUEST_CORRECTION" ? reason : null,
            },
          },
          { new: true }
        );

      if (!updatedRegistration) {
        return NextResponse.json(
          {
            success: false,
            message: "Registration was already reviewed. Refresh and try again.",
          },
          { status: 409 }
        );
      }

      // 6. Save audit record
      try {
        await RegistrationAudit.create({
          registration: registration._id,
          admin: adminId,
          action,
          previousStatus,
          newStatus,
          attendee: null,
          reason: reason || null,
        });
      } catch (auditError) {
        // Compensate if the audit record could not be saved.
        await Registration.findOneAndUpdate(
          {
            _id: id,
            status: newStatus,
            reviewedBy: adminId,
            reviewedAt,
          },
          {
            $set: {
              status: previousStatus,
              reviewedBy: null,
              reviewedAt: null,
              rejectionReason: null,
              correctionReason: null,
            },
          }
        );

        throw auditError;
      }

      return NextResponse.json({
        success: true,
        message: `Registration ${newStatus.toLowerCase().replaceAll("_", " ")} successfully.`,
        data: {
          registrationId: updatedRegistration._id,
          status: updatedRegistration.status,
          reviewedAt: updatedRegistration.reviewedAt,
        },
      });
    }

    // 7. Handle partner document decisions
    if (registration.attendanceType !== "COUPLE") {
      return NextResponse.json(
        {
          success: false,
          message: "Partner document review is only available for Couple registrations.",
        },
        { status: 400 }
      );
    }

    const partnerAttendee = await Attendee.findOne({
      registration: registration._id,
      attendeeType: "PARTNER",
    });

    if (!partnerAttendee) {
      return NextResponse.json(
        { success: false, message: "Partner attendee not found." },
        { status: 404 }
      );
    }

    const partnerDocument = await PartnerDocument.findOne({
      attendee: partnerAttendee._id,
    });

    if (!partnerDocument) {
      return NextResponse.json(
        { success: false, message: "Partner document not found." },
        { status: 404 }
      );
    }

    if (partnerDocument.verificationStatus !== "PENDING") {
      return NextResponse.json(
        {
          success: false,
          message: `This document has already been reviewed. Current status: ${partnerDocument.verificationStatus}.`,
        },
        { status: 409 }
      );
    }

    const previousStatus = partnerDocument.verificationStatus;

    const newStatus =
      action === "APPROVE_PARTNER_DOCUMENT"
        ? "APPROVED"
        : "REJECTED";

    const reviewedAt = new Date();

    const updatedDocument =
      await PartnerDocument.findOneAndUpdate(
        {
          _id: partnerDocument._id,
          verificationStatus: "PENDING",
        },
        {
          $set: {
            verificationStatus: newStatus,
            reviewedBy: adminId,
            reviewedAt,
            rejectionReason:
              action === "REJECT_PARTNER_DOCUMENT" ? reason : null,
          },
        },
        { new: true }
      );

    if (!updatedDocument) {
      return NextResponse.json(
        {
          success: false,
          message: "Partner document was already reviewed. Refresh and try again.",
        },
        { status: 409 }
      );
    }

    // 8. Save partner document audit record
    try {
      await RegistrationAudit.create({
        registration: registration._id,
        admin: adminId,
        action,
        previousStatus,
        newStatus,
        attendee: partnerAttendee._id,
        reason: reason || null,
      });
    } catch (auditError) {
      // Compensate if the audit record could not be saved.
      await PartnerDocument.findOneAndUpdate(
        {
          _id: partnerDocument._id,
          verificationStatus: newStatus,
          reviewedBy: adminId,
          reviewedAt,
        },
        {
          $set: {
            verificationStatus: previousStatus,
            reviewedBy: null,
            reviewedAt: null,
            rejectionReason: null,
          },
        }
      );

      throw auditError;
    }

    return NextResponse.json({
      success: true,
      message: `Partner document ${newStatus.toLowerCase()} successfully.`,
      data: {
        registrationId: registration._id,
        attendeeId: partnerAttendee._id,
        verificationStatus: updatedDocument.verificationStatus,
        reviewedAt: updatedDocument.reviewedAt,
      },
    });
  } catch (error) {
    console.error("Admin registration review error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to process the review action.",
      },
      { status: 500 }
    );
  }
}
