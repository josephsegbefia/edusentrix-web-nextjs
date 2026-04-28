import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Student } from "@/models/Student";
import { deleteUploadedFile } from "@/lib/uploads/delete";

const postBodySchema = z.object({
  name: z.string().min(1).max(200).trim(),
  type: z.enum([
    "report_card",
    "medical",
    "consent",
    "identification",
    "disciplinary",
    "other",
  ]),
  fileUrl: z.string().url(),
  fileMime: z.string().optional().nullable(),
  fileSize: z.number().int().nonnegative().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

function toObjectId(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * POST /api/admin/students/:id/documents
 * Attach a staff-uploaded file to the student record.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { schoolId, userId } = await requireSchoolAdminOrDelegatedAnyPermission([
    "students.edit",
  ]);
  await connectToDatabase();

  const { id } = await ctx.params;
  const studentOid = toObjectId(id);
  if (!studentOid) {
    return NextResponse.json({ error: "Invalid student id" }, { status: 400 });
  }

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = postBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { name, type, fileUrl, fileMime, fileSize, notes } = parsed.data;
  const normalizedFileUrl = String(fileUrl).trim();

  let updated: mongoose.FlattenMaps<{
    recordDocuments?: { _id: mongoose.Types.ObjectId }[];
  }> | null;
  try {
    updated = await Student.findOneAndUpdate(
      { _id: studentOid, schoolId: schoolIdObj },
      {
        $push: {
          recordDocuments: {
            name,
            type,
            fileUrl: normalizedFileUrl,
            fileMime: fileMime ?? null,
            fileSize: fileSize ?? null,
            notes: notes ?? null,
            uploadedAt: new Date(),
            uploadedBy: userId,
          },
        },
      },
      { new: true }
    ).lean();
  } catch (err) {
    console.error("Student document save failed:", err);
    const deleted = await deleteUploadedFile(normalizedFileUrl);
    if (!deleted) {
      console.error(
        "Rollback failed for student document upload:",
        normalizedFileUrl
      );
    }
    return NextResponse.json(
      { error: "Failed to save document" },
      { status: 500 }
    );
  }

  if (!updated) {
    const deleted = await deleteUploadedFile(normalizedFileUrl);
    if (!deleted) {
      console.error(
        "Rollback failed for student document upload:",
        normalizedFileUrl
      );
    }
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const docs = updated.recordDocuments;
  const last = docs?.[docs.length - 1];

  return NextResponse.json({
    success: true,
    data: {
      id: last?._id ? String(last._id) : null,
      name,
      type,
    },
  });
}
