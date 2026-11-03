
import { NextRequest, NextResponse } from "next/server";
import { destroyAdminSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    await destroyAdminSession(request);

    return NextResponse.json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (error) {
    console.error("Admin logout error:", error);

    return NextResponse.json(
      { message: "Unable to log out." },
      { status: 500 }
    );
  }
}
