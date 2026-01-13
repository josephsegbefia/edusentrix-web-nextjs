// src/app/api/admin/classes/[id]/assign-homeroom/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { ClassGroup } from "@/models/ClassGroup";
import mongoose from "mongoose";
import { z } from "zod";

const AssignHomeroomSchema = z.object({
  teacherId: z.string().nullable(),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * POST /api/admin/classes/[id]/assign-homeroom
 * Assign or remove homeroom teacher for a class
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

    const parsed = AssignHomeroomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { teacherId } = parsed.data;
    const updateData: Record<string, unknown> = {
      homeroomTeacherId: teacherId ? toObjectIdOrNull(teacherId) : null,
    };

    const updated = await ClassGroup.findOneAndUpdate(
      { _id: classId, schoolId: schoolIdObj },
      { $set: updateData },
      { new: true }
    )
      .populate("gradeId", "name code")
      .populate("homeroomTeacherId", "userId")
      .populate("homeroomTeacherId.userId", "firstName lastName email avatarUrl")
      .lean();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Class not found" },
        { status: 404 }
      );
    }

    const updatedDoc = Array.isArray(updated) ? updated[0] : updated;

    return NextResponse.json({
      success: true,
      message: teacherId
        ? "Homeroom teacher assigned"
        : "Homeroom teacher removed",
      data: {
        id: String(updatedDoc._id),
        name: updatedDoc.name,
        homeroomTeacher: updatedDoc.homeroomTeacherId
          ? {
              id: String((updatedDoc.homeroomTeacherId as any)._id),
              firstName:
                (updatedDoc.homeroomTeacherId as any).userId?.firstName || "",
              lastName:
                (updatedDoc.homeroomTeacherId as any).userId?.lastName || "",
              fullName: (updatedDoc.homeroomTeacherId as any).userId
                ? `${(updatedDoc.homeroomTeacherId as any).userId.firstName || ""} ${(updatedDoc.homeroomTeacherId as any).userId.lastName || ""}`.trim()
                : "",
            }
          : null,
      },
    });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Failed to assign homeroom teacher";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
