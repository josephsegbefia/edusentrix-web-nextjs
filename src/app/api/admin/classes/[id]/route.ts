// src/app/api/admin/classes/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { ClassGroup } from "@/models/ClassGroup";
import mongoose from "mongoose";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * PATCH /api/admin/classes/[id]
 * Update a class (e.g., assign homeroom teacher)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { schoolId, userId: adminUserId } = await requireSchoolAdmin();
    await connectToDatabase();

    const classId = toObjectIdOrNull(params.id);
    if (!classId) {
      return NextResponse.json(
        { success: false, error: "Invalid class ID" },
        { status: 400 }
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const body = await req.json();

    const updateData: Record<string, unknown> = {};

    if (body.homeroomTeacherId !== undefined) {
      if (body.homeroomTeacherId === null || body.homeroomTeacherId === "") {
        updateData.homeroomTeacherId = null;
      } else {
        const teacherId = toObjectIdOrNull(body.homeroomTeacherId);
        if (!teacherId) {
          return NextResponse.json(
            { success: false, error: "Invalid teacher ID" },
            { status: 400 }
          );
        }
        updateData.homeroomTeacherId = teacherId;
      }
    }

    if (body.name !== undefined) {
      updateData.name = String(body.name).trim();
    }

    if (body.capacity !== undefined) {
      updateData.capacity =
        body.capacity === null || body.capacity === ""
          ? null
          : parseInt(String(body.capacity), 10);
    }

    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive === true;
    }

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

    return NextResponse.json({
      success: true,
      data: {
        id: String(updated._id),
        name: updated.name,
        homeroomTeacherId: updated.homeroomTeacherId
          ? String(updated.homeroomTeacherId._id)
          : null,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to update class";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
