// src/app/api/admin/subjects/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Subject } from "@/models/Subject";
import { ClassGroup } from "@/models/ClassGroup";
import { TeacherAssignment } from "@/models/TeacherAssignment";
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
 * GET /api/admin/subjects/[id]
 * Get a single subject with detailed information
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id } = await params;
    const subjectId = toObjectIdOrNull(id);
    if (!subjectId) {
      return NextResponse.json(
        { success: false, error: "Invalid subject ID" },
        { status: 400 }
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));

    // Fetch the subject
    const subject = await Subject.findOne({
      _id: subjectId,
      schoolId: schoolIdObj,
    }).lean();

    if (!subject) {
      return NextResponse.json(
        { success: false, error: "Subject not found" },
        { status: 404 }
      );
    }

    // Get current academic period (needed for TeacherAssignment lookup)
    const currentPeriod = await AcademicPeriod.findOne({
      schoolId: schoolIdObj,
      isCurrent: true,
    })
      .select("_id yearLabel term")
      .lean();

    // Assigned Classes: union of
    // 1) ClassGroups with subject in subjectIds
    // 2) ClassGroups from active TeacherAssignments (handles legacy data where subject wasn't added to class)
    const classIdsFromSubject = new Set<string>();
    const classesFromSubject = await ClassGroup.find({
      schoolId: schoolIdObj,
      subjectIds: subjectId,
      isActive: true,
    })
      .select("_id")
      .lean();
    classesFromSubject.forEach((c: any) => classIdsFromSubject.add(String(c._id)));

    let classIdsFromAssignments = new Set<string>();
    if (currentPeriod) {
      const assignmentsWithClass = await TeacherAssignment.find({
        schoolId: schoolIdObj,
        subjectId: subjectId,
        academicPeriodId: (currentPeriod as any)._id,
        status: "active",
      })
        .select("classGroupId")
        .lean();
      assignmentsWithClass.forEach((a: any) =>
        classIdsFromAssignments.add(String(a.classGroupId))
      );
    }

    const allClassIds = new Set([...classIdsFromSubject, ...classIdsFromAssignments]);
    // Backfill: add subject to ClassGroup.subjectIds for classes only in assignments (legacy data)
    const idsOnlyInAssignments = [...classIdsFromAssignments].filter((id) => !classIdsFromSubject.has(id));
    if (idsOnlyInAssignments.length > 0) {
      await ClassGroup.updateMany(
        {
          _id: { $in: idsOnlyInAssignments.map((id) => new mongoose.Types.ObjectId(id)) },
          schoolId: schoolIdObj,
        },
        { $addToSet: { subjectIds: subjectId } }
      );
    }

    const classes = await ClassGroup.find({
      _id: { $in: Array.from(allClassIds).map((id) => new mongoose.Types.ObjectId(id)) },
      schoolId: schoolIdObj,
      isActive: true,
    })
      .populate("gradeId", "name code stage order")
      .lean();

    const classesData = classes.map((cls: any) => {
      const grade = cls.gradeId;
      return {
        id: String(cls._id),
        name: cls.name,
        fullLabel: grade ? `${grade.name} ${cls.name}` : cls.name,
        grade: grade
          ? {
              id: String(grade._id),
              name: grade.name,
            }
          : null,
      };
    });

    // Get teachers assigned to this subject
    let teachersData: Array<{
      assignmentId: string;
      id: string;
      firstName: string;
      lastName: string;
      fullName: string;
      email: string | null;
      photoUrl: string | null;
      classId: string;
      className: string;
    }> = [];

    if (currentPeriod) {
      const assignments = await TeacherAssignment.find({
        schoolId: schoolIdObj,
        subjectId: subjectId,
        academicPeriodId: (currentPeriod as any)._id,
        status: "active",
      })
        .populate({
          path: "teacherId",
          select: "userId",
          populate: {
            path: "userId",
            select: "firstName lastName email avatarUrl",
          },
        })
        .populate({
          path: "classGroupId",
          select: "name",
          populate: {
            path: "gradeId",
            select: "name",
          },
        })
        .lean();

      teachersData = assignments.map((a: any) => {
        const teacher = a.teacherId;
        const user = teacher?.userId;
        const classGroup = a.classGroupId;
        const grade = classGroup?.gradeId;

        return {
          assignmentId: String(a._id || ""),
          id: String(teacher?._id || ""),
          firstName: user?.firstName || "",
          lastName: user?.lastName || "",
          fullName: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "",
          email: user?.email || null,
          photoUrl: user?.avatarUrl || null,
          classId: String(classGroup?._id || ""),
          className: grade
            ? `${grade.name} ${classGroup.name}`
            : classGroup?.name || "Unknown",
        };
      });
    }

    // Count unique teachers
    const uniqueTeacherIds = new Set(teachersData.map((t) => t.id));
    const teacherCount = uniqueTeacherIds.size;

    const data = {
      id: String((subject as any)._id),
      name: (subject as any).name,
      code: (subject as any).code || null,
      isActive: (subject as any).isActive,
      classCount: classesData.length,
      teacherCount,
      classes: classesData,
      teachers: teachersData,
      currentPeriod: currentPeriod
        ? {
            id: String((currentPeriod as any)._id),
            yearLabel: (currentPeriod as any).yearLabel,
            term: (currentPeriod as any).term,
          }
        : null,
      createdAt: new Date((subject as any).createdAt).toISOString(),
      updatedAt: new Date((subject as any).updatedAt).toISOString(),
    };

    return NextResponse.json({ success: true, data });
  } catch (e: unknown) {
    console.error("Error fetching subject:", e);
    const message = e instanceof Error ? e.message : "Failed to fetch subject";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/subjects/[id]
 * Update a subject
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id } = await params;
    const subjectId = toObjectIdOrNull(id);
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
    ).lean() as { _id: any; name: string; code?: string } | null;

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
