import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { connectDB } from "@/lib/mongodb";
import { getCurrentAdmin } from "@/lib/auth/session";
import EmailDomain from "@/models/EmailDomain";

import {
  HARDCODED_OFFICIAL_DOMAINS,
  BLOCKED_EMAIL_DOMAINS,
} from "@/config/official-email-domains";

// FIX: Corrected domain regex
const domainRegex =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

const domainSchema = z.object({
  domain: z.string().trim().toLowerCase().min(4).max(253).regex(domainRegex),
});

const createSchema = domainSchema.extend({
  policy: z.enum(["ALLOW", "BLOCK"]),
});

const updateSchema = domainSchema.extend({
  policy: z.enum(["ALLOW", "BLOCK"]).optional(),
  isActive: z.boolean().optional(),
}).refine(
  (data) => data.policy !== undefined || data.isActive !== undefined,
  { message: "Provide a policy or active status to update." }
);

// FIX: Replaced the helper to return status and message correctly
async function authorizeSuperAdmin(request: NextRequest) {
  const admin = await getCurrentAdmin(request);

  if (!admin) {
    return {
      authorized: false as const,
      status: 401,
      message: "Unauthorized access.",
    };
  }

  if (admin.role !== "SUPER_ADMIN") {
    return {
      authorized: false as const,
      status: 403,
      message: "Only Super Admin can manage email domain rules.",
    };
  }

  return {
    authorized: true as const,
    admin,
  };
}

// GET: List hardcoded and Admin-managed domains
export async function GET(request: NextRequest) {
  try {
    // FIX: Updated authorization block
    const authorization = await authorizeSuperAdmin(request);

    if (!authorization.authorized) {
      return NextResponse.json(
        { success: false, message: authorization.message },
        { status: authorization.status }
      );
    }

    await connectDB();

    const adminDomains = await EmailDomain.find().sort({ createdAt: -1 }).lean();

    const adminMap = new Map(
      adminDomains.map((item) => [item.domain, item])
    );

    const allDomains = new Set([
      ...HARDCODED_OFFICIAL_DOMAINS,
      ...BLOCKED_EMAIL_DOMAINS,
      ...adminDomains.map((item) => item.domain),
    ]);

    const domains = Array.from(allDomains).map((domain) => {
      const adminRule = adminMap.get(domain);

      const hardcodedPolicy =
        BLOCKED_EMAIL_DOMAINS.includes(domain)
          ? "BLOCK"
          : HARDCODED_OFFICIAL_DOMAINS.includes(domain)
            ? "ALLOW"
            : null;

      const effectivePolicy = adminRule?.isActive
        ? adminRule.policy
        : hardcodedPolicy;

      return {
        domain,
        source: adminRule ? "ADMIN" : "HARDCODED",
        adminPolicy: adminRule?.policy ?? null,
        adminRuleActive: adminRule?.isActive ?? null,
        effectivePolicy: effectivePolicy ?? "NONE",
        isAllowed: effectivePolicy === "ALLOW",
        isBlocked: effectivePolicy === "BLOCK",
        canDelete: Boolean(adminRule),
        createdAt: adminRule?.createdAt ?? null,
        updatedAt: adminRule?.updatedAt ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      total: domains.length,
      domains,
    });
  } catch (error) {
    console.error("Get email domains error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to fetch email domains." },
      { status: 500 }
    );
  }
}

// POST: Add an Admin allow/block rule
export async function POST(request: NextRequest) {
  try {
    // FIX: Updated authorization block and extracted admin
    const authorization = await authorizeSuperAdmin(request);

    if (!authorization.authorized) {
      return NextResponse.json(
        { success: false, message: authorization.message },
        { status: authorization.status }
      );
    }

    const admin = authorization.admin;

    const validation = createSchema.safeParse(await request.json());

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: validation.error.issues[0]?.message || "Invalid domain.",
        },
        { status: 400 }
      );
    }

    await connectDB();

    const { domain, policy } = validation.data;

    const existing = await EmailDomain.findOne({ domain });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message: "An Admin rule already exists for this domain. Update it instead.",
        },
        { status: 409 }
      );
    }

    const newRule = await EmailDomain.create({
      domain,
      policy,
      isActive: true,
      addedBy: admin._id,
      updatedBy: null,
    });

    return NextResponse.json(
      {
        success: true,
        message: `Domain ${policy === "ALLOW" ? "allowed" : "blocked"} successfully.`,
        domain: {
          domain: newRule.domain,
          policy: newRule.policy,
          isActive: newRule.isActive,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) {
      return NextResponse.json(
        { success: false, message: "An Admin rule already exists for this domain." },
        { status: 409 }
      );
    }

    console.error("Add email domain error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to add email domain." },
      { status: 500 }
    );
  }
}

// PATCH: Change policy or enable/disable an Admin rule
export async function PATCH(request: NextRequest) {
  try {
    // FIX: Updated authorization block and extracted admin
    const authorization = await authorizeSuperAdmin(request);

    if (!authorization.authorized) {
      return NextResponse.json(
        { success: false, message: authorization.message },
        { status: authorization.status }
      );
    }

    const admin = authorization.admin;

    const validation = updateSchema.safeParse(await request.json());

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: validation.error.issues[0]?.message || "Invalid update.",
        },
        { status: 400 }
      );
    }

    await connectDB();

    const { domain, policy, isActive } = validation.data;

    const update: Record<string, unknown> = {
      updatedBy: admin._id,
    };

    if (policy !== undefined) update.policy = policy;
    if (isActive !== undefined) update.isActive = isActive;

    const updatedRule = await EmailDomain.findOneAndUpdate(
      { domain },
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!updatedRule) {
      return NextResponse.json(
        {
          success: false,
          message: "No Admin-managed rule exists for this domain.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Domain rule updated successfully.",
      domain: {
        domain: updatedRule.domain,
        policy: updatedRule.policy,
        isActive: updatedRule.isActive,
      },
    });
  } catch (error) {
    console.error("Update email domain error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to update email domain." },
      { status: 500 }
    );
  }
}

// DELETE: Remove an Admin rule and restore hardcoded behavior
export async function DELETE(request: NextRequest) {
  try {
    // FIX: Updated authorization block
    const authorization = await authorizeSuperAdmin(request);

    if (!authorization.authorized) {
      return NextResponse.json(
        { success: false, message: authorization.message },
        { status: authorization.status }
      );
    }

    // Note: We don't strictly need the admin object here, so we don't extract it.

    const validation = domainSchema.safeParse(await request.json());

    if (!validation.success) {
      return NextResponse.json(
        { success: false, message: "Please provide a valid domain." },
        { status: 400 }
      );
    }

    await connectDB();

    const deletedRule = await EmailDomain.findOneAndDelete({
      domain: validation.data.domain,
    });

    if (!deletedRule) {
      return NextResponse.json(
        {
          success: false,
          message: "No Admin-managed rule exists for this domain.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Admin rule deleted. The domain will now follow its hardcoded policy, if configured; otherwise it will be rejected.",
    });
  } catch (error) {
    console.error("Delete email domain error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to delete email domain." },
      { status: 500 }
    );
  }
}