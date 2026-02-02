// src/app/api/parent/wards/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent, verifyGuardianAccess } from "@/lib/auth/requireParent";
import { Student } from "@/models/Student";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Guardian } from "@/models/Guardian";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireParent();
    await connectToDatabase();

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid student ID" },
        { status: 400 }
      );
    }

    // Verify guardian access
    await verifyGuardianAccess(context.userId, id);

    // Fetch student
    const student = await Student.findOne({
      _id: new mongoose.Types.ObjectId(id),
      schoolId: context.schoolId,
    })
      .select(
        "_id firstName lastName middleName photoUrl status classGroupId admissionNo dateOfBirth gender createdAt"
      )
      .lean() as {
        _id: mongoose.Types.ObjectId;
        firstName: string;
        lastName: string;
        middleName?: string;
        photoUrl?: string;
        status: string;
        classGroupId?: mongoose.Types.ObjectId;
        admissionNo?: string;
        dateOfBirth?: Date;
        gender?: string;
      } | null;

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    // Get guardian details
    const guardian = await Guardian.findOne({
      userId: context.userId,
      studentId: new mongoose.Types.ObjectId(id),
    })
      .select("relationship isPrimary")
      .lean() as { relationship: string; isPrimary: boolean } | null;

    // Get class group and grade
    let classGroup: { id: string; name: string } | null = null;
    let gradeName: string | null = null;
    
    if (student.classGroupId) {
      const classGroupDoc = await ClassGroup.findById(student.classGroupId)
        .select("_id name gradeId")
        .lean() as { _id: mongoose.Types.ObjectId; name: string; gradeId?: mongoose.Types.ObjectId } | null;
      
      if (classGroupDoc) {
        classGroup = {
          id: String(classGroupDoc._id),
          name: classGroupDoc.name,
        };
        
        if (classGroupDoc.gradeId) {
          const grade = await Grade.findById(classGroupDoc.gradeId)
            .select("name")
            .lean() as { name: string } | null;
          if (grade) {
            gradeName = grade.name;
          }
        }
      }
    }

    const fullName = `${student.firstName || ""} ${student.middleName || ""} ${student.lastName || ""}`
      .replace(/\s+/g, " ")
      .trim();

    return NextResponse.json({
      success: true,
      data: {
        id: String(student._id),
        studentId: String(student._id),
        name: fullName,
        firstName: student.firstName,
        lastName: student.lastName,
        photoUrl: student.photoUrl || null,
        classGroup,
        grade: gradeName,
        admissionNo: student.admissionNo || null,
        status: student.status,
        relationship: guardian?.relationship || "guardian",
        isPrimary: guardian?.isPrimary || false,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Failed to fetch ward detail:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch ward",
      },
      { status: 500 }
    );
  }
}
