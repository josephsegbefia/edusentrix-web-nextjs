// src/app/api/admin/classes/[id]/students/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { ClassGroup } from "@/models/ClassGroup";
import { Student } from "@/models/Student";
import mongoose from "mongoose";

/**
 * POST /api/admin/classes/[id]/students
 * Add a student to a class
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedAnyPermission([
      "students.edit",
    ]);
    await connectToDatabase();

    const { id: classId } = await params;

    let classIdObj: mongoose.Types.ObjectId;
    try {
      classIdObj = new mongoose.Types.ObjectId(classId);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid class ID" },
        { status: 400 }
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));

    // Verify class exists and belongs to school
    const classGroup = await ClassGroup.findOne({
      _id: classIdObj,
      schoolId: schoolIdObj,
    })
      .select("_id name gradeId capacity")
      .populate("gradeId", "name")
      .lean();

    if (!classGroup) {
      return NextResponse.json(
        { success: false, error: "Class not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { studentId } = body;

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: "Student ID is required" },
        { status: 400 }
      );
    }

    let studentIdObj: mongoose.Types.ObjectId;
    try {
      studentIdObj = new mongoose.Types.ObjectId(studentId);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid student ID" },
        { status: 400 }
      );
    }

    // Verify student exists and belongs to school
    const student = await Student.findOne({
      _id: studentIdObj,
      schoolId: schoolIdObj,
    }).lean();

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    // Check capacity if set
    if ((classGroup as any).capacity) {
      const currentCount = await Student.countDocuments({
        schoolId: schoolIdObj,
        classGroupId: classIdObj,
        status: { $in: ["active", "enrolled"] },
      });

      if (currentCount >= (classGroup as any).capacity) {
        return NextResponse.json(
          {
            success: false,
            error: `Class is at full capacity (${(classGroup as any).capacity} students)`,
          },
          { status: 400 }
        );
      }
    }

    // Update student's class
    await Student.findByIdAndUpdate(studentIdObj, {
      $set: {
        classGroupId: classIdObj,
        gradeId: (classGroup as any).gradeId?._id || (classGroup as any).gradeId,
      },
    });

    const grade = (classGroup as any).gradeId;
    const fullLabel = grade
      ? `${grade.name} ${(classGroup as any).name}`
      : (classGroup as any).name;

    return NextResponse.json({
      success: true,
      message: "Student added to class successfully",
      data: {
        studentId: String(studentIdObj),
        classId: String(classIdObj),
        className: fullLabel,
      },
    });
  } catch (e: unknown) {
    console.error("Error adding student to class:", e);
    const message =
      e instanceof Error ? e.message : "Failed to add student to class";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/classes/[id]/students
 * Remove a student from a class
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedAnyPermission([
      "students.edit",
    ]);
    await connectToDatabase();

    const { id: classId } = await params;

    let classIdObj: mongoose.Types.ObjectId;
    try {
      classIdObj = new mongoose.Types.ObjectId(classId);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid class ID" },
        { status: 400 }
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: "Student ID is required" },
        { status: 400 }
      );
    }

    let studentIdObj: mongoose.Types.ObjectId;
    try {
      studentIdObj = new mongoose.Types.ObjectId(studentId);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid student ID" },
        { status: 400 }
      );
    }

    // Verify student is in this class
    const student = await Student.findOne({
      _id: studentIdObj,
      schoolId: schoolIdObj,
      classGroupId: classIdObj,
    }).lean();

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found in this class" },
        { status: 404 }
      );
    }

    // Remove student from class (set classGroupId to null)
    await Student.findByIdAndUpdate(studentIdObj, {
      $set: { classGroupId: null },
    });

    return NextResponse.json({
      success: true,
      message: "Student removed from class successfully",
    });
  } catch (e: unknown) {
    console.error("Error removing student from class:", e);
    const message =
      e instanceof Error ? e.message : "Failed to remove student from class";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
