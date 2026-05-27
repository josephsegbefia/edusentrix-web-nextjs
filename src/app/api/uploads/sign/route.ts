import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { auth } from "@clerk/nextjs/server";
import { initCloudinary } from "@/lib/cloudinary";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User, IUser } from "@/models/User";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Body validation: we accept the "target" role/category to place under the correct folder
const Body = z.object({
  kind: z.enum(["avatar", "document", "image", "doc"]),
  schoolId: z.string().min(1),
  // For avatars -> subject role (who the image is for): students | teachers | school_admins | parents | staff
  subjectRole: z.string().min(1).optional(), // used when kind is avatar
  // For douments ->  a loose category (e.g, "admissions", "finance", "exams", generic)
  category: z.string().min(1).optional(), // used when kind === "document"
});

const ALLOWED_IMAGE_ROLES = new Set([
  "students",
  "teachers",
  "school_admins",
  "parents",
  "staff",
  "bursars",
]);

function cloudinarySign(params: Record<string, string>) {
  const apiSecret =
    process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET_KEY;
  if (!apiSecret) {
    throw new Error("Missing Cloudinary credentials");
  }
  // cloudinary signature: sort keys alphabetically, join as querystring without "file" and api_key, then sha1
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  const signature = crypto
    .createHash("sha1")
    .update(toSign + apiSecret)
    .digest("hex");
  return signature;
}

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { kind: rawKind, schoolId, subjectRole, category } = parsed.data;
  const kind =
    rawKind === "image" ? "avatar" : rawKind === "doc" ? "document" : rawKind;

  // Auth via Clerk
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Connect DB and load app user
  await connectToDatabase();
  const meRaw = await User.findOne({ clerkUserId: userId })
    .select("_id role schoolId")
    .lean();
  const me = (Array.isArray(meRaw) ? meRaw[0] : meRaw) as Pick<
    IUser,
    "_id" | "role" | "schoolId"
  > | null;
  if (!me)
    return NextResponse.json({ error: "User not found" }, { status: 403 });

  // Authorization: platform_admin can sign for any school; others only for their own school
  const isPlatformAdmin = me.role === "platform_admin";
  const sameSchool = me.schoolId && String(me.schoolId) === schoolId;

  if (!isPlatformAdmin && !sameSchool) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check document storage feature entitlement before issuing upload signature (§13A.9).
  // Platform admins bypass this check so they can upload to any school.
  if (!isPlatformAdmin) {
    const { requireSchoolFeature } = await import("@/lib/subscriptions/guards");
    const { FEATURE_KEYS } = await import("@/lib/subscriptions/feature-keys");
    const featureResult = await requireSchoolFeature(schoolId, FEATURE_KEYS.DOCUMENTS_STORAGE);
    if (!featureResult.allowed) {
      return NextResponse.json(
        { error: "Document storage is not available on your current plan." },
        { status: 403 }
      );
    }
  }

  // Initialize Cloudinary
  initCloudinary();

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
  const apiKey = process.env.CLOUDINARY_API_KEY!;
  const timestamp = Math.floor(Date.now() / 1000).toString();

  let folder = "";
  let resource_type: "image" | "raw" = "image";

  if (kind === "avatar") {
    const roleFolder = (subjectRole || "").toLowerCase().trim();
    if (!ALLOWED_IMAGE_ROLES.has(roleFolder)) {
      return NextResponse.json(
        { error: "Invalid subject role for image" },
        { status: 400 }
      );
    }
    folder = `schools/${schoolId}/avatars/${roleFolder}`;
    resource_type = "image";
  } else {
    // Document
    const cat = (category || "generic").toLowerCase().trim();
    folder = `schools/${schoolId}/documents/${cat}`;
    resource_type = "raw";
  }

  // Base params we sign (do not include the file itself)
  const signedParams: Record<string, string> = {
    timestamp,
    folder,
    unique_filename: "true",
    overwrite: "false",
  };

  // Sign and return upload details
  const signature = cloudinarySign(signedParams);
  return NextResponse.json({
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${resource_type}/upload`,
    cloudName,
    apiKey,
    signature,
    timestamp,
    folder,
    resource_type,
  });
}
