import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getParentWardIds, requireParent } from "@/lib/auth/requireParent";
import { Student } from "@/models/Student";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "document";
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireParent();
    await connectToDatabase();
    const form = await req.formData();
    const requestId = String(form.get("requestId") || "");
    const wardId = String(form.get("wardId") || "");
    const file = form.get("file");
    if (!mongoose.Types.ObjectId.isValid(requestId) || !mongoose.Types.ObjectId.isValid(wardId) || !(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Invalid upload payload" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ success: false, error: "File is too large" }, { status: 413 });
    }
    if (file.type && !ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ success: false, error: "Unsupported file type" }, { status: 400 });
    }

    const wardIds = await getParentWardIds(ctx.userId);
    if (!wardIds.some((id) => String(id) === wardId)) {
      return NextResponse.json({ success: false, error: "You do not have access to this child" }, { status: 403 });
    }
    const student = await Student.findOne({ _id: wardId, schoolId: ctx.schoolId, status: "active" });
    const requestDoc = student?.parentDocumentRequests?.find((request) => String(request._id) === requestId);
    if (!student || !requestDoc) {
      return NextResponse.json({ success: false, error: "Document request not found" }, { status: 404 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const filename = `${randomUUID()}-${safeFileName(file.name || "document")}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "parent-documents", String(ctx.schoolId));
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), bytes);
    const fileUrl = `/uploads/parent-documents/${String(ctx.schoolId)}/${filename}`;

    student.recordDocuments = student.recordDocuments ?? [];
    student.recordDocuments.push({
      name: file.name || requestDoc.label,
      type: "parent_request",
      fileUrl,
      fileMime: file.type || null,
      fileSize: file.size,
      notes: requestDoc.message ? `Request instructions: ${requestDoc.message}` : null,
      uploadedAt: new Date(),
      uploadedBy: ctx.userId,
    });
    requestDoc.fulfilledAt = new Date();
    await student.save();

    return NextResponse.json({ success: true, data: { success: true, fileUrl } });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Failed to upload document";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
