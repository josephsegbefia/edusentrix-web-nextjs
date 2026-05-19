import "server-only";

import mongoose from "mongoose";
import { TimetableSlot, type ITimetableSlot } from "@/models/TimetableSlot";
import { SubjectOffering } from "@/models/SubjectOffering";
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
