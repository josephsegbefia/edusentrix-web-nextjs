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

type LegacyParityEntry = {
  assignmentId: string;
  academicPeriodId: string;
  classGroupId: string;
  subjectId: string;
  teacherId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

type ActualParityEntry = LegacyParityEntry & {
  slotId: string;
};

type PeriodParitySummary = {
  academicPeriodId: string;
  draftVersionId: string | null;
  expectedCount: number;
  actualCount: number;
  missingCount: number;
  extraCount: number;
  mismatchCount: number;
  mismatchRate: number;
  missingExamples: LegacyParityEntry[];
  extraExamples: ActualParityEntry[];
};

const argv = yargs(hideBin(process.argv))
  .option("mongo", {
    type: "string",
    describe: "MongoDB URI override",
  })
  .option("schoolId", {
    type: "string",
    demandOption: true,
    describe: "School ID to compare",
  })
  .option("academicPeriodId", {
    type: "string",
    describe: "Optional academic period filter",
  })
  .option("versionId", {
    type: "string",
    describe: "Optional draft version override (must belong to school and period)",
  })
  .option("maxExamples", {
    type: "number",
    default: 20,
    describe: "Max mismatch examples per period",
  })
  .option("failOnMismatch", {
    type: "boolean",
    default: false,
    describe: "Exit non-zero when mismatches are detected",
  })
  .option("reportFile", {
    type: "string",
    describe: "Optional path to save JSON report",
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

function buildParityKey(entry: LegacyParityEntry): string {
  return [
    entry.assignmentId,
    entry.academicPeriodId,
    entry.classGroupId,
    entry.subjectId,
    entry.teacherId,
    entry.dayOfWeek,
    entry.startTime,
    entry.endTime,
  ].join("|");
}

async function findDraftVersionByPeriod(args: {
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  overrideVersionId?: Types.ObjectId | null;
}): Promise<Types.ObjectId | null> {
  if (args.overrideVersionId) {
    const version = await TimetableVersion.findOne({
      _id: args.overrideVersionId,
      schoolId: args.schoolId,
      academicPeriodId: args.academicPeriodId,
    })
      .select("_id")
      .lean();
    return version ? (version as { _id: Types.ObjectId })._id : null;
  }

  const draft = await TimetableVersion.findOne({
    schoolId: args.schoolId,
    academicPeriodId: args.academicPeriodId,
    status: "draft",
  })
    .sort({ updatedAt: -1, createdAt: -1 })
    .select("_id")
    .lean();

  return draft ? (draft as { _id: Types.ObjectId })._id : null;
}

async function main() {
  const startedAt = new Date();

  const schoolId = toObjectIdOrThrow(argv.schoolId, "schoolId");
  const academicPeriodId = argv.academicPeriodId
    ? toObjectIdOrThrow(argv.academicPeriodId, "academicPeriodId")
    : null;
  const versionId = argv.versionId ? toObjectIdOrThrow(argv.versionId, "versionId") : null;

  await connectToDatabase(argv.mongo);

  const assignmentQuery: Record<string, unknown> = {
    schoolId,
    status: "active",
  };
  if (academicPeriodId) {
    assignmentQuery.academicPeriodId = academicPeriodId;
  }

  const assignments = (await TeacherAssignment.find(assignmentQuery)
    .select("_id schoolId academicPeriodId teacherId subjectId classGroupId schedule schedules")
    .lean()) as LeanAssignment[];

  const byPeriod = new Map<string, LeanAssignment[]>();
  for (const assignment of assignments) {
    const periodKey = String(assignment.academicPeriodId);
    const rows = byPeriod.get(periodKey) || [];
    rows.push(assignment);
    byPeriod.set(periodKey, rows);
  }

  const periodSummaries: PeriodParitySummary[] = [];

  for (const [periodKey, periodAssignments] of byPeriod.entries()) {
    const periodId = new Types.ObjectId(periodKey);
    const draftVersionId = await findDraftVersionByPeriod({
      schoolId,
      academicPeriodId: periodId,
      overrideVersionId: versionId,
    });

    const expected: LegacyParityEntry[] = [];
    for (const assignment of periodAssignments) {
      const schedules = normalizeSchedules(assignment);
      for (const schedule of schedules) {
        expected.push({
          assignmentId: String(assignment._id),
          academicPeriodId: String(assignment.academicPeriodId),
          classGroupId: String(assignment.classGroupId),
          subjectId: String(assignment.subjectId),
          teacherId: String(assignment.teacherId),
          dayOfWeek: schedule.dayOfWeek,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
        });
      }
    }

    const actual: ActualParityEntry[] = [];
    if (draftVersionId) {
      const slots = await TimetableSlot.find({
        schoolId,
        academicPeriodId: periodId,
        versionId: draftVersionId,
        source: "assignment_sync",
      })
        .select(
          "_id schoolId academicPeriodId versionId classGroupId subjectId teacherId dayOfWeek startTime endTime legacyAssignmentId"
        )
        .lean();

      for (const slot of slots) {
        const legacyAssignmentId = (slot as { legacyAssignmentId?: Types.ObjectId | null })
          .legacyAssignmentId;
        actual.push({
          slotId: String(slot._id),
          assignmentId: legacyAssignmentId ? String(legacyAssignmentId) : "__missing__",
          academicPeriodId: String(slot.academicPeriodId),
          classGroupId: String(slot.classGroupId),
          subjectId: String(slot.subjectId),
          teacherId: String(slot.teacherId),
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
        });
      }
    }

    const expectedMap = new Map<string, LegacyParityEntry>();
    for (const entry of expected) {
      expectedMap.set(buildParityKey(entry), entry);
    }

    const actualMap = new Map<string, ActualParityEntry>();
    for (const entry of actual) {
      actualMap.set(buildParityKey(entry), entry);
    }

    const missingExamples: LegacyParityEntry[] = [];
    const extraExamples: ActualParityEntry[] = [];

    for (const [key, entry] of expectedMap.entries()) {
      if (!actualMap.has(key) && missingExamples.length < argv.maxExamples) {
        missingExamples.push(entry);
      }
    }

    for (const [key, entry] of actualMap.entries()) {
      if (!expectedMap.has(key) && extraExamples.length < argv.maxExamples) {
        extraExamples.push(entry);
      }
    }

    const missingCount = Array.from(expectedMap.keys()).filter((key) => !actualMap.has(key)).length;
    const extraCount = Array.from(actualMap.keys()).filter((key) => !expectedMap.has(key)).length;
    const mismatchCount = missingCount + extraCount;
    const expectedCount = expectedMap.size;
    const mismatchRate =
      expectedCount === 0 ? (mismatchCount > 0 ? 1 : 0) : mismatchCount / expectedCount;

    periodSummaries.push({
      academicPeriodId: periodKey,
      draftVersionId: draftVersionId ? String(draftVersionId) : null,
      expectedCount,
      actualCount: actualMap.size,
      missingCount,
      extraCount,
      mismatchCount,
      mismatchRate,
      missingExamples,
      extraExamples,
    });
  }

  const totals = periodSummaries.reduce(
    (acc, period) => {
      acc.periodCount += 1;
      acc.expected += period.expectedCount;
      acc.actual += period.actualCount;
      acc.missing += period.missingCount;
      acc.extra += period.extraCount;
      acc.mismatches += period.mismatchCount;
      return acc;
    },
    { periodCount: 0, expected: 0, actual: 0, missing: 0, extra: 0, mismatches: 0 }
  );

  const finishedAt = new Date();
  const report = {
    schoolId: String(schoolId),
    academicPeriodId: academicPeriodId ? String(academicPeriodId) : null,
    versionId: versionId ? String(versionId) : null,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    totals,
    periods: periodSummaries,
  };

  if (argv.reportFile) {
    const outPath = path.resolve(argv.reportFile);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(`Report saved to ${outPath}`);
  }

  console.log(JSON.stringify(report, null, 2));

  if (argv.failOnMismatch && totals.mismatches > 0) {
    process.exitCode = 2;
  }
}

main()
  .catch((error) => {
    console.error(
      "Parity check failed:",
      error instanceof Error ? error.message : error
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
