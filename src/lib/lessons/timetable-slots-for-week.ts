import "server-only";

import mongoose from "mongoose";
import { TimetableSlot, type ITimetableSlot } from "@/models/TimetableSlot";
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

export async function listTimetableSlotsForClassSubjectWeek(input: {
  schoolId: mongoose.Types.ObjectId;
  classGroupId: mongoose.Types.ObjectId;
  subjectOfferingId: mongoose.Types.ObjectId;
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

  const query: Record<string, unknown> = {
    schoolId: input.schoolId,
    versionId: ctx.versionId,
    classGroupId: input.classGroupId,
    subjectOfferingId: input.subjectOfferingId,
  };
  if (input.teacherId) {
    query.$or = [{ teacherId: input.teacherId }, { teacherId: null }, { teacherId: { $exists: false } }];
  }

  const rows = (await TimetableSlot.find(query)
    .sort({ dayOfWeek: 1, startTime: 1 })
    .lean()) as ITimetableSlot[];

  const weekStart = dateOnlyUtc(input.weekStartDate);
  const weekEnd = dateOnlyUtc(input.weekEndDate);

  const slots: TimetableSlotPreview[] = [];
  for (const row of rows) {
    const scheduled = scheduledDateForWeekDay(weekStart, row.dayOfWeek);
    if (scheduled < weekStart || scheduled > weekEnd) continue;
    slots.push({
      id: String(row._id),
      dayOfWeek: row.dayOfWeek,
      startTime: row.startTime,
      endTime: row.endTime,
      durationMinutes: computeDurationMinutes(row.startTime, row.endTime),
      scheduledDate: formatDateYmdUtc(scheduled),
      classroomLabel: row.classroomLabel || null,
    });
  }

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
