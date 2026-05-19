import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { LessonNote } from "@/models/LessonNote";
import { gateLessonsModule, isLessonNoteApprovedForDelivery } from "@/lib/lessons/lesson-gates";
import { listTimetableSlotsForClassSubjectWeek } from "@/lib/lessons/timetable-slots-for-week";
import { getCalendarWeekRange } from "@/lib/lessons/week-dates";
import type { WeekCreationContextResponse } from "@/types/lessons-v2";
import { getLessonsModuleSettings } from "@/lib/lessons/settings";
import { getAllocatableNoteSectionKeys } from "@/lib/lessons/note-sections";
import type { ILessonNote } from "@/models/LessonNote";
import { resolveLessonNoteSubjectOffering } from "@/lib/lesson-notes/resolve-note-subject-offering";

function toObjectId(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function parseDateYmd(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const gate = await gateLessonsModule(context.schoolId);
    if (!gate.ok) {
      return Response.json({ success: false, error: gate.error }, { status: gate.status });
    }
    if (!can(context.permissions, PERMISSIONS.lessonsCreate)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const noteOid = toObjectId(id);
    if (!noteOid) {
      return Response.json({ success: false, error: "Invalid lesson note ID" }, { status: 400 });
    }

    const url = new URL(req.url);
    const classGroupIdParam = url.searchParams.get("classGroupId");
    const weekStartParam = url.searchParams.get("weekStartDate");
    const weekEndParam = url.searchParams.get("weekEndDate");

    const note = await LessonNote.findOne({
      _id: noteOid,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    })
      .select("_id topic status subjectId subjectOfferingId classGroupId weekOf templateType body curriculum assessment resources")
      .lean();

    if (!note) {
      return Response.json({ success: false, error: "Lesson note not found" }, { status: 404 });
    }

    const classGroupOid = toObjectId(classGroupIdParam || String(note.classGroupId));
    if (!classGroupOid) {
      return Response.json(
        { success: false, error: "Class group is required" },
        { status: 400 },
      );
    }

    const subjectOfferingResolution = await resolveLessonNoteSubjectOffering({
      schoolId: context.schoolId,
      classGroupId: classGroupOid,
      subjectOfferingId: note.subjectOfferingId ? String(note.subjectOfferingId) : null,
      subjectId: note.subjectId ? String(note.subjectId) : null,
    });

    if (!subjectOfferingResolution.ok) {
      return Response.json(
        { success: false, error: subjectOfferingResolution.error },
        { status: subjectOfferingResolution.status },
      );
    }
    const subjectOfferingOid = subjectOfferingResolution.subjectOfferingId;

    let weekStart = parseDateYmd(weekStartParam);
    let weekEnd = parseDateYmd(weekEndParam);
    let weekLabel =
      url.searchParams.get("weekLabel")?.trim() || "Week";

    if ((!weekStart || !weekEnd) && note.weekOf) {
      const range = getCalendarWeekRange(new Date(note.weekOf));
      weekStart = parseDateYmd(range.weekStartDate);
      weekEnd = parseDateYmd(range.weekEndDate);
      weekLabel = range.weekLabel;
    }

    if (!weekStart || !weekEnd || weekEnd < weekStart) {
      return Response.json(
        {
          success: false,
          error: "Could not determine the calendar week for this lesson note.",
        },
        { status: 400 },
      );
    }

    const approved = isLessonNoteApprovedForDelivery(String(note.status));
    let blockReason: string | null = null;
    if (!approved) {
      blockReason =
        "This lesson note must be approved by your school before you can create weekly lessons.";
    }

    const timetable = await listTimetableSlotsForClassSubjectWeek({
      schoolId: context.schoolId,
      classGroupId: classGroupOid,
      subjectOfferingId: subjectOfferingOid,
      subjectId: note.subjectId ? toObjectId(String(note.subjectId)) : null,
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      teacherId: context.teacherId,
    });

    if (!timetable.hasPublishedTimetable) {
      blockReason =
        blockReason ||
        "No published timetable was found. Ask your school admin to publish the class timetable first.";
    } else if (timetable.slots.length === 0) {
      blockReason =
        blockReason ||
        "No periods for this subject appear on the published timetable for this class during the selected week.";
    }

    const lessonsSettings = await getLessonsModuleSettings(context.schoolId);
    const leoEnabled =
      lessonsSettings.enableLeoLessonTools && can(context.permissions, PERMISSIONS.lessonAiUse);

    const body: WeekCreationContextResponse = {
      success: true,
      data: {
        lessonNote: {
          id: String(note._id),
          topic: note.topic || "Lesson note",
          status: String(note.status),
          weekStartDate: weekStart.toISOString().slice(0, 10),
          weekEndDate: weekEnd.toISOString().slice(0, 10),
        },
        classGroupId: String(classGroupOid),
        subjectOfferingId: String(subjectOfferingOid),
        weekLabel,
        weekStartDate: weekStart.toISOString().slice(0, 10),
        weekEndDate: weekEnd.toISOString().slice(0, 10),
        timetableSlotCount: timetable.slots.length,
        timetableSlots: timetable.slots,
        hasPublishedTimetable: timetable.hasPublishedTimetable,
        canCreate: !blockReason,
        blockReason,
        allocatableNoteSectionKeys: getAllocatableNoteSectionKeys(note as ILessonNote),
        enableLeoLessonTools: leoEnabled,
        requireTeacherReviewForAiContent: lessonsSettings.requireTeacherReviewForAiContent,
      },
    };

    return Response.json(body);
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[week-creation-context]", e);
    const message = e instanceof Error ? e.message : "Failed to load week creation context";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
