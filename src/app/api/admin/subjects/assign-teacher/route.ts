// src/app/api/admin/subjects/assign-teacher/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { Teacher } from "@/models/Teacher";
import { ClassGroup } from "@/models/ClassGroup";
import { SubjectOffering } from "@/models/SubjectOffering";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import mongoose from "mongoose";
import { z } from "zod";
import {
  deactivateOtherTeachersOnSlot,
  findOtherTeachersOnSlot,
} from "@/lib/admin/teacher-assignment-slot";
import { isTimetableApiWriteEnabled } from "@/lib/timetable/feature-flags";
import { syncDraftSlotTeachersFromAssignment } from "@/lib/timetable/sync-slot-teachers-from-assignments";

const AssignTeacherSchema = z.object({
  teacherId: z.string(),
  subjectId: z.string(),
  subjectOfferingId: z.string().optional().nullable(),
  classGroupId: z.string(),
  academicPeriodId: z.string().optional(), // If not provided, use active period
  workloadHours: z.number().min(0).optional(),
  notes: z.string().max(1000).optional(),
  /** Add this teacher alongside existing teacher(s) for the same subject/class/period. */
  allowMultiple: z.boolean().optional(),
  /** Remove active assignments for other teacher(s) on this slot, then assign this teacher. */
  replaceExisting: z.boolean().optional(),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * POST /api/admin/subjects/assign-teacher
 * Assign a teacher to teach a subject in a specific class
 * Includes conflict detection for multiple teachers
 */
export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId: adminUserId } =
      await requireSchoolAdminOrDelegatedAnyPermission(["subjects.edit"]);
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const actorIdObj = adminUserId ? toObjectIdOrNull(String(adminUserId)) : null;
    const warnings: string[] = [];
    const body = await req.json();

    const parsed = AssignTeacherSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      teacherId,
      subjectId,
      subjectOfferingId,
      classGroupId,
      academicPeriodId,
      workloadHours,
      notes,
      allowMultiple,
      replaceExisting,
    } = parsed.data;

    const teacherObjId = toObjectIdOrNull(teacherId);
    const subjectObjId = toObjectIdOrNull(subjectId);
    const explicitSubjectOfferingObjId = subjectOfferingId
      ? toObjectIdOrNull(subjectOfferingId)
      : null;
    const classGroupObjId = toObjectIdOrNull(classGroupId);

    if (!teacherObjId || !subjectObjId || !classGroupObjId) {
      return NextResponse.json(
        { success: false, error: "Invalid IDs provided" },
        { status: 400 }
      );
    }
    if (subjectOfferingId && !explicitSubjectOfferingObjId) {
      return NextResponse.json(
        { success: false, error: "Invalid subject offering ID" },
        { status: 400 }
      );
    }

    // Get academic period
    let periodObjId: mongoose.Types.ObjectId;
    if (academicPeriodId) {
      periodObjId = toObjectIdOrNull(academicPeriodId)!;
      if (!periodObjId) {
        return NextResponse.json(
          { success: false, error: "Invalid academic period ID" },
          { status: 400 }
        );
      }
    } else {
      // Use current period (isCurrent: true)
      const activePeriod = await AcademicPeriod.findOne({
        schoolId: schoolIdObj,
        isCurrent: true,
      })
        .select("_id")
        .lean() as { _id: any } | null;

      if (!activePeriod) {
        return NextResponse.json(
          { success: false, error: "No active academic period found. Please set a current academic period first." },
          { status: 404 }
        );
      }
      periodObjId = activePeriod._id;
    }

    const classGroup = await ClassGroup.findOne({
      _id: classGroupObjId,
      schoolId: schoolIdObj,
    })
      .select("subjectOfferingIds")
      .lean<{ subjectOfferingIds?: mongoose.Types.ObjectId[] } | null>();

    if (!classGroup) {
      return NextResponse.json(
        { success: false, error: "Class not found" },
        { status: 404 }
      );
    }

    let offering = explicitSubjectOfferingObjId
      ? await SubjectOffering.findOne({
          _id: explicitSubjectOfferingObjId,
          schoolId: schoolIdObj,
          subjectId: subjectObjId,
          isActive: true,
        })
          .select("_id subjectId")
          .lean<{ _id: mongoose.Types.ObjectId; subjectId: mongoose.Types.ObjectId } | null>()
      : null;

    if (!offering) {
      offering = await SubjectOffering.findOne({
        _id: { $in: classGroup.subjectOfferingIds || [] },
        schoolId: schoolIdObj,
        subjectId: subjectObjId,
        isActive: true,
      })
        .select("_id subjectId")
        .lean<{ _id: mongoose.Types.ObjectId; subjectId: mongoose.Types.ObjectId } | null>();
    }

    const sameTeacherAssignment = await TeacherAssignment.findOne({
      schoolId: schoolIdObj,
      academicPeriodId: periodObjId,
      subjectId: subjectObjId,
      classGroupId: classGroupObjId,
      teacherId: teacherObjId,
      status: "active",
    })
      .select("_id")
      .lean();

    if (sameTeacherAssignment) {
      return NextResponse.json(
        {
          success: false,
          error: "This teacher is already assigned to this subject and class",
        },
        { status: 409 }
      );
    }

    const othersOnSlot = await findOtherTeachersOnSlot({
      schoolId: schoolIdObj,
      academicPeriodId: periodObjId,
      subjectId: subjectObjId,
      classGroupId: classGroupObjId,
      requestingTeacherId: teacherObjId,
    });
    const hadOthersOnSlot = othersOnSlot.length > 0;

    if (othersOnSlot.length > 0) {
      if (replaceExisting) {
        await deactivateOtherTeachersOnSlot({
          schoolId: schoolIdObj,
          academicPeriodId: periodObjId,
          subjectId: subjectObjId,
          classGroupId: classGroupObjId,
          keepTeacherId: teacherObjId,
        });
      } else if (allowMultiple) {
        // Co-teaching: keep existing active assignments and add this teacher.
      } else {
        const names = othersOnSlot.map((o) => o.displayName).filter(Boolean);
        const summary =
          names.length === 1
            ? `${names[0]} is already assigned to teach this subject in this class for this period.`
            : `${names.slice(0, 3).join(", ")}${names.length > 3 ? ` and ${names.length - 3} more` : ""} already teach this subject in this class for this period.`;

        return NextResponse.json(
          {
            success: false,
            error: summary,
            conflict: {
              type: "other_teachers_on_slot",
              message: summary,
              existingTeachers: othersOnSlot.map((o) => ({
                id: o.teacherId,
                name: o.displayName,
                assignmentId: o.assignmentId,
              })),
            },
          },
          { status: 409 }
        );
      }
    }

    // Ensure the class has this subject in subjectIds (so it appears in Assigned Classes)
    await ClassGroup.updateOne(
      { _id: classGroupObjId, schoolId: schoolIdObj },
      {
        $addToSet: {
          subjectIds: subjectObjId,
          ...(offering?._id ? { subjectOfferingIds: offering._id } : {}),
        },
      }
    );

    // Add subject to teacher's subjectIds (so it appears on teacher profile)
    await Teacher.updateOne(
      { _id: teacherObjId, schoolId: schoolIdObj },
      { $addToSet: { subjectIds: subjectObjId } }
    );

    // Create new assignment
    const assignment = await TeacherAssignment.create({
      teacherId: teacherObjId,
      schoolId: schoolIdObj,
      academicPeriodId: periodObjId,
      subjectId: subjectObjId,
      subjectOfferingId: offering?._id || null,
      classGroupId: classGroupObjId,
      workloadHours: workloadHours || 0,
      notes: notes || undefined,
      assignedBy: actorIdObj || undefined,
      assignedAt: new Date(),
      status: "active",
    });

    if (isTimetableApiWriteEnabled()) {
      await syncDraftSlotTeachersFromAssignment({
        schoolId: schoolIdObj,
        academicPeriodId: periodObjId,
        classGroupId: classGroupObjId,
        subjectId: subjectObjId,
        teacherId: teacherObjId,
        updatedBy: actorIdObj ?? undefined,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Teacher assigned successfully",
      data: {
        id: String(assignment._id),
        teacherId: String(teacherObjId),
        subjectId: String(subjectObjId),
        subjectOfferingId: offering?._id ? String(offering._id) : null,
        classGroupId: String(classGroupObjId),
        academicPeriodId: String(periodObjId),
        hasConflict: hadOthersOnSlot,
      },
      warnings,
    });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Failed to assign teacher";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
