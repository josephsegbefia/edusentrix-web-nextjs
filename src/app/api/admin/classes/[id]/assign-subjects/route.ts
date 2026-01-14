// src/app/api/admin/classes/[id]/assign-subjects/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { ClassGroup } from "@/models/ClassGroup";
import mongoose from "mongoose";
import { z } from "zod";

const AssignSubjectsSchema = z.object({
  subjectIds: z.array(z.string()),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * POST /api/admin/classes/[id]/assign-subjects
 * Assign subjects to a class group
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id } = await params;
    const classId = toObjectIdOrNull(id);
    if (!classId) {
      return NextResponse.json(
        { success: false, error: "Invalid class ID" },
        { status: 400 }
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const body = await req.json();

    const parsed = AssignSubjectsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { subjectIds } = parsed.data;
    const subjectObjectIds = subjectIds
      .map(toObjectIdOrNull)
      .filter((id): id is mongoose.Types.ObjectId => id !== null);

    const updated = await ClassGroup.findOneAndUpdate(
      { _id: classId, schoolId: schoolIdObj },
      { $set: { subjectIds: subjectObjectIds } },
      { new: true }
    )
      .populate("subjectIds", "name code")
      .lean();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Class not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Assigned ${subjectIds.length} subject(s) to class`,
      data: {
        id: String((updated as any)._id),
        name: (updated as any).name,
        subjects: ((updated as any).subjectIds || []).map((s: any) => ({
          id: String(s._id),
          name: s.name,
          code: s.code || null,
        })),
      },
    });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Failed to assign subjects";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
