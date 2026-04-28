// src/app/api/admin/students/[id]/roles/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { StudentClassRole } from "@/models/StudentClassRole";
import { Student } from "@/models/Student";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import mongoose from "mongoose";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * GET /api/admin/students/[id]/roles
 * Fetch all role assignments for a student (current period and history)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("students");
    await connectToDatabase();

    const { id: studentId } = await params;
    const studentIdObj = toObjectIdOrNull(studentId);
    if (!studentIdObj) {
      return NextResponse.json(
        { success: false, error: "Invalid student ID" },
        { status: 400 }
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const url = new URL(req.url);
    const includeHistory = url.searchParams.get("history") === "1";

    // Verify student exists
    const student = await Student.findOne({
      _id: studentIdObj,
      schoolId: schoolIdObj,
    })
      .select("_id firstName lastName classGroupId")
      .lean();

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
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

    // Build query
    const query: Record<string, unknown> = {
      schoolId: schoolIdObj,
      studentId: studentIdObj,
    };

    if (!includeHistory && currentPeriod) {
      query.academicPeriodId = currentPeriod._id;
      query.isActive = true;
    }

    // Fetch role assignments
    const assignments = await StudentClassRole.find(query)
      .populate("roleDefinitionId", "name code category description")
      .populate("classGroupId", "name gradeId")
      .populate({
        path: "classGroupId",
        populate: { path: "gradeId", select: "name" },
      })
      .populate("subjectId", "name code")
      .populate("academicPeriodId", "yearLabel term")
      .sort({ assignedAt: -1 })
      .lean();

    const data = assignments.map((assignment) => {
      const role = assignment.roleDefinitionId as any;
      const classGroup = assignment.classGroupId as any;
      const subject = assignment.subjectId as any;
      const period = assignment.academicPeriodId as any;
      const grade = classGroup?.gradeId;

      return {
        id: String(assignment._id),
        role: role
          ? {
              id: String(role._id),
              name: role.name,
              code: role.code,
              category: role.category,
              description: role.description || null,
            }
          : null,
        classGroup: classGroup
          ? {
              id: String(classGroup._id),
              name: classGroup.name,
              fullLabel: grade ? `${grade.name} ${classGroup.name}` : classGroup.name,
            }
          : null,
        subject: subject
          ? {
              id: String(subject._id),
              name: subject.name,
              code: subject.code || null,
            }
          : null,
        academicPeriod: period
          ? {
              id: String(period._id),
              yearLabel: period.yearLabel,
              term: period.term,
            }
          : null,
        isActive: assignment.isActive,
        assignedAt: new Date(assignment.assignedAt).toISOString(),
        startDate: new Date(assignment.startDate).toISOString(),
        endDate: assignment.endDate
          ? new Date(assignment.endDate).toISOString()
          : null,
        notes: assignment.notes || null,
      };
    });

    // Separate current and historical
    const currentRoles = data.filter((r) => r.isActive);
    const historicalRoles = data.filter((r) => !r.isActive);

    return NextResponse.json({
      success: true,
      data: currentRoles,
      history: includeHistory ? historicalRoles : undefined,
      currentPeriod: currentPeriod
        ? {
            id: String(currentPeriod._id),
            yearLabel: currentPeriod.yearLabel,
            term: currentPeriod.term,
          }
        : null,
    });
  } catch (e: unknown) {
    console.error("Error fetching student roles:", e);
    const message = e instanceof Error ? e.message : "Failed to fetch student roles";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
