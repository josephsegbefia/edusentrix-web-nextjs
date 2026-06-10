import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import crypto from "crypto";
import mongoose from "mongoose";
import { initCloudinary } from "@/lib/cloudinary";
import { connectToDatabase } from "@/db/connectToDatabase";
import { ensureCanonicalUserForClerkSession } from "@/lib/auth/canonical-user";
import { resolveSchoolUploadAccess } from "@/lib/uploads/resolve-school-upload-access";
import { resolveUploaderSchoolAccess } from "@/lib/uploads/resolve-uploader-school-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  kind: z.enum(["avatar", "document", "image", "doc"]),
  schoolId: z.string().min(1),
  subjectRole: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
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

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  const clerk = await clerkClient();
  const cUser = await clerk.users.getUser(clerkUserId);
  const email =
    cUser.primaryEmailAddress?.emailAddress?.toLowerCase() ||
    cUser.emailAddresses?.[0]?.emailAddress?.toLowerCase() ||
    "";

  const user = await ensureCanonicalUserForClerkSession({
    clerkUserId,
    email,
    firstName: cUser.firstName,
    lastName: cUser.lastName,
    avatarUrl: cUser.imageUrl,
  });

  const userId =
    user._id instanceof mongoose.Types.ObjectId
      ? user._id
      : new mongoose.Types.ObjectId(String(user._id));

  const { membershipSchoolIds, activeSchoolId } = await resolveUploaderSchoolAccess({
    userId,
    legacySchoolId: user.schoolId ?? null,
    requestedSchoolId: schoolId,
  });

  const access = await resolveSchoolUploadAccess({
    user: {
      _id: userId,
      role: user.role,
    },
    requestedSchoolId: schoolId,
    activeSchoolId,
    membershipSchoolIds,
  });

  if (!access.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isPlatformOperator = access.isPlatformOperator;
  const isProfileMedia =
    kind === "avatar" ||
    (category || "").toLowerCase().trim() === "branding";

  if (!isPlatformOperator && !isProfileMedia && user.pendingOnboarding !== true) {
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
    const cat = (category || "generic").toLowerCase().trim();
    folder = `schools/${schoolId}/documents/${cat}`;
    resource_type = "raw";
  }

  const signedParams: Record<string, string> = {
    timestamp,
    folder,
    unique_filename: "true",
    overwrite: "false",
  };

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
