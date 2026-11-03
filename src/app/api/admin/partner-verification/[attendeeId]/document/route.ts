import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { connectDB } from "@/lib/mongodb";
import { getCurrentAdmin } from "@/lib/auth/session";

import Attendee from "@/models/Attendee";
import PartnerDocument from "@/models/PartnerDocument";

type RouteContext = {
  params: Promise<{ attendeeId: string }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext
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
          message: "You do not have permission to view partner documents.",
        },
        { status: 403 }
      );
    }

    // 2. Validate attendee ID
    const { attendeeId } = await context.params;

    if (!Types.ObjectId.isValid(attendeeId)) {
      return NextResponse.json(
        { success: false, message: "Invalid attendee ID." },
        { status: 400 }
      );
    }

    await connectDB();

    // 3. Confirm this is a partner attendee
    const attendee = await Attendee.findOne({
      _id: attendeeId,
      attendeeType: "PARTNER",
    }).select("_id");

    if (!attendee) {
      return NextResponse.json(
        { success: false, message: "Partner attendee not found." },
        { status: 404 }
      );
    }

    // 4. Find associated document
    const document = await PartnerDocument.findOne({
      attendee: attendee._id,
    }).select("documentType storageKey");

    if (!document) {
      return NextResponse.json(
        { success: false, message: "Partner document not found." },
        { status: 404 }
      );
    }

    // 5. Validate private storage key (images only)
    const storageKey = document.storageKey;

    if (
      typeof storageKey !== "string" ||
      !/^partner-documents\/[a-f0-9-]+\.(jpg|jpeg|png|webp)$/i.test(
        storageKey
      )
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid image reference." },
        { status: 400 }
      );
    }

    const storageRoot = path.resolve(
      process.cwd(),
      "storage",
      "private"
    );

    const filePath = path.resolve(storageRoot, storageKey);

    if (!filePath.startsWith(storageRoot + path.sep)) {
      return NextResponse.json(
        { success: false, message: "Invalid document path." },
        { status: 400 }
      );
    }

    // 6. Read private file
    const file = await readFile(filePath);

    const extension = path.extname(filePath).toLowerCase();

    const contentTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
    };

    const contentType = contentTypes[extension];

    if (!contentType) {
      return NextResponse.json(
        { success: false, message: "Unsupported image format." },
        { status: 415 }
      );
    }

    // 7. Return file without caching
    return new NextResponse(new Uint8Array(file), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    console.error("Partner document viewing error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to open partner document." },
      { status: 500 }
    );
  }
}