// src/app/api/admin/subjects/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Subject } from "@/models/Subject";
import mongoose from "mongoose";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * PATCH /api/admin/subjects/[id]
 * Update a subject
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const subjectId = toObjectIdOrNull(params.id);
    if (!subjectId) {
      return NextResponse.json(
        { success: false, error: "Invalid subject ID" },
        { status: 400 }
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const body = await req.json();

    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) {
      updateData.name = String(body.name).trim();
    }

    if (body.code !== undefined) {
      updateData.code =
        body.code === null || body.code === "" ? null : String(body.code).trim();
    }

    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive === true;
    }

    const updated = await Subject.findOneAndUpdate(
      { _id: subjectId, schoolId: schoolIdObj },
      { $set: updateData },
      { new: true }
    ).lean();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Subject not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: String(updated._id),
        name: updated.name,
        code: updated.code || null,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to update subject";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
