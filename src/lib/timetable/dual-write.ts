import { Types } from "mongoose";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { TimetableSlot } from "@/models/TimetableSlot";
import { TimetableVersion } from "@/models/TimetableVersion";
import { resolveClassroomLabel } from "@/lib/timetable/classroom-label";
import { recomputeConflictsForVersion } from "@/lib/timetable/recompute-conflicts";
import { isTimetableDualWriteEnabled as isDualWriteFlagEnabled } from "@/lib/timetable/feature-flags";

type AssignmentSchedule = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export interface DualWriteInput {
  schoolId: Types.ObjectId;
  assignmentId: Types.ObjectId;
  actorId: Types.ObjectId;
}

export interface DualWriteResult {
  enabled: boolean;
  skippedReason?: string;
  draftVersionId?: string;
  upsertedSlots?: number;
}

export function isTimetableDualWriteEnabled(): boolean {
  return isDualWriteFlagEnabled();
}

function normalizeSchedules(raw: {
  schedule?: { dayOfWeek?: number; startTime?: string; endTime?: string };
  schedules?: Array<{ dayOfWeek?: number; startTime?: string; endTime?: string }>;
}): AssignmentSchedule[] {
  const entries: AssignmentSchedule[] = [];

  if (
    raw.schedule &&
    Number.isInteger(raw.schedule.dayOfWeek) &&
    raw.schedule.startTime &&
    raw.schedule.endTime
  ) {
    entries.push({
      dayOfWeek: raw.schedule.dayOfWeek as number,
      startTime: raw.schedule.startTime,
      endTime: raw.schedule.endTime,
    });
  }

  if (Array.isArray(raw.schedules)) {
    for (const item of raw.schedules) {
      if (
        Number.isInteger(item.dayOfWeek) &&
        item.startTime &&
        item.endTime
      ) {
        entries.push({
          dayOfWeek: item.dayOfWeek as number,
          startTime: item.startTime,
          endTime: item.endTime,
        });
      }
    }
  }

  return entries;
}

async function findOrCreateDraftVersion(args: {
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  actorId: Types.ObjectId;
}): Promise<Types.ObjectId> {
  const existingDraft = await TimetableVersion.findOne({
    schoolId: args.schoolId,
    academicPeriodId: args.academicPeriodId,
    status: "draft",
  })
    .sort({ updatedAt: -1, createdAt: -1 })
    .select("_id")
    .lean();

  if (existingDraft) {
    return (existingDraft as { _id: Types.ObjectId })._id;
  }

  const published = await TimetableVersion.findOne({
    schoolId: args.schoolId,
    academicPeriodId: args.academicPeriodId,
    status: "published",
  })
    .select("_id")
    .lean();

  const created = await TimetableVersion.create({
    schoolId: args.schoolId,
    academicPeriodId: args.academicPeriodId,
    name: `Auto Draft ${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC`,
    status: "draft",
    baseVersionId: published ? (published as { _id: Types.ObjectId })._id : null,
    publishedAt: null,
    createdBy: args.actorId,
    updatedBy: args.actorId,
    lockVersion: 0,
  });

  return created._id;
}

export async function syncAssignmentToDraftTimetable(
  input: DualWriteInput
): Promise<DualWriteResult> {
  if (!isTimetableDualWriteEnabled()) {
    return { enabled: false, skippedReason: "flag_disabled" };
  }

  const assignment = await TeacherAssignment.findOne({
    _id: input.assignmentId,
    schoolId: input.schoolId,
  }).lean();

  if (!assignment) {
    return { enabled: true, skippedReason: "assignment_not_found" };
  }

  const normalized = assignment as {
    _id: Types.ObjectId;
    schoolId: Types.ObjectId;
    academicPeriodId: Types.ObjectId;
    teacherId: Types.ObjectId;
    subjectId: Types.ObjectId;
    classGroupId: Types.ObjectId;
    status: "active" | "inactive";
    schedule?: { dayOfWeek?: number; startTime?: string; endTime?: string };
    schedules?: Array<{ dayOfWeek?: number; startTime?: string; endTime?: string }>;
  };

  const draftVersionId = await findOrCreateDraftVersion({
    schoolId: input.schoolId,
    academicPeriodId: normalized.academicPeriodId,
    actorId: input.actorId,
  });

  await TimetableSlot.deleteMany({
    schoolId: input.schoolId,
    versionId: draftVersionId,
    source: "assignment_sync",
    legacyAssignmentId: normalized._id,
  });

  if (normalized.status !== "active") {
    await recomputeConflictsForVersion({
      schoolId: input.schoolId,
      versionId: draftVersionId,
    });
    return {
      enabled: true,
      draftVersionId: String(draftVersionId),
      upsertedSlots: 0,
    };
  }

  const schedules = normalizeSchedules(normalized);
  if (schedules.length === 0) {
    await recomputeConflictsForVersion({
      schoolId: input.schoolId,
      versionId: draftVersionId,
    });
    return {
      enabled: true,
      draftVersionId: String(draftVersionId),
      upsertedSlots: 0,
    };
  }

  const classroom = await resolveClassroomLabel({
    schoolId: input.schoolId,
    classGroupId: normalized.classGroupId,
  });

  const now = new Date();
  await TimetableSlot.insertMany(
    schedules.map((schedule) => ({
      schoolId: input.schoolId,
      academicPeriodId: normalized.academicPeriodId,
      versionId: draftVersionId,
      classGroupId: normalized.classGroupId,
      gradeId: classroom.gradeId,
      subjectId: normalized.subjectId,
      teacherId: normalized.teacherId,
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      classroomLabel: classroom.classroomLabel,
      source: "assignment_sync",
      legacyAssignmentId: normalized._id,
      createdBy: input.actorId,
      updatedBy: input.actorId,
      createdAt: now,
      updatedAt: now,
    }))
  );

  await TimetableVersion.updateOne(
    { _id: draftVersionId },
    {
      $set: { updatedBy: input.actorId },
      $inc: { lockVersion: 1 },
    }
  );

  await recomputeConflictsForVersion({
    schoolId: input.schoolId,
    versionId: draftVersionId,
  });

  return {
    enabled: true,
    draftVersionId: String(draftVersionId),
    upsertedSlots: schedules.length,
  };
}
