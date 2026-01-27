// src/app/api/admin/classes/[id]/roles/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { StudentClassRole } from "@/models/StudentClassRole";
import { ClassRoleDefinition } from "@/models/ClassRoleDefinition";
import { ClassGroup } from "@/models/ClassGroup";
import { Student } from "@/models/Student";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import mongoose from "mongoose";
import { z } from "zod";

const AssignRoleSchema = z.object({
  studentId: z.string(),
  roleDefinitionId: z.string(),
  subjectId: z.string().optional(), // For subject-specific roles
  startDate: z.string().optional(), // ISO date
  endDate: z.string().nullable().optional(),
  notes: z.string().max(500).optional(),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * GET /api/admin/classes/[id]/roles
 * Fetch all role assignments for a class in the current academic period
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id: classId } = await params;
    const classIdObj = toObjectIdOrNull(classId);
    if (!classIdObj) {
      return NextResponse.json(
        { success: false, error: "Invalid class ID" },
        { status: 400 }
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));

    // Verify class exists
    const classGroup = await ClassGroup.findOne({
      _id: classIdObj,
      schoolId: schoolIdObj,
    }).lean();

    if (!classGroup) {
      return NextResponse.json(
        { success: false, error: "Class not found" },
        { status: 404 }
      );
    }

    // Get current academic period
    const currentPeriod = await AcademicPeriod.findOne({
      schoolId: schoolIdObj,
      isCurrent: true,
    })
      .select("_id yearLabel term")
      .lean() as { _id: any; yearLabel: string; term: string } | null;

    if (!currentPeriod) {
      return NextResponse.json({
        success: true,
        data: [],
        message: "No active academic period",
      });
    }

    // Fetch role assignments
    const assignments = await StudentClassRole.find({
      schoolId: schoolIdObj,
      classGroupId: classIdObj,
      academicPeriodId: currentPeriod._id,
      isActive: true,
    })
      .populate("studentId", "firstName lastName photoUrl admissionNo")
      .populate("roleDefinitionId", "name code category maxPerClass")
      .populate("subjectId", "name code")
      .populate("assignedBy", "firstName lastName")
      .sort({ "roleDefinitionId.category": 1, "roleDefinitionId.name": 1 })
      .lean();

    const data = assignments.map((assignment) => {
      const student = assignment.studentId as any;
      const role = assignment.roleDefinitionId as any;
      const subject = assignment.subjectId as any;
      const assignedBy = assignment.assignedBy as any;

      return {
        id: String(assignment._id),
        student: {
          id: String(student._id),
          firstName: student.firstName,
          lastName: student.lastName,
          fullName: `${student.firstName} ${student.lastName}`.trim(),
          photoUrl: student.photoUrl || null,
          admissionNo: student.admissionNo || null,
        },
        role: {
          id: String(role._id),
          name: role.name,
          code: role.code,
          category: role.category,
          maxPerClass: role.maxPerClass ?? null,
        },
        subject: subject
          ? {
              id: String(subject._id),
              name: subject.name,
              code: subject.code || null,
            }
          : null,
        assignedBy: assignedBy
          ? {
              id: String(assignedBy._id),
              fullName: `${assignedBy.firstName || ""} ${assignedBy.lastName || ""}`.trim(),
            }
          : null,
        assignedAt: new Date(assignment.assignedAt).toISOString(),
        startDate: new Date(assignment.startDate).toISOString(),
        endDate: assignment.endDate
          ? new Date(assignment.endDate).toISOString()
          : null,
        notes: assignment.notes || null,
      };
    });

    // Group by role category
    const grouped = {
      leadership: data.filter((a) => a.role.category === "leadership"),
      academic: data.filter((a) => a.role.category === "academic"),
      service: data.filter((a) => a.role.category === "service"),
      social: data.filter((a) => a.role.category === "social"),
      custom: data.filter((a) => a.role.category === "custom"),
    };

    return NextResponse.json({
      success: true,
      data,
      grouped,
      academicPeriod: {
        id: String(currentPeriod._id),
        yearLabel: currentPeriod.yearLabel,
        term: currentPeriod.term,
      },
    });
  } catch (e: unknown) {
    console.error("Error fetching class roles:", e);
    const message = e instanceof Error ? e.message : "Failed to fetch class roles";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/classes/[id]/roles
 * Assign a role to a student in this class
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id: classId } = await params;
    const classIdObj = toObjectIdOrNull(classId);
    if (!classIdObj) {
      return NextResponse.json(
        { success: false, error: "Invalid class ID" },
        { status: 400 }
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const body = await req.json();

    const parsed = AssignRoleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { studentId, roleDefinitionId, subjectId, startDate, endDate, notes } =
      parsed.data;

    const studentIdObj = toObjectIdOrNull(studentId);
    const roleIdObj = toObjectIdOrNull(roleDefinitionId);
    const subjectIdObj = subjectId ? toObjectIdOrNull(subjectId) : null;

    if (!studentIdObj || !roleIdObj) {
      return NextResponse.json(
        { success: false, error: "Invalid student or role ID" },
        { status: 400 }
      );
    }

    // Verify class exists
    const classGroup = await ClassGroup.findOne({
      _id: classIdObj,
      schoolId: schoolIdObj,
    }).lean();

    if (!classGroup) {
      return NextResponse.json(
        { success: false, error: "Class not found" },
        { status: 404 }
      );
    }

    // Verify student exists and belongs to this class
    const student = await Student.findOne({
      _id: studentIdObj,
      schoolId: schoolIdObj,
      classGroupId: classIdObj,
    }).lean() as { _id: any; firstName: string; lastName: string } | null;

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found in this class" },
        { status: 404 }
      );
    }

    // Verify role definition exists
    const roleDef = await ClassRoleDefinition.findOne({
      _id: roleIdObj,
      schoolId: schoolIdObj,
      isActive: true,
    }).lean() as { _id: any; name: string; maxPerClass?: number } | null;

    if (!roleDef) {
      return NextResponse.json(
        { success: false, error: "Role definition not found or inactive" },
        { status: 404 }
      );
    }

    // Get current academic period
    const currentPeriod = await AcademicPeriod.findOne({
      schoolId: schoolIdObj,
      isCurrent: true,
    })
      .select("_id")
      .lean() as { _id: any } | null;

    if (!currentPeriod) {
      return NextResponse.json(
        { success: false, error: "No active academic period found" },
        { status: 404 }
      );
    }

    // Check maxPerClass constraint
    if (roleDef.maxPerClass) {
      const existingCount = await StudentClassRole.countDocuments({
        schoolId: schoolIdObj,
        classGroupId: classIdObj,
        academicPeriodId: currentPeriod._id,
        roleDefinitionId: roleIdObj,
        subjectId: subjectIdObj, // Same subject for subject-specific roles
        isActive: true,
      });

      if (existingCount >= roleDef.maxPerClass) {
        return NextResponse.json(
          {
            success: false,
            error: `Maximum of ${roleDef.maxPerClass} student(s) can have the "${roleDef.name}" role in this class`,
          },
          { status: 409 }
        );
      }
    }

    // Check if student already has this role
    const existingAssignment = await StudentClassRole.findOne({
      schoolId: schoolIdObj,
      studentId: studentIdObj,
      classGroupId: classIdObj,
      academicPeriodId: currentPeriod._id,
      roleDefinitionId: roleIdObj,
      subjectId: subjectIdObj,
      isActive: true,
    }).lean();

    if (existingAssignment) {
      return NextResponse.json(
        { success: false, error: "Student already has this role assigned" },
        { status: 409 }
      );
    }

    // Create assignment
    const assignment = await StudentClassRole.create({
      schoolId: schoolIdObj,
      studentId: studentIdObj,
      classGroupId: classIdObj,
      academicPeriodId: currentPeriod._id,
      roleDefinitionId: roleIdObj,
      subjectId: subjectIdObj,
      assignedBy: userId ? new mongoose.Types.ObjectId(String(userId)) : undefined,
      assignedAt: new Date(),
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
      isActive: true,
      notes,
    });

    return NextResponse.json({
      success: true,
      message: `${roleDef.name} role assigned to ${student.firstName} ${student.lastName}`,
      data: {
        id: String(assignment._id),
        studentId: String(studentIdObj),
        roleDefinitionId: String(roleIdObj),
        roleName: roleDef.name,
      },
    });
  } catch (e: unknown) {
    console.error("Error assigning class role:", e);
    const message = e instanceof Error ? e.message : "Failed to assign role";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/classes/[id]/roles
 * Remove a role assignment (deactivate)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id: classId } = await params;
    const classIdObj = toObjectIdOrNull(classId);
    if (!classIdObj) {
      return NextResponse.json(
        { success: false, error: "Invalid class ID" },
        { status: 400 }
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const url = new URL(req.url);
    const assignmentId = url.searchParams.get("assignmentId");

    if (!assignmentId) {
      return NextResponse.json(
        { success: false, error: "Assignment ID is required" },
        { status: 400 }
      );
    }

    const assignmentIdObj = toObjectIdOrNull(assignmentId);
    if (!assignmentIdObj) {
      return NextResponse.json(
        { success: false, error: "Invalid assignment ID" },
        { status: 400 }
      );
    }

    // Deactivate the assignment
    const result = await StudentClassRole.findOneAndUpdate(
      {
        _id: assignmentIdObj,
        schoolId: schoolIdObj,
        classGroupId: classIdObj,
        isActive: true,
      },
      {
        $set: {
          isActive: false,
          endDate: new Date(),
        },
      },
      { new: true }
    ).lean();

    if (!result) {
      return NextResponse.json(
        { success: false, error: "Assignment not found or already inactive" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Role assignment removed",
    });
  } catch (e: unknown) {
    console.error("Error removing class role:", e);
    const message = e instanceof Error ? e.message : "Failed to remove role";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
