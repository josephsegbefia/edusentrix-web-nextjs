import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Student } from "@/models/Student";

type Params = Promise<{ token: string }>;

function normalizeUploadToken(raw: string | undefined): string {
  if (!raw) return "";
  try {
    return decodeURIComponent(raw.trim());
  } catch {
    return raw.trim();
  }
}

const BodySchema = z.object({
  fileUrl: z.string().url(),
  fileName: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  mimeType: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Params }) {
  try {
    const token = normalizeUploadToken((await params).token);
    if (!token || token.length < 24) {
      return NextResponse.json(
        { success: false, error: "Invalid link" },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid attachment",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const student = await Student.findOne({
      parentDocumentRequests: {
        $elemMatch: { token, fulfilledAt: null },
      },
    });
    if (!student) {
      return NextResponse.json(
        { success: false, error: "This upload link is invalid or already used." },
        { status: 404 }
      );
    }

    const sub = (student.parentDocumentRequests ?? []).find(
      (r) => r.token === token && !r.fulfilledAt
    );
    if (!sub) {
      return NextResponse.json(
        { success: false, error: "This upload link is invalid or already used." },
        { status: 404 }
      );
    }

    const docLabel = `[Requested] ${sub.label}`;
    const displayName =
      parsed.data.fileName?.trim() || docLabel;

    if (!student.recordDocuments) {
      student.recordDocuments = [];
    }
    student.recordDocuments.push({
      name: displayName,
      type: "parent_request",
      fileUrl: parsed.data.fileUrl,
      fileMime: parsed.data.mimeType ?? null,
      fileSize: parsed.data.sizeBytes ?? null,
      notes: sub.message?.trim()
        ? `Request instructions: ${sub.message}`
        : null,
      uploadedAt: new Date(),
      uploadedBy: null,
    });
    sub.fulfilledAt = new Date();
    await student.save();

    return NextResponse.json({
      success: true,
      data: { studentId: String(student._id) },
    });
  } catch (error) {
    console.error("Public student parent-document attach error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to attach file" },
      { status: 500 }
    );
  }
}
