// src/app/api/admin/timetable/master/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  resolvePublishedTimetableContext,
  queryPublishedSlots,
  enrichSlotsForDisplay,
} from "@/lib/timetable/read-model";
import { Grade } from "@/models/Grade";
import mongoose from "mongoose";

/**
 * GET /api/admin/timetable/master
 * Get master timetable - all schedules from published TimetableSlot
 */
export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));

    const published = await resolvePublishedTimetableContext(
      schoolIdObj,
      new Date()
    );

    if (!published) {
      return NextResponse.json({ success: true, data: [] });
    }

    const slots = await queryPublishedSlots({
      schoolId: schoolIdObj,
      versionId: published.versionId,
      scope: "school",
      dayOfWeekIn: published.workingDays,
    });

    const enrichedSlots = await enrichSlotsForDisplay({
      schoolId: schoolIdObj,
      slots,
    });

    const gradeIdStrs = Array.from(
      new Set(enrichedSlots.map((s) => s.gradeId).filter(Boolean))
    );
    const gradeIds = gradeIdStrs
      .map((id) => {
        try {
          return new mongoose.Types.ObjectId(id);
        } catch {
          return null;
        }
      })
      .filter((id): id is mongoose.Types.ObjectId => id !== null);
    const grades =
      gradeIds.length > 0
        ? await Grade.find({ schoolId: schoolIdObj, _id: { $in: gradeIds } })
            .select("_id name order")
            .lean()
        : [];
    const gradeOrderMap = new Map(
      grades.map((g: { _id: unknown; order?: number }) => [
        String(g._id),
        (g as { order?: number }).order ?? 0,
      ])
    );

    const timetableData = enrichedSlots.map((slot) => ({
      slotId: slot.id,
      classId: slot.classGroupId,
      className: slot.classGroupName || slot.classGroupId,
      gradeName: slot.gradeName || "Unknown",
      gradeLevel: gradeOrderMap.get(slot.gradeId) ?? 0,
      subjectId: slot.subjectId,
      subjectName: slot.subjectName || slot.subjectId,
      subjectCode: slot.subjectCode || null,
      teacherId: slot.teacherId,
      teacherName: slot.teacherName || slot.teacherId,
      teacherPhotoUrl: null,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      location: slot.classroomLabel || null,
      roomId: null,
    }));

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
