import "server-only";

import mongoose from "mongoose";
import { LessonSession } from "@/models/LessonSession";
import { LessonDelivery } from "@/models/LessonDelivery";
import {
  computeDurationMinutes,
  listTimetableSlotsForClassSubjectWeek,
} from "@/lib/lessons/timetable-slots-for-week";
import type { TimetableSlotPreview } from "@/types/lessons-v2";
import type { ILessonSession } from "@/models/LessonSession";

function toObjectId(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

type ConflictRow = {
  title: string;
  scheduledDate: Date;
  startTime: string;
  endTime: string;
};

async function findSlotConflictsForClass(input: {
  schoolId: mongoose.Types.ObjectId;
  classGroupId: mongoose.Types.ObjectId;
  slotKeys: Set<string>;
  scheduledDates: Date[];
  slotOids: mongoose.Types.ObjectId[];
}): Promise<ConflictRow | null> {
  const sessions = await LessonSession.find({
    schoolId: input.schoolId,
    classGroupId: input.classGroupId,
    status: { $ne: "archived" },
    scheduledDate: { $in: input.scheduledDates },
    $or: [
      { timetableSlotId: { $in: input.slotOids } },
      { timetableSlotIds: { $in: input.slotOids } },
    ],
  })
    .select("title scheduledDate startTime endTime timetableSlotId timetableSlotIds")
    .lean<
      Array<{
        title: string;
        scheduledDate: Date;
        startTime: string;
        endTime: string;
        timetableSlotId?: mongoose.Types.ObjectId | null;
        timetableSlotIds?: mongoose.Types.ObjectId[];
      }>
    >();

  for (const row of sessions) {
    const date = row.scheduledDate.toISOString().slice(0, 10);
    const ids = [
      ...(row.timetableSlotIds?.map((id) => String(id)) ?? []),
      ...(row.timetableSlotId ? [String(row.timetableSlotId)] : []),
    ];
    if (ids.some((id) => input.slotKeys.has(`${date}:${id}`))) {
      return row;
    }
  }

  const deliveries = await LessonDelivery.find({
    schoolId: input.schoolId,
    classGroupId: input.classGroupId,
    status: { $ne: "cancelled" },
    scheduledDate: { $in: input.scheduledDates },
    $or: [
      { timetableSlotId: { $in: input.slotOids } },
      { timetableSlotIds: { $in: input.slotOids } },
    ],
  })
    .select("scheduledDate startTime endTime timetableSlotId timetableSlotIds sessionId")
    .populate("sessionId", "title")
    .lean<
      Array<{
        scheduledDate?: Date | null;
        startTime?: string | null;
        endTime?: string | null;
        timetableSlotId?: mongoose.Types.ObjectId | null;
        timetableSlotIds?: mongoose.Types.ObjectId[];
        sessionId?: { title?: string } | mongoose.Types.ObjectId | null;
      }>
    >();

  for (const row of deliveries) {
    if (!row.scheduledDate || !row.startTime || !row.endTime) continue;
    const date = row.scheduledDate.toISOString().slice(0, 10);
    const ids = [
      ...(row.timetableSlotIds?.map((id) => String(id)) ?? []),
      ...(row.timetableSlotId ? [String(row.timetableSlotId)] : []),
    ];
    if (ids.some((id) => input.slotKeys.has(`${date}:${id}`))) {
      const sessionTitle =
        row.sessionId &&
        typeof row.sessionId === "object" &&
        "title" in row.sessionId &&
        row.sessionId.title
          ? row.sessionId.title
          : "Lesson";
      return {
        title: sessionTitle,
        scheduledDate: row.scheduledDate,
        startTime: row.startTime,
        endTime: row.endTime,
      };
    }
  }

  return null;
}

export async function createSharedClassDeliveries(input: {
  schoolId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  weekPlanId: mongoose.Types.ObjectId;
  subjectOfferingId: mongoose.Types.ObjectId;
  subjectId?: mongoose.Types.ObjectId | null;
  weekStartDate: Date;
  weekEndDate: Date;
  sessions: ILessonSession[];
  additionalClassGroupIds: mongoose.Types.ObjectId[];
}): Promise<
  | { ok: true; deliveries: Awaited<ReturnType<typeof LessonDelivery.create>>[] }
  | { ok: false; status: number; error: string }
> {
  if (input.additionalClassGroupIds.length === 0) {
    return { ok: true, deliveries: [] };
  }

  const sessionCount = input.sessions.length;
  const created: Awaited<ReturnType<typeof LessonDelivery.create>>[] = [];

  for (const classGroupId of input.additionalClassGroupIds) {
    const timetable = await listTimetableSlotsForClassSubjectWeek({
      schoolId: input.schoolId,
      classGroupId,
      subjectOfferingId: input.subjectOfferingId,
      subjectId: input.subjectId ?? null,
      weekStartDate: input.weekStartDate,
      weekEndDate: input.weekEndDate,
      teacherId: input.teacherId,
    });

    if (!timetable.hasPublishedTimetable || timetable.slots.length === 0) {
      return {
        ok: false,
        status: 400,
        error:
          "Could not find published timetable periods for one of the shared classes in this week.",
      };
    }

    if (timetable.slots.length !== sessionCount) {
      return {
        ok: false,
        status: 400,
        error: `One shared class has ${timetable.slots.length} period${timetable.slots.length === 1 ? "" : "s"} this week, but your plan has ${sessionCount} session${sessionCount === 1 ? "" : "s"}. Use the same number of periods or create a separate plan for that class.`,
      };
    }

    const slotsBySequence = [...timetable.slots].sort((a, b) => {
      const dateCmp = a.scheduledDate.localeCompare(b.scheduledDate);
      if (dateCmp !== 0) return dateCmp;
      return a.startTime.localeCompare(b.startTime);
    });

    const sortedSessions = [...input.sessions].sort(
      (a, b) => a.sequenceInWeek - b.sequenceInWeek,
    );

    for (let i = 0; i < sortedSessions.length; i += 1) {
      const session = sortedSessions[i]!;
      const slot: TimetableSlotPreview = slotsBySequence[i]!;
      const slotIdStrings = slot.timetableSlotIds?.length ? slot.timetableSlotIds : [slot.id];
      const slotOids = slotIdStrings
        .map((id) => toObjectId(id))
        .filter((id): id is mongoose.Types.ObjectId => Boolean(id));
      const scheduledDate = new Date(`${slot.scheduledDate}T00:00:00.000Z`);
      const slotKeys = new Set(slotIdStrings.map((id) => `${slot.scheduledDate}:${id}`));

      const conflict = await findSlotConflictsForClass({
        schoolId: input.schoolId,
        classGroupId,
        slotKeys,
        scheduledDates: [scheduledDate],
        slotOids,
      });

      if (conflict) {
        const date = conflict.scheduledDate.toISOString().slice(0, 10);
        return {
          ok: false,
          status: 409,
          error: `A shared class already has a lesson planned for ${date}, ${conflict.startTime}-${conflict.endTime}: ${conflict.title}.`,
        };
      }

      const delivery = await LessonDelivery.create({
        schoolId: input.schoolId,
        sessionId: session._id,
        weekPlanId: input.weekPlanId,
        classGroupId,
        ownerTeacherId: input.teacherId,
        scheduledTeacherId: input.teacherId,
        status: "scheduled",
        scheduledDate,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        durationMinutes: slot.durationMinutes || computeDurationMinutes(slot.startTime, slot.endTime),
        timetableSlotId: slotOids[0] ?? null,
        timetableSlotIds: slotOids,
      });
      created.push(delivery);
    }
  }

  return { ok: true, deliveries: created };
}
