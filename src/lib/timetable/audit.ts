import type { ClientSession, Types } from "mongoose";
import { recordActivity } from "@/lib/audit/recordActivity";
import { TimetableChangeLog, type TimetableChangeAction } from "@/models/TimetableChangeLog";

export type TimetableActivityType =
  | "timetable.version.created"
  | "timetable.version.cloned_from_published"
  | "timetable.conflicts.recomputed"
  | "timetable.slot.created"
  | "timetable.slot.updated"
  | "timetable.slot.deleted"
  | "timetable.version.published"
  | "timetable.version.archived"
  | "timetable.backfill.executed";

export interface RecordTimetableChangeLogInput {
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  versionId: Types.ObjectId;
  action: TimetableChangeAction;
  actorId: Types.ObjectId;
  entityId?: Types.ObjectId | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  session?: ClientSession | null;
}

export async function recordTimetableChangeLog(
  input: RecordTimetableChangeLogInput
): Promise<void> {
  const doc = {
    schoolId: input.schoolId,
    academicPeriodId: input.academicPeriodId,
    versionId: input.versionId,
    action: input.action,
    actorId: input.actorId,
    entityId: input.entityId ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
  };

  if (input.session) {
    await TimetableChangeLog.create([doc], { session: input.session });
    return;
  }

  await TimetableChangeLog.create(doc);
}

export interface RecordTimetableActivityInput {
  schoolId: Types.ObjectId;
  userId: Types.ObjectId;
  type: TimetableActivityType;
  description: string;
  entityType?: string;
  entityId?: Types.ObjectId;
  metadata?: unknown;
}

export async function recordTimetableActivity(
  input: RecordTimetableActivityInput
): Promise<void> {
  const metadata =
    input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
      ? (input.metadata as Record<string, unknown>)
      : undefined;

  await recordActivity({
    schoolId: input.schoolId,
    userId: input.userId,
    type: input.type,
    entityType: input.entityType,
    entityId: input.entityId,
    description: input.description,
    metadata,
  });
}

type ObjectIdLike = Types.ObjectId | string;

export interface TimetableSlotSnapshotInput {
  classGroupId: ObjectIdLike;
  gradeId: ObjectIdLike;
  subjectId: ObjectIdLike;
  teacherId: ObjectIdLike | null | undefined;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  classroomLabel: string;
  source: string;
}

export function buildTimetableSlotSnapshot(
  slot: TimetableSlotSnapshotInput
): Record<string, unknown> {
  return {
    classGroupId: String(slot.classGroupId),
    gradeId: String(slot.gradeId),
    subjectId: String(slot.subjectId),
    teacherId: slot.teacherId ? String(slot.teacherId) : "",
    dayOfWeek: slot.dayOfWeek,
    startTime: slot.startTime,
    endTime: slot.endTime,
    classroomLabel: slot.classroomLabel,
    source: slot.source,
  };
}
