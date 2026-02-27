import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import fs from "node:fs/promises";
import path from "node:path";
import mongoose, { Types } from "mongoose";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import connectToDatabase, {
  disconnectDatabase,
} from "../src/db/connectToDatabase";
import { TeacherAssignment } from "../src/models/TeacherAssignment";
import { TimetableSlot } from "../src/models/TimetableSlot";
import { TimetableVersion } from "../src/models/TimetableVersion";
import { User } from "../src/models/User";
import { resolveClassroomLabel } from "../src/lib/timetable/classroom-label";
import { recomputeConflictsForVersion } from "../src/lib/timetable/recompute-conflicts";
import { recordTimetableActivity } from "../src/lib/timetable/audit";

type AssignmentSchedule = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

type LeanAssignment = {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  teacherId: Types.ObjectId;
  subjectId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  schedule?: { dayOfWeek?: number; startTime?: string; endTime?: string };
  schedules?: Array<{ dayOfWeek?: number; startTime?: string; endTime?: string }>;
};

type DraftVersionResult = {
  versionId: Types.ObjectId | null;
  createdDraft: boolean;
  baseVersionId: Types.ObjectId | null;
};

type PeriodSummary = {
  academicPeriodId: string;
  draftVersionId: string | null;
  createdDraftVersion: boolean;
  baseVersionId: string | null;
  assignmentsInPeriod: number;
  assignmentsWithSchedules: number;
  skippedAssignments: number;
  removedAssignmentSyncSlots: number;
  insertedAssignmentSyncSlots: number;
  conflictSummary?: {
    versionId: string;
    slotCount: number;
    totalConflicts: number;
    errorConflicts: number;
    warningConflicts: number;
    byCode: Record<string, number>;
  };
};

const argv = yargs(hideBin(process.argv))
  .option("mongo", {
    type: "string",
    describe: "MongoDB URI override",
  })
  .option("schoolId", {
    type: "string",
    demandOption: true,
    describe: "School ID to backfill",
  })
  .option("academicPeriodId", {
    type: "string",
    describe: "Optional academic period filter",
  })
  .option("actorUserId", {
    type: "string",
    describe: "Optional actor user ID for createdBy/updatedBy/audit logs",
  })
  .option("dryRun", {
    type: "boolean",
    default: false,
    describe: "Preview only, do not write slots or versions",
  })
  .option("reportFile", {
    type: "string",
    describe: "Optional path to save JSON run report",
  })
  .option("verbose", {
    type: "boolean",
    default: false,
    describe: "Print per-period detail while running",
  })
  .strict()
  .help()
  .parseSync();

function toObjectIdOrThrow(value: string, field: string): Types.ObjectId {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
  return new mongoose.Types.ObjectId(value);
}

function parseTimeToMinutes(hhmm: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function normalizeSchedules(raw: {
  schedule?: { dayOfWeek?: number; startTime?: string; endTime?: string };
  schedules?: Array<{ dayOfWeek?: number; startTime?: string; endTime?: string }>;
}): AssignmentSchedule[] {
  const candidates: AssignmentSchedule[] = [];

  if (
    raw.schedule &&
    Number.isInteger(raw.schedule.dayOfWeek) &&
    raw.schedule.startTime &&
    raw.schedule.endTime
  ) {
    candidates.push({
      dayOfWeek: raw.schedule.dayOfWeek as number,
      startTime: raw.schedule.startTime,
      endTime: raw.schedule.endTime,
    });
  }

  if (Array.isArray(raw.schedules)) {
    for (const item of raw.schedules) {
      if (Number.isInteger(item.dayOfWeek) && item.startTime && item.endTime) {
        candidates.push({
          dayOfWeek: item.dayOfWeek as number,
          startTime: item.startTime,
          endTime: item.endTime,
        });
      }
    }
  }

  const deduped: AssignmentSchedule[] = [];
  const seen = new Set<string>();

  for (const entry of candidates) {
    if (entry.dayOfWeek < 0 || entry.dayOfWeek > 6) continue;
    const start = parseTimeToMinutes(entry.startTime);
    const end = parseTimeToMinutes(entry.endTime);
    if (start === null || end === null || end <= start) continue;

    const key = `${entry.dayOfWeek}|${entry.startTime}|${entry.endTime}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(entry);
  }

  return deduped.sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
    return a.endTime.localeCompare(b.endTime);
  });
}

async function resolveActorUserId(
  schoolId: Types.ObjectId,
  actorUserIdArg?: string
): Promise<Types.ObjectId> {
  if (actorUserIdArg) {
    const actorId = toObjectIdOrThrow(actorUserIdArg, "actorUserId");
    const exists = await User.exists({ _id: actorId, schoolId });
    if (!exists) {
      throw new Error("actorUserId does not belong to the selected school.");
    }
    return actorId;
  }

  const schoolAdmin = await User.findOne({ schoolId, role: "school_admin" })
    .select("_id")
    .lean();
  if (schoolAdmin) {
    return (schoolAdmin as { _id: Types.ObjectId })._id;
  }

  const fallbackUser = await User.findOne({ schoolId }).select("_id").lean();
  if (fallbackUser) {
    return (fallbackUser as { _id: Types.ObjectId })._id;
  }

  throw new Error("No users found in school. Provide --actorUserId explicitly.");
}

async function findOrCreateDraftVersion(args: {
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  actorId: Types.ObjectId;
  dryRun: boolean;
}): Promise<DraftVersionResult> {
  const existingDraft = await TimetableVersion.findOne({
    schoolId: args.schoolId,
    academicPeriodId: args.academicPeriodId,
    status: "draft",
  })
    .sort({ updatedAt: -1, createdAt: -1 })
    .select("_id baseVersionId")
    .lean();

  if (existingDraft) {
    return {
      versionId: (existingDraft as { _id: Types.ObjectId })._id,
      createdDraft: false,
      baseVersionId:
        (existingDraft as { baseVersionId?: Types.ObjectId | null }).baseVersionId || null,
    };
  }

  const published = await TimetableVersion.findOne({
    schoolId: args.schoolId,
    academicPeriodId: args.academicPeriodId,
    status: "published",
  })
    .select("_id")
    .lean();

  const baseVersionId = published ? (published as { _id: Types.ObjectId })._id : null;
  if (args.dryRun) {
    return {
      versionId: null,
      createdDraft: true,
      baseVersionId,
    };
  }

  const created = await TimetableVersion.create({
    schoolId: args.schoolId,
    academicPeriodId: args.academicPeriodId,
    name: `Backfill Draft ${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC`,
    status: "draft",
    baseVersionId,
    publishedAt: null,
    createdBy: args.actorId,
    updatedBy: args.actorId,
    lockVersion: 0,
  });

  return {
    versionId: created._id,
    createdDraft: true,
    baseVersionId,
  };
}

async function main() {
  const startedAt = new Date();
  const runId = new Types.ObjectId();

  const schoolId = toObjectIdOrThrow(argv.schoolId, "schoolId");
  const academicPeriodId = argv.academicPeriodId
    ? toObjectIdOrThrow(argv.academicPeriodId, "academicPeriodId")
    : null;

  await connectToDatabase(argv.mongo);

  const actorId = await resolveActorUserId(schoolId, argv.actorUserId);

  const query: Record<string, unknown> = {
    schoolId,
    status: "active",
  };
  if (academicPeriodId) {
    query.academicPeriodId = academicPeriodId;
  }

  const assignments = (await TeacherAssignment.find(query)
    .select(
      "_id schoolId academicPeriodId teacherId subjectId classGroupId schedule schedules status"
    )
    .lean()) as LeanAssignment[];

  const byPeriod = new Map<string, LeanAssignment[]>();
  for (const assignment of assignments) {
    const key = String(assignment.academicPeriodId);
    const group = byPeriod.get(key) || [];
    group.push(assignment);
    byPeriod.set(key, group);
  }

  const classroomCache = new Map<
    string,
    Promise<{ gradeId: Types.ObjectId; classroomLabel: string }>
  >();

  function getClassroomLabelForClassGroup(classGroupId: Types.ObjectId) {
    const key = String(classGroupId);
    if (!classroomCache.has(key)) {
      classroomCache.set(
        key,
        resolveClassroomLabel({
          schoolId,
          classGroupId,
        })
      );
    }
    return classroomCache.get(key)!;
  }

  const periodSummaries: PeriodSummary[] = [];

  for (const [periodKey, periodAssignments] of byPeriod.entries()) {
    const periodId = new Types.ObjectId(periodKey);
    const draft = await findOrCreateDraftVersion({
      schoolId,
      academicPeriodId: periodId,
      actorId,
      dryRun: argv.dryRun,
    });

    let assignmentsWithSchedules = 0;
    let skippedAssignments = 0;
    const slotDocs: Array<Record<string, unknown>> = [];
    const now = new Date();

    for (const assignment of periodAssignments) {
      const schedules = normalizeSchedules(assignment);
      if (schedules.length === 0) {
        skippedAssignments += 1;
        continue;
      }

      let classroom: { gradeId: Types.ObjectId; classroomLabel: string };
      try {
        classroom = await getClassroomLabelForClassGroup(assignment.classGroupId);
      } catch {
        skippedAssignments += 1;
        continue;
      }

      assignmentsWithSchedules += 1;
      for (const schedule of schedules) {
        slotDocs.push({
          schoolId,
          academicPeriodId: assignment.academicPeriodId,
          versionId: draft.versionId,
          classGroupId: assignment.classGroupId,
          gradeId: classroom.gradeId,
          subjectId: assignment.subjectId,
          teacherId: assignment.teacherId,
          dayOfWeek: schedule.dayOfWeek,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          classroomLabel: classroom.classroomLabel,
          source: "assignment_sync",
          legacyAssignmentId: assignment._id,
          createdBy: actorId,
          updatedBy: actorId,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    let removedAssignmentSyncSlots = 0;
    let conflictSummary:
      | {
          versionId: string;
          slotCount: number;
          totalConflicts: number;
          errorConflicts: number;
          warningConflicts: number;
          byCode: Record<string, number>;
        }
      | undefined;

    if (draft.versionId) {
      removedAssignmentSyncSlots = await TimetableSlot.countDocuments({
        schoolId,
        academicPeriodId: periodId,
        versionId: draft.versionId,
        source: "assignment_sync",
      });
    }

    if (!argv.dryRun && draft.versionId) {
      await TimetableSlot.deleteMany({
        schoolId,
        academicPeriodId: periodId,
        versionId: draft.versionId,
        source: "assignment_sync",
      });

      if (slotDocs.length > 0) {
        await TimetableSlot.insertMany(slotDocs as never[], { ordered: false });
      }

      await TimetableVersion.updateOne(
        { _id: draft.versionId },
        {
          $set: { updatedBy: actorId },
          $inc: { lockVersion: 1 },
        }
      );

      conflictSummary = await recomputeConflictsForVersion({
        schoolId,
        versionId: draft.versionId,
      });
    }

    const summary: PeriodSummary = {
      academicPeriodId: periodKey,
      draftVersionId: draft.versionId ? String(draft.versionId) : null,
      createdDraftVersion: draft.createdDraft,
      baseVersionId: draft.baseVersionId ? String(draft.baseVersionId) : null,
      assignmentsInPeriod: periodAssignments.length,
      assignmentsWithSchedules,
      skippedAssignments,
      removedAssignmentSyncSlots,
      insertedAssignmentSyncSlots: slotDocs.length,
      conflictSummary,
    };

    periodSummaries.push(summary);

    if (argv.verbose) {
      console.log(
        `[period ${periodKey}] assignments=${periodAssignments.length} withSchedules=${assignmentsWithSchedules} skipped=${skippedAssignments} removed=${removedAssignmentSyncSlots} inserted=${slotDocs.length}`
      );
    }
  }

  const totals = periodSummaries.reduce(
    (acc, item) => {
      acc.periodCount += 1;
      acc.assignments += item.assignmentsInPeriod;
      acc.assignmentsWithSchedules += item.assignmentsWithSchedules;
      acc.skippedAssignments += item.skippedAssignments;
      acc.removedSlots += item.removedAssignmentSyncSlots;
      acc.insertedSlots += item.insertedAssignmentSyncSlots;
      return acc;
    },
    {
      periodCount: 0,
      assignments: 0,
      assignmentsWithSchedules: 0,
      skippedAssignments: 0,
      removedSlots: 0,
      insertedSlots: 0,
    }
  );

  const finishedAt = new Date();
  const report = {
    runId: String(runId),
    dryRun: argv.dryRun,
    schoolId: String(schoolId),
    academicPeriodId: academicPeriodId ? String(academicPeriodId) : null,
    actorUserId: String(actorId),
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    totals,
    periods: periodSummaries,
  };

  if (!argv.dryRun) {
    await recordTimetableActivity({
      schoolId,
      userId: actorId,
      type: "timetable.backfill.executed",
      description: "Executed timetable backfill from legacy teacher assignments",
      entityType: "School",
      entityId: schoolId,
      metadata: {
        runId: report.runId,
        totals: report.totals,
        academicPeriodId: report.academicPeriodId,
      },
    });
  }

  if (argv.reportFile) {
    const outPath = path.resolve(argv.reportFile);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(`Report saved to ${outPath}`);
  }

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
