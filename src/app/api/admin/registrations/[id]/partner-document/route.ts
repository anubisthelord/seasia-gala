import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { connectDB } from "@/lib/mongodb";
import { getCurrentAdmin } from "@/lib/auth/session";
import Registration from "@/models/Registration";
import Attendee from "@/models/Attendee";
import PartnerDocument from "@/models/PartnerDocument";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const admin = await getCurrentAdmin(request);
    if (!admin) return NextResponse.json({ success: false, message: "Unauthorized access." }, { status: 401 });
    if (admin.role !== "SUPER_ADMIN" && admin.role !== "REGISTRATION_ADMIN") {
      return NextResponse.json({ success: false, message: "You do not have permission to view partner documents." }, { status: 403 });
    }

    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ success: false, message: "Invalid registration ID." }, { status: 400 });
    await connectDB();

    const registration = await Registration.findById(id).select("_id").lean();
    if (!registration) return NextResponse.json({ success: false, message: "Registration not found." }, { status: 404 });
    const partner = await Attendee.findOne({ registration: registration._id, attendeeType: "PARTNER" }).select("_id").lean();
    if (!partner) return NextResponse.json({ success: false, message: "Partner attendee not found." }, { status: 404 });
    const document = await PartnerDocument.findOne({ attendee: partner._id }).select("storageKey").lean();
    if (!document) return NextResponse.json({ success: false, message: "Partner document not found." }, { status: 404 });

    const storageKey = document.storageKey;
    if (typeof storageKey !== "string" || !/^partner-documents\/[a-f0-9-]+\.(jpg|jpeg|png|webp)$/i.test(storageKey)) {
      return NextResponse.json({ success: false, message: "Invalid image reference." }, { status: 400 });
    }
    const storageRoot = path.resolve(process.cwd(), "storage", "private");
    const filePath = path.resolve(storageRoot, storageKey);
    if (!filePath.startsWith(`${storageRoot}${path.sep}`)) {
      return NextResponse.json({ success: false, message: "Invalid document path." }, { status: 400 });
    }

    const file = await readFile(filePath);
    const contentTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
    };
    const contentType = contentTypes[path.extname(filePath).toLowerCase()];
    if (!contentType) return NextResponse.json({ success: false, message: "Unsupported image format." }, { status: 415 });
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
    console.error("Registration partner document viewing error:", error);
    return NextResponse.json({ success: false, message: "Unable to open partner document." }, { status: 500 });
  }
}
