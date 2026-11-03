
import "server-only";

import { connectDB } from "@/lib/mongodb";
import EmailDomain from "@/models/EmailDomain";

import {
  HARDCODED_OFFICIAL_DOMAINS,
  BLOCKED_EMAIL_DOMAINS,
} from "@/config/official-email-domains";

export async function isOfficialEmailAllowed(
  email: string
): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  const emailParts = normalizedEmail.split("@");

  if (
    emailParts.length !== 2 ||
    !emailParts[0] ||
    !emailParts[1]
  ) {
    return false;
  }

  const domain = emailParts[1];

  await connectDB();

  const adminRule = await EmailDomain.findOne({
    domain,
    isActive: true,
  }).lean();

  // Active Admin rules take priority over hardcoded rules.
  if (adminRule) {
    return adminRule.policy === "ALLOW";
  }

  // Hardcoded blocklist
  if (BLOCKED_EMAIL_DOMAINS.includes(domain)) {
    return false;
  }

  // Hardcoded allowlist
  if (HARDCODED_OFFICIAL_DOMAINS.includes(domain)) {
    return true;
  }

  // Unknown domains are rejected.
  return false;
}
