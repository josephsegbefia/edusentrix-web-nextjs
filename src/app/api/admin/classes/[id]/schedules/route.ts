// src/app/api/admin/classes/[id]/schedules/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { ClassGroup } from "@/models/ClassGroup";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { getPublishedWeekTimetable } from "@/lib/timetable/read-model";
import mongoose from "mongoose";

/**
 * GET /api/admin/classes/[id]/schedules
 * Get all schedules for subjects in a class.
 * Schedules come from the published timetable (TimetableSlot), not from legacy assignment schedules.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
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

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const classGroup = await ClassGroup.findOne({
      _id: classIdObj,
      schoolId: schoolIdObj,
    })
      .select("_id")
      .lean();

    if (!classGroup) {
      return NextResponse.json(
        { success: false, error: "Class not found" },
        { status: 404 }
      );
    }

    const currentPeriod = await AcademicPeriod.findOne({
      schoolId: schoolIdObj,
      isCurrent: true,
    })
      .select("_id")
      .lean() as { _id: mongoose.Types.ObjectId } | null;

    if (!currentPeriod) {
      return NextResponse.json({ success: true, data: [] });
    }

    const assignments = await TeacherAssignment.find({
      schoolId: schoolIdObj,
      classGroupId: classIdObj,
      academicPeriodId: currentPeriod._id,
      status: "active",
    })
      .populate({
        path: "teacherId",
        select: "userId",
        populate: {
          path: "userId",
          select: "firstName lastName avatarUrl",
        },
      })
      .populate("subjectOfferingId", "displayName shortName code subjectId")
      .populate("subjectId", "name code")
      .lean();

    const weekly = await getPublishedWeekTimetable({
      schoolId: schoolIdObj,
      targetDate: new Date(),
      scope: "class",
      classGroupId: classIdObj,
    });

    const slotBySubjectTeacher = new Map<
      string,
      Array<{ dayOfWeek: number; startTime: string; endTime: string; location: string | null; roomId: string | null }>
    >();

    if (!("error" in weekly) && weekly.data?.days) {
      for (const day of weekly.data.days) {
        for (const slot of day.slots || []) {
          const slotRecord = slot as typeof slot & { subjectOfferingId?: string | null };
          const key = `${slotRecord.subjectOfferingId || slot.subjectId}|${slot.teacherId}`;
          if (!slotBySubjectTeacher.has(key)) {
            slotBySubjectTeacher.set(key, []);
          }
          const list = slotBySubjectTeacher.get(key)!;
          list.push({
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
            location: slot.classroomLabel || null,
            roomId: null,
          });
        }
      }
      for (const [, list] of slotBySubjectTeacher) {
        list.sort((a, b) => {
          if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
          return a.startTime.localeCompare(b.startTime);
        });
      }
    }

    const data = assignments
      .map((assignment: Record<string, unknown>) => {
        const teacher = assignment.teacherId as { _id: mongoose.Types.ObjectId; userId?: { firstName?: string; lastName?: string; avatarUrl?: string } } | null;
        const user = teacher?.userId;
        const offering = assignment.subjectOfferingId as
          | { _id: mongoose.Types.ObjectId; subjectId?: mongoose.Types.ObjectId; displayName?: string; shortName?: string; code?: string }
          | null
          | undefined;
        const subject = assignment.subjectId as { _id: mongoose.Types.ObjectId; name: string; code?: string } | null;

        if (!subject || !user) return null;

        const key = `${offering?._id || subject._id}|${teacher._id}`;
        const schedules = slotBySubjectTeacher.get(key) || [];

        return {
          subjectOfferingId: offering?._id ? String(offering._id) : null,
          subjectId: String(subject._id),
          subjectName: offering?.displayName || offering?.shortName || subject.name,
          subjectCode: offering?.code || subject.code || null,
          assignmentId: String(assignment._id),
          teacherId: String(teacher._id),
          teacherName: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
          teacherPhotoUrl: user.avatarUrl || null,
          contactHoursPerWeek: (assignment.contactHoursPerWeek as number) || 0,
          schedulesCount: schedules.length,
          schedules: schedules.map((s) => ({
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            location: s.location,
            roomId: s.roomId,
          })),
        };
      })
      .filter(Boolean);

    return NextResponse.json({ success: true, data });
  } catch (e: unknown) {
    console.error("Error fetching schedules:", e);
    const message =
      e instanceof Error ? e.message : "Failed to fetch schedules";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
