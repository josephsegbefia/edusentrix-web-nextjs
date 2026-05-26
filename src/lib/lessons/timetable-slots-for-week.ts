import "server-only";

import mongoose from "mongoose";
import { TimetableSlot, type ITimetableSlot } from "@/models/TimetableSlot";
import { SubjectOffering } from "@/models/SubjectOffering";
import { LessonSession } from "@/models/LessonSession";
import { resolvePublishedTimetableContext } from "@/lib/timetable/read-model";
import type { TimetableSlotPreview } from "@/types/lessons-v2";

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map((p) => Number(p));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

export function computeDurationMinutes(startTime: string, endTime: string): number {
  const diff = parseTimeToMinutes(endTime) - parseTimeToMinutes(startTime);
  return diff > 0 ? diff : 40;
}

function dateOnlyUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDaysUtc(d: Date, days: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function endOfWeekUtc(d: Date): Date {
  return addDaysUtc(dateOnlyUtc(d), 6);
}

/** Map JS Sunday=0..Saturday=6 slot day to date within [weekStart, weekEnd]. */
export function scheduledDateForWeekDay(weekStart: Date, dayOfWeek: number): Date {
  const start = dateOnlyUtc(weekStart);
  const startDow = start.getUTCDay();
  let delta = dayOfWeek - startDow;
  if (delta < 0) delta += 7;
  return addDaysUtc(start, delta);
}

export function formatDateYmdUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function groupAdjacentSlots(rows: ITimetableSlot[], weekStart: Date, weekEnd: Date): TimetableSlotPreview[] {
  const previews: TimetableSlotPreview[] = [];

  type DraftGroup = {
    ids: string[];
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    scheduledDate: string;
    classroomLabel: string | null;
  };

  let current: DraftGroup | null = null;

  const flush = () => {
    if (!current) return;
    previews.push({
      id: current.ids[0]!,
      timetableSlotIds: current.ids,
      periodCount: current.ids.length,
      isDoublePeriod: current.ids.length > 1,
      dayOfWeek: current.dayOfWeek,
      startTime: current.startTime,
      endTime: current.endTime,
      durationMinutes: computeDurationMinutes(current.startTime, current.endTime),
      scheduledDate: current.scheduledDate,
      classroomLabel: current.classroomLabel,
    });
    current = null;
  };

  for (const row of rows) {
    const scheduled = scheduledDateForWeekDay(weekStart, row.dayOfWeek);
    if (scheduled < weekStart || scheduled > weekEnd) continue;

    const scheduledDate = formatDateYmdUtc(scheduled);
    const canJoin =
      current &&
      current.dayOfWeek === row.dayOfWeek &&
      current.scheduledDate === scheduledDate &&
      current.endTime === row.startTime;

    if (!canJoin) {
      flush();
      current = {
        ids: [String(row._id)],
        dayOfWeek: row.dayOfWeek,
        startTime: row.startTime,
        endTime: row.endTime,
        scheduledDate,
        classroomLabel: row.classroomLabel || null,
      };
      continue;
    }

    const openGroup = current;
    if (!openGroup) continue;
    openGroup.ids.push(String(row._id));
    openGroup.endTime = row.endTime;
    openGroup.classroomLabel = openGroup.classroomLabel || row.classroomLabel || null;
  }

  flush();
  return previews;
}

export async function listTimetableSlotsForClassSubjectWeek(input: {
  schoolId: mongoose.Types.ObjectId;
  classGroupId: mongoose.Types.ObjectId;
  subjectOfferingId: mongoose.Types.ObjectId;
  subjectId?: mongoose.Types.ObjectId | null;
  weekStartDate: Date;
  weekEndDate: Date;
  teacherId?: mongoose.Types.ObjectId | null;
}): Promise<{
  hasPublishedTimetable: boolean;
  timetableVersionId: mongoose.Types.ObjectId | null;
  slots: TimetableSlotPreview[];
}> {
  const ctx = await resolvePublishedTimetableContext(input.schoolId, input.weekStartDate);
  if (!ctx) {
    return { hasPublishedTimetable: false, timetableVersionId: null, slots: [] };
  }

  let subjectId = input.subjectId ?? null;
  if (!subjectId) {
    const offering = await SubjectOffering.findOne({
      _id: input.subjectOfferingId,
      schoolId: input.schoolId,
    })
      .select("subjectId")
      .lean<{ subjectId?: mongoose.Types.ObjectId | null } | null>();
    subjectId = offering?.subjectId ?? null;
  }

  const subjectFilters: Record<string, unknown>[] = [{ subjectOfferingId: input.subjectOfferingId }];
  if (subjectId) {
    subjectFilters.push({ subjectId });
  }

  const query: Record<string, unknown> = {
    schoolId: input.schoolId,
    versionId: ctx.versionId,
    classGroupId: input.classGroupId,
    $or: subjectFilters,
  };

  const rows = (await TimetableSlot.find(query)
    .sort({ dayOfWeek: 1, startTime: 1 })
    .lean()) as ITimetableSlot[];

  const weekStart = dateOnlyUtc(input.weekStartDate);
  const weekEnd = dateOnlyUtc(input.weekEndDate);
  const slots = groupAdjacentSlots(rows, weekStart, weekEnd);

  slots.sort((a, b) => {
    const d = a.scheduledDate.localeCompare(b.scheduledDate);
    if (d !== 0) return d;
    return a.startTime.localeCompare(b.startTime);
  });

  return {
    hasPublishedTimetable: true,
    timetableVersionId: ctx.versionId,
    slots,
  };
}

export async function listAvailableTimetableSlotsForClassSubjectUpcoming(input: {
  schoolId: mongoose.Types.ObjectId;
  classGroupId: mongoose.Types.ObjectId;
  subjectOfferingId: mongoose.Types.ObjectId;
  subjectId?: mongoose.Types.ObjectId | null;
  startDate: Date;
  teacherId?: mongoose.Types.ObjectId | null;
  lookaheadWeeks?: number;
  maxSlots?: number;
}): Promise<{
  hasPublishedTimetable: boolean;
  timetableVersionId: mongoose.Types.ObjectId | null;
  slots: TimetableSlotPreview[];
  plannedSlots: Array<
    TimetableSlotPreview & {
      existingLessonTitle: string;
    }
  >;
}> {
  const lookaheadWeeks = Math.max(1, Math.min(input.lookaheadWeeks ?? 8, 16));
  const maxSlots = Math.max(1, Math.min(input.maxSlots ?? 12, 40));
  const start = dateOnlyUtc(input.startDate);
  const candidates: TimetableSlotPreview[] = [];
  let hasPublishedTimetable = false;
  let timetableVersionId: mongoose.Types.ObjectId | null = null;

  for (let offset = 0; offset < lookaheadWeeks; offset += 1) {
    const weekStart = addDaysUtc(start, offset * 7);
    const weekEnd = endOfWeekUtc(weekStart);
    const week = await listTimetableSlotsForClassSubjectWeek({
      schoolId: input.schoolId,
      classGroupId: input.classGroupId,
      subjectOfferingId: input.subjectOfferingId,
      subjectId: input.subjectId ?? null,
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      teacherId: input.teacherId ?? null,
    });

    hasPublishedTimetable = hasPublishedTimetable || week.hasPublishedTimetable;
    timetableVersionId = timetableVersionId || week.timetableVersionId;
    candidates.push(...week.slots);
  }

  if (candidates.length === 0) {
    return { hasPublishedTimetable, timetableVersionId, slots: [], plannedSlots: [] };
  }

  const slotIds = Array.from(
    new Set(
      candidates.flatMap((slot) =>
        slot.timetableSlotIds?.length ? slot.timetableSlotIds : [slot.id],
      ),
    ),
  )
    .map((id) => new mongoose.Types.ObjectId(id));
  const scheduledDates = Array.from(new Set(candidates.map((slot) => slot.scheduledDate))).map(
    (date) => new Date(`${date}T00:00:00.000Z`),
  );
  const conflicts = await LessonSession.find({
    schoolId: input.schoolId,
    classGroupId: input.classGroupId,
    status: { $ne: "archived" },
    scheduledDate: { $in: scheduledDates },
    $or: [{ timetableSlotId: { $in: slotIds } }, { timetableSlotIds: { $in: slotIds } }],
  })
    .select("title scheduledDate timetableSlotId timetableSlotIds")
    .lean<
      Array<{
        title: string;
        scheduledDate: Date;
        timetableSlotId?: mongoose.Types.ObjectId | null;
        timetableSlotIds?: mongoose.Types.ObjectId[];
      }>
    >();

  const conflictByKey = new Map<string, string>();
  for (const conflict of conflicts) {
    const date = formatDateYmdUtc(conflict.scheduledDate);
    const ids = [
      ...(conflict.timetableSlotIds?.map((id) => String(id)) ?? []),
      ...(conflict.timetableSlotId ? [String(conflict.timetableSlotId)] : []),
    ];
    for (const id of ids) {
      conflictByKey.set(`${date}:${id}`, conflict.title);
    }
  }

  const plannedSlots: Array<TimetableSlotPreview & { existingLessonTitle: string }> = [];
  const availableSlots: TimetableSlotPreview[] = [];
  for (const slot of candidates) {
    const ids = slot.timetableSlotIds?.length ? slot.timetableSlotIds : [slot.id];
    const existingLessonTitle = ids
      .map((id) => conflictByKey.get(`${slot.scheduledDate}:${id}`))
      .find(Boolean);
    if (existingLessonTitle) {
      plannedSlots.push({ ...slot, existingLessonTitle });
    } else {
      availableSlots.push(slot);
    }
  }

  return {
    hasPublishedTimetable,
    timetableVersionId,
    slots: availableSlots.slice(0, maxSlots),
    plannedSlots,
  };
}
