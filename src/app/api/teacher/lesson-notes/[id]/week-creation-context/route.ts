import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { LessonNote } from "@/models/LessonNote";
import { SchemeItem } from "@/models/SchemeItem";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { gateLessonsModule, isLessonNoteApprovedForDelivery } from "@/lib/lessons/lesson-gates";
import {
  listAvailableTimetableSlotsForClassSubjectUpcoming,
  listTimetableSlotsForClassSubjectWeek,
} from "@/lib/lessons/timetable-slots-for-week";
import {
  addDaysUtc,
  dateOnlyUtc,
  formatDateYmdUtc,
  getCalendarWeekRange,
  getWeekStartMondayUtc,
} from "@/lib/lessons/week-dates";
import { parseGhanaDateLabel } from "@/lib/time/ghana";
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

function minDate(values: Date[]) {
  return values.reduce<Date | null>((min, value) => {
    const date = dateOnlyUtc(value);
    return !min || date < min ? date : min;
  }, null);
}

function maxDate(values: Date[]) {
  return values.reduce<Date | null>((max, value) => {
    const date = dateOnlyUtc(value);
    return !max || date > max ? date : max;
  }, null);
}

async function resolveSchemeWeekContext(input: {
  schoolId: mongoose.Types.ObjectId;
  schemeId?: mongoose.Types.ObjectId | null;
  schemeItemIds?: mongoose.Types.ObjectId[] | null;
  academicPeriodId?: mongoose.Types.ObjectId | null;
}): Promise<{ weekStart: Date; weekEnd: Date; weekLabel: string } | null> {
  const schemeItemIds = (input.schemeItemIds ?? []).filter((id) =>
    mongoose.Types.ObjectId.isValid(String(id)),
  );
  if (!schemeItemIds.length) return null;

  const items = await SchemeItem.find({
    _id: { $in: schemeItemIds },
    schoolId: input.schoolId,
    ...(input.schemeId ? { schemeId: input.schemeId } : {}),
  })
    .select("weekNumber plannedStartDate plannedEndDate weekEndingLabel sequence")
    .sort({ weekNumber: 1, sequence: 1 })
    .lean<
      Array<{
        weekNumber?: number | null;
        plannedStartDate?: Date | null;
        plannedEndDate?: Date | null;
        weekEndingLabel?: string | null;
      }>
    >();

  if (!items.length) return null;

  const explicitStarts = items
    .map((item) => item.plannedStartDate)
    .filter((date): date is Date => Boolean(date));
  const explicitEnds = items
    .map((item) => item.plannedEndDate ?? parseGhanaDateLabel(item.weekEndingLabel))
    .filter((date): date is Date => Boolean(date));
  const derivedStarts = explicitEnds.map((date) => getWeekStartMondayUtc(date));

  let weekStart = minDate([...explicitStarts, ...derivedStarts]);
  let weekEnd = maxDate(explicitEnds);

  const weekNumbers = Array.from(
    new Set(
      items
        .map((item) => item.weekNumber)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
    ),
  ).sort((a, b) => a - b);

  if ((!weekStart || !weekEnd) && weekNumbers.length && input.academicPeriodId) {
    const period = await AcademicPeriod.findOne({
      _id: input.academicPeriodId,
      schoolId: input.schoolId,
    })
      .select("startDate endDate")
      .lean<{ startDate: Date; endDate: Date } | null>();

    if (period) {
      const periodStart = getWeekStartMondayUtc(period.startDate);
      const firstWeek = weekNumbers[0]!;
      const lastWeek = weekNumbers[weekNumbers.length - 1]!;
      weekStart = weekStart ?? addDaysUtc(periodStart, (firstWeek - 1) * 7);
      const computedEnd = addDaysUtc(periodStart, lastWeek * 7 - 1);
      const periodEnd = dateOnlyUtc(period.endDate);
      weekEnd = weekEnd ?? (computedEnd < periodEnd ? computedEnd : periodEnd);
    }
  }

  if (!weekStart && weekEnd) weekStart = getWeekStartMondayUtc(weekEnd);
  if (weekStart && !weekEnd) weekEnd = addDaysUtc(weekStart, 6);
  if (!weekStart || !weekEnd || weekEnd < weekStart) return null;

  const weekLabel =
    weekNumbers.length === 1
      ? `Scheme Week ${weekNumbers[0]}`
      : weekNumbers.length > 1
        ? `Scheme Weeks ${weekNumbers[0]}-${weekNumbers[weekNumbers.length - 1]}`
        : "Scheme Week";

  return { weekStart, weekEnd, weekLabel };
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
      .select(
        "_id topic status subjectId subjectOfferingId classGroupId weekOf weekEndingDate academicPeriodId schemeId schemeItemIds templateType body curriculum assessment resources",
      )
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

    if (!weekStart || !weekEnd) {
      const schemeWeek = await resolveSchemeWeekContext({
        schoolId: context.schoolId,
        schemeId: note.schemeId ? toObjectId(String(note.schemeId)) : null,
        schemeItemIds: (note.schemeItemIds ?? [])
          .map((id) => toObjectId(String(id)))
          .filter((id): id is mongoose.Types.ObjectId => Boolean(id)),
        academicPeriodId: note.academicPeriodId ? toObjectId(String(note.academicPeriodId)) : null,
      });

      if (schemeWeek) {
        weekStart = schemeWeek.weekStart;
        weekEnd = schemeWeek.weekEnd;
        weekLabel = schemeWeek.weekLabel;
      }
    }

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
    const suggestedTimetable = await listAvailableTimetableSlotsForClassSubjectUpcoming({
      schoolId: context.schoolId,
      classGroupId: classGroupOid,
      subjectOfferingId: subjectOfferingOid,
      subjectId: note.subjectId ? toObjectId(String(note.subjectId)) : null,
      startDate: weekStart,
      teacherId: context.teacherId,
      lookaheadWeeks: 10,
      maxSlots: Math.max(timetable.slots.length, 1),
    });

    if (!timetable.hasPublishedTimetable && !suggestedTimetable.hasPublishedTimetable) {
      blockReason =
        blockReason ||
        "No published timetable was found. Ask your school admin to publish the class timetable first.";
    } else if (suggestedTimetable.slots.length === 0) {
      blockReason =
        blockReason ||
        "No available periods for this subject appear on the published timetable for this class. Existing periods may already be planned.";
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
          weekStartDate: formatDateYmdUtc(weekStart),
          weekEndDate: formatDateYmdUtc(weekEnd),
        },
        classGroupId: String(classGroupOid),
        subjectOfferingId: String(subjectOfferingOid),
        weekLabel,
        weekStartDate: formatDateYmdUtc(weekStart),
        weekEndDate: formatDateYmdUtc(weekEnd),
        timetableSlotCount: suggestedTimetable.slots.length,
        timetableSlots: suggestedTimetable.slots,
        hasPublishedTimetable:
          timetable.hasPublishedTimetable || suggestedTimetable.hasPublishedTimetable,
        canCreate: !blockReason,
        blockReason,
        allocatableNoteSectionKeys: getAllocatableNoteSectionKeys(note as ILessonNote),
        noteSchemeItemIds: (note.schemeItemIds ?? []).map((id) => String(id)),
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
