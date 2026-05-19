import "server-only";

import mongoose from "mongoose";
import { LessonWeekPlan } from "@/models/LessonWeekPlan";
import { LessonSession } from "@/models/LessonSession";
import { LessonDelivery } from "@/models/LessonDelivery";
import {
  computeDurationMinutes,
  listTimetableSlotsForClassSubjectWeek,
} from "@/lib/lessons/timetable-slots-for-week";
import { normalizeContentBlocks, validateCoverageWeights } from "@/lib/lessons/content-blocks";
import type { LessonContentBlock } from "@/types/lesson-content-blocks";
import type { TimetableSlotPreview } from "@/types/lessons-v2";

export type WeekPlanSessionInput = {
  timetableSlotId: string;
  timetableSlotIds?: string[];
  title: string;
  include?: boolean;
  noteSectionKeys?: string[];
  schemeItemIds?: string[];
  coverageWeight?: number;
  contentBlocks?: LessonContentBlock[];
};

function toObjectId(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function createWeekPlanWithSessions(input: {
  schoolId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  academicPeriodId: mongoose.Types.ObjectId;
  classGroupId: mongoose.Types.ObjectId;
  subjectOfferingId: mongoose.Types.ObjectId;
  subjectId?: mongoose.Types.ObjectId | null;
  lessonNoteId: mongoose.Types.ObjectId;
  noteTopic: string;
  weekStartDate: Date;
  weekEndDate: Date;
  weekLabel: string;
  title: string;
  sessionInputs?: WeekPlanSessionInput[];
  clonedFromWeekPlanId?: mongoose.Types.ObjectId | null;
}) {
  const timetable = await listTimetableSlotsForClassSubjectWeek({
    schoolId: input.schoolId,
    classGroupId: input.classGroupId,
    subjectOfferingId: input.subjectOfferingId,
    subjectId: input.subjectId ?? null,
    weekStartDate: input.weekStartDate,
    weekEndDate: input.weekEndDate,
    teacherId: input.teacherId,
  });

  if (!timetable.hasPublishedTimetable || timetable.slots.length === 0) {
    return {
      ok: false as const,
      status: 400,
      error:
        "Could not find published timetable periods for this class and subject in the selected week.",
    };
  }

  const slotById = new Map<string, TimetableSlotPreview>(
    timetable.slots.map((s) => [s.id, s]),
  );

  type Row = {
    slot: TimetableSlotPreview;
    title: string;
    noteSectionKeys: string[];
    schemeItemIds: mongoose.Types.ObjectId[];
    coverageWeight: number;
    contentBlocks: LessonContentBlock[];
  };

  let rows: Row[] = [];

  if (input.sessionInputs?.length) {
    for (const row of input.sessionInputs) {
      if (row.include === false) continue;
      const slot = slotById.get(row.timetableSlotId);
      if (!slot) {
        return {
          ok: false as const,
          status: 400,
          error: "One or more timetable slots are invalid for this week.",
        };
      }
      rows.push({
        slot,
        title: row.title.trim(),
        noteSectionKeys: row.noteSectionKeys ?? [],
        schemeItemIds: (row.schemeItemIds ?? [])
          .map((id) => toObjectId(id))
          .filter((id): id is mongoose.Types.ObjectId => Boolean(id)),
        coverageWeight: row.coverageWeight ?? 0,
        contentBlocks: normalizeContentBlocks(row.contentBlocks ?? []),
      });
    }
  } else {
    const defaultWeight = timetable.slots.length > 0 ? 1 / timetable.slots.length : 0;
    rows = timetable.slots.map((slot, index) => ({
      slot,
      title: `${input.noteTopic || "Lesson"} — Session ${index + 1}`,
      noteSectionKeys: [],
      schemeItemIds: [],
      coverageWeight: defaultWeight,
      contentBlocks: [],
    }));
  }

  if (rows.length === 0) {
    return {
      ok: false as const,
      status: 400,
      error: "Select at least one timetable period for this week.",
    };
  }

  const missingWeights = rows.some((r) => !r.coverageWeight || r.coverageWeight <= 0);
  if (missingWeights) {
    const equal = 1 / rows.length;
    rows = rows.map((r) => ({ ...r, coverageWeight: equal }));
  }

  const weightCheck = validateCoverageWeights(rows.map((r) => r.coverageWeight));
  if (!weightCheck.ok) {
    return { ok: false as const, status: 400, error: weightCheck.error };
  }

  const plan = await LessonWeekPlan.create({
    schoolId: input.schoolId,
    academicPeriodId: input.academicPeriodId,
    classGroupId: input.classGroupId,
    subjectOfferingId: input.subjectOfferingId,
    lessonNoteId: input.lessonNoteId,
    ownerTeacherId: input.teacherId,
    weekStartDate: input.weekStartDate,
    weekEndDate: input.weekEndDate,
    weekLabel: input.weekLabel,
    title: input.title,
    status: "ready",
    sessionIds: [],
    timetableVersionId: timetable.timetableVersionId,
    clonedFromWeekPlanId: input.clonedFromWeekPlanId ?? null,
  });

  const sessionDocs = [];
  const deliveryDocs = [];

  for (let i = 0; i < rows.length; i += 1) {
    const { slot, title, noteSectionKeys, schemeItemIds, coverageWeight, contentBlocks } =
      rows[i]!;
    const seq = i + 1;
    const slotOid = toObjectId(slot.id);
    const slotIdStrings: string[] = slot.timetableSlotIds?.length ? slot.timetableSlotIds : [slot.id];
    const slotOids = slotIdStrings
      .map((id) => toObjectId(id))
      .filter((id): id is mongoose.Types.ObjectId => Boolean(id));
    const scheduledDate = new Date(`${slot.scheduledDate}T00:00:00.000Z`);
    const session = await LessonSession.create({
      schoolId: input.schoolId,
      weekPlanId: plan._id,
      lessonNoteId: input.lessonNoteId,
      classGroupId: input.classGroupId,
      subjectOfferingId: input.subjectOfferingId,
      ownerTeacherId: input.teacherId,
      sequenceInWeek: seq,
      timetableSlotId: slotOid,
      timetableSlotIds: slotOids,
      scheduledDate,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      durationMinutes: slot.durationMinutes || computeDurationMinutes(slot.startTime, slot.endTime),
      title,
      status: "draft",
      planNotes: null,
      contentBlocks,
      aiMetadata: contentBlocks.some((b) => b.aiGenerated)
        ? { leoGeneratedAt: new Date(), teacherReviewedAllAi: false }
        : {},
      noteSectionAllocation: {
        schemeItemIds,
        noteSectionKeys,
        coverageWeight,
      },
    });
    const delivery = await LessonDelivery.create({
      schoolId: input.schoolId,
      sessionId: session._id,
      weekPlanId: plan._id,
      classGroupId: input.classGroupId,
      ownerTeacherId: input.teacherId,
      scheduledTeacherId: input.teacherId,
      status: "scheduled",
    });
    sessionDocs.push(session);
    deliveryDocs.push(delivery);
  }

  plan.sessionIds = sessionDocs.map((s) => s._id);
  await plan.save();

  return {
    ok: true as const,
    plan,
    sessions: sessionDocs,
    deliveries: deliveryDocs,
  };
}
