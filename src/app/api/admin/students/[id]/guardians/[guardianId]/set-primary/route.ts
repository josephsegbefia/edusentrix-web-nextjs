// src/app/api/admin/students/[id]/guardians/[guardianId]/set-primary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Student } from "@/models/Student";
import { Guardian } from "@/models/Guardian";
import { recordActivity } from "@/lib/audit/recordActivity";
import mongoose from "mongoose";

// PATCH - Set guardian as primary
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; guardianId: string }> }
) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id, guardianId } = await ctx.params;

    if (
      !mongoose.Types.ObjectId.isValid(id) ||
      !mongoose.Types.ObjectId.isValid(guardianId)
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid ID" },
        { status: 400 }
      );
    }

    // Verify student belongs to admin's school
    const student = await Student.findOne({
      _id: new mongoose.Types.ObjectId(id),
      schoolId: new mongoose.Types.ObjectId(schoolId),
    }).lean();

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    // Find guardian
    const guardian = await Guardian.findOne({
      _id: new mongoose.Types.ObjectId(guardianId),
      studentId: new mongoose.Types.ObjectId(id),
    }).lean();

    if (!guardian) {
      return NextResponse.json(
        { success: false, error: "Guardian not found" },
        { status: 404 }
      );
    }

    const studentIdObj = new mongoose.Types.ObjectId(id);
    const guardianIdObj = new mongoose.Types.ObjectId(guardianId);

    // Unset other primary guardians
    await Guardian.updateMany(
      {
        studentId: studentIdObj,
        _id: { $ne: guardianIdObj },
        isPrimary: true,
      },
      { $set: { isPrimary: false } }
    );

    // Set this guardian as primary
    await Guardian.updateOne(
      { _id: guardianIdObj },
      { $set: { isPrimary: true } }
    );

    // Record activity
    await recordActivity({
      schoolId: new mongoose.Types.ObjectId(schoolId),
      userId: new mongoose.Types.ObjectId(userId),
      type: "guardian.set_primary",
      entityType: "student",
      entityId: String(studentIdObj),
      description: `Set guardian as primary contact`,
      metadata: {
        guardianId: String(guardianIdObj),
        studentId: String(studentIdObj),
      },
    });

    // Fetch updated guardian
    const updatedGuardian = await Guardian.findById(guardianIdObj)
      .populate("userId", "firstName lastName email avatarUrl")
      .lean();

    const user = (updatedGuardian as any).userId as any;

    return NextResponse.json({
      success: true,
      data: {
        id: String(updatedGuardian!._id),
        userId: String(user._id),
        fullName: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        relationship: (updatedGuardian as any).relationship,
        phone: (updatedGuardian as any).phone || "",
        email: (updatedGuardian as any).email || user.email || "",
        occupation: (updatedGuardian as any).occupation || null,
        photoUrl:
          (updatedGuardian as any).photoUrl || user.avatarUrl || null,
        isPrimary: true,
        createdAt: (updatedGuardian as any).createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to set primary guardian:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to set primary guardian",
      },
      { status: 500 }
    );
  }
}
