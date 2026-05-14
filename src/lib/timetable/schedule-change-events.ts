import { Types } from "mongoose";
import {
  ScheduleChangeEvent,
  type ScheduleChangeAction,
  type ScheduleChangeEntityType,
} from "@/models/ScheduleChangeEvent";
import { TimetableVersion } from "@/models/TimetableVersion";

export async function recordScheduleChangeEvent(args: {
  schoolId: Types.ObjectId;
  academicPeriodId?: Types.ObjectId | null;
  entityType: ScheduleChangeEntityType;
  entityId: Types.ObjectId;
  action: ScheduleChangeAction;
  affectedClassGroupIds?: Types.ObjectId[];
  affectedTeacherIds?: Types.ObjectId[];
  affectedSubjectIds?: Types.ObjectId[];
  affectedRoomIds?: Types.ObjectId[];
  message?: string | null;
  createdBy?: Types.ObjectId | null;
}) {
  await ScheduleChangeEvent.create({
    schoolId: args.schoolId,
    academicPeriodId: args.academicPeriodId ?? null,
    entityType: args.entityType,
    entityId: args.entityId,
    action: args.action,
    affectedClassGroupIds: args.affectedClassGroupIds ?? [],
    affectedTeacherIds: args.affectedTeacherIds ?? [],
    affectedSubjectIds: args.affectedSubjectIds ?? [],
    affectedRoomIds: args.affectedRoomIds ?? [],
    message: args.message ?? null,
    createdBy: args.createdBy ?? null,
  });
}

export async function markPublishedTimetableStale(args: {
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  sourceModule:
    | "teacher"
    | "subject"
    | "subjectOffering"
    | "classGroup"
    | "teacherAssignment"
    | "schoolDailySchedule";
  sourceEntityId?: Types.ObjectId | null;
  message: string;
  actorId?: Types.ObjectId | null;
}) {
  const now = new Date();
  const set: Record<string, unknown> = { stale: true };
  if (args.actorId) set.updatedBy = args.actorId;

  const result = await TimetableVersion.updateMany(
    {
      schoolId: args.schoolId,
      academicPeriodId: args.academicPeriodId,
      status: "published",
    },
    {
      $set: set,
      $push: {
        staleReasons: {
          sourceModule: args.sourceModule,
          sourceEntityId: args.sourceEntityId ?? null,
          message: args.message,
          createdAt: now,
        },
      },
    }
  );

  if ((result.modifiedCount ?? 0) > 0) {
    await recordScheduleChangeEvent({
      schoolId: args.schoolId,
      academicPeriodId: args.academicPeriodId,
      entityType: "timetableVersion",
      entityId: args.sourceEntityId ?? args.academicPeriodId,
      action: "stale_marked",
      message: args.message,
      createdBy: args.actorId ?? null,
    });
  }

  return result.modifiedCount ?? 0;
}
