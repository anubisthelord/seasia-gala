import "server-only";

import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

import { connectDB } from "@/lib/mongodb";
import Admin from "@/models/Admin";
import AdminSession from "@/models/AdminSession";

const COOKIE_NAME = "admin_session";
const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours

export function isNextPrerenderInterruption(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    (error as { digest?: string }).digest === "NEXT_PRERENDER_INTERRUPTED"
  );
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createAdminSession(adminId: string) {
  await connectDB();

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION);

  await AdminSession.create({
    adminId,
    tokenHash: hashToken(token),
    expiresAt,
  });

  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getCurrentAdmin(request?: NextRequest) {
  await connectDB();

  const token = (await cookies()).get(COOKIE_NAME)?.value;

  if (!token) return null;

  // FIXED: Extract the date outside the query to satisfy Next.js 16 cacheComponents
  const currentTime = new Date();

  const session = await AdminSession.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: currentTime },
  });

  if (!session) return null;

  const admin = await Admin.findOne({
    _id: session.adminId,
    isActive: true,
  }).select("_id fullName email role");

  if (!admin) return null;

  return admin;
}

export async function destroyAdminSession(request?: NextRequest) {
  await connectDB();

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    await AdminSession.deleteOne({
      tokenHash: hashToken(token),
    });
  }

  cookieStore.delete(COOKIE_NAME);
}
