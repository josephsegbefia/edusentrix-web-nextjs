// src/app/api/admin/timetable/master/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { ClassGroup } from "@/models/ClassGroup";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import mongoose from "mongoose";

/**
 * GET /api/admin/timetable/master
 * Get master timetable - all schedules across all classes
 */
export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));

    // Get current academic period
    const currentPeriod = await AcademicPeriod.findOne({
      schoolId: schoolIdObj,
      isCurrent: true,
    })
      .select("_id")
      .lean() as { _id: any } | null;

    if (!currentPeriod) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Get all active assignments with schedules
    const assignments = await TeacherAssignment.find({
      schoolId: schoolIdObj,
      academicPeriodId: currentPeriod._id,
      status: "active",
      schedules: { $exists: true, $ne: [] },
    })
      .populate({
        path: "teacherId",
        select: "userId",
        populate: {
          path: "userId",
          select: "firstName lastName avatarUrl",
        },
      })
      .populate("subjectId", "name code")
      .populate("classGroupId", "name gradeId")
      .populate({
        path: "classGroupId",
        populate: {
          path: "gradeId",
          select: "name level",
        },
      })
      .lean();

    // Transform data for master timetable
    const timetableData = assignments.flatMap((assignment: any) => {
      const teacher = assignment.teacherId;
      const user = teacher?.userId;
      const subject = assignment.subjectId;
      const classGroup = assignment.classGroupId;
      const grade = classGroup?.gradeId;

      if (!subject || !user || !classGroup) return [];

      const schedules = assignment.schedules || [];

      return schedules.map((schedule: any) => ({
        assignmentId: String(assignment._id),
        classId: String(classGroup._id),
        className: classGroup.name,
        gradeName: grade?.name || "Unknown",
        gradeLevel: grade?.level || 0,
        subjectId: String(subject._id),
        subjectName: subject.name,
        subjectCode: subject.code || null,
        teacherId: String(teacher._id),
        teacherName: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        teacherPhotoUrl: user.avatarUrl || null,
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        location: schedule.location || null,
        roomId: schedule.roomId ? String(schedule.roomId) : null,
        contactHoursPerWeek: assignment.contactHoursPerWeek || 0,
      }));
    });

    // Sort by grade level, then class name, then day, then start time
    timetableData.sort((a, b) => {
      if (a.gradeLevel !== b.gradeLevel) return a.gradeLevel - b.gradeLevel;
      if (a.className !== b.className) return a.className.localeCompare(b.className);
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
      return a.startTime.localeCompare(b.startTime);
    });

    return NextResponse.json({ success: true, data: timetableData });
  } catch (e: unknown) {
    console.error("Error fetching master timetable:", e);
    const message =
      e instanceof Error ? e.message : "Failed to fetch master timetable";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
