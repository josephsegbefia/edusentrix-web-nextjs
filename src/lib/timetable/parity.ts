import { Types } from "mongoose";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { TimetableSlot } from "@/models/TimetableSlot";
import { TimetableVersion } from "@/models/TimetableVersion";

type AssignmentSchedule = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
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

export type TimetableParityPeriodSummary = {
  academicPeriodId: string;
  versionId: string | null;
  versionStatus: "draft" | "published" | null;
  expectedCount: number;
  actualCount: number;
  missingCount: number;
  extraCount: number;
  mismatchCount: number;
  mismatchRate: number;
  missingExamples: LegacyParityEntry[];
  extraExamples: ActualParityEntry[];
};

export type TimetableParityTotals = {
  periodCount: number;
  expected: number;
  actual: number;
  missing: number;
  extra: number;
  mismatches: number;
  mismatchRate: number;
};

export type TimetableParityReport = {
  schoolId: string;
  academicPeriodId: string | null;
  versionId: string | null;
  generatedAt: string;
  totals: TimetableParityTotals;
  periods: TimetableParityPeriodSummary[];
};

export type BuildTimetableParityInput = {
  schoolId: Types.ObjectId;
  academicPeriodId?: Types.ObjectId | null;
  versionId?: Types.ObjectId | null;
  maxExamples?: number;
};

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

async function findPreferredVersion(args: {
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  overrideVersionId?: Types.ObjectId | null;
}): Promise<{ id: Types.ObjectId; status: "draft" | "published" } | null> {
  if (args.overrideVersionId) {
    const version = await TimetableVersion.findOne({
      _id: args.overrideVersionId,
      schoolId: args.schoolId,
      academicPeriodId: args.academicPeriodId,
    })
      .select("_id status")
      .lean();

    if (!version) return null;
    const status = (version as { status: string }).status;
    if (status !== "draft" && status !== "published") return null;

    return {
      id: (version as { _id: Types.ObjectId })._id,
      status,
    };
  }

  const preferred = await TimetableVersion.findOne({
    schoolId: args.schoolId,
    academicPeriodId: args.academicPeriodId,
    status: { $in: ["draft", "published"] },
  })
    .sort({ status: 1, updatedAt: -1, createdAt: -1 })
    .select("_id status")
    .lean();

  if (!preferred) return null;
  return {
    id: (preferred as { _id: Types.ObjectId })._id,
    status: (preferred as { status: "draft" | "published" }).status,
  };
}

export async function buildTimetableParityReport(
  input: BuildTimetableParityInput
): Promise<TimetableParityReport> {
  const maxExamples = Math.min(
    Math.max(Number(input.maxExamples || 20), 1),
    100
  );

  const assignmentQuery: Record<string, unknown> = {
    schoolId: input.schoolId,
    status: "active",
  };
  if (input.academicPeriodId) {
    assignmentQuery.academicPeriodId = input.academicPeriodId;
  }

  const assignments = (await TeacherAssignment.find(assignmentQuery)
    .select(
      "_id schoolId academicPeriodId teacherId subjectId classGroupId schedule schedules"
    )
    .lean()) as Array<{
    _id: Types.ObjectId;
    schoolId: Types.ObjectId;
    academicPeriodId: Types.ObjectId;
    teacherId: Types.ObjectId;
    subjectId: Types.ObjectId;
    classGroupId: Types.ObjectId;
    schedule?: { dayOfWeek?: number; startTime?: string; endTime?: string };
    schedules?: Array<{ dayOfWeek?: number; startTime?: string; endTime?: string }>;
  }>;

  const byPeriod = new Map<string, typeof assignments>();
  for (const assignment of assignments) {
    const periodKey = String(assignment.academicPeriodId);
    const rows = byPeriod.get(periodKey) || [];
    rows.push(assignment);
    byPeriod.set(periodKey, rows);
  }

  if (input.academicPeriodId && !byPeriod.has(String(input.academicPeriodId))) {
    byPeriod.set(String(input.academicPeriodId), []);
  }

  const periodSummaries: TimetableParityPeriodSummary[] = [];

  for (const [periodKey, periodAssignments] of byPeriod.entries()) {
    const periodId = new Types.ObjectId(periodKey);

    const preferredVersion = await findPreferredVersion({
      schoolId: input.schoolId,
      academicPeriodId: periodId,
      overrideVersionId: input.versionId,
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
    if (preferredVersion?.id) {
      const slots = await TimetableSlot.find({
        schoolId: input.schoolId,
        academicPeriodId: periodId,
        versionId: preferredVersion.id,
        source: "assignment_sync",
      })
        .select(
          "_id academicPeriodId classGroupId subjectId teacherId dayOfWeek startTime endTime legacyAssignmentId"
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
      if (!actualMap.has(key) && missingExamples.length < maxExamples) {
        missingExamples.push(entry);
      }
    }

    for (const [key, entry] of actualMap.entries()) {
      if (!expectedMap.has(key) && extraExamples.length < maxExamples) {
        extraExamples.push(entry);
      }
    }

    const missingCount = Array.from(expectedMap.keys()).filter(
      (key) => !actualMap.has(key)
    ).length;
    const extraCount = Array.from(actualMap.keys()).filter(
      (key) => !expectedMap.has(key)
    ).length;
    const mismatchCount = missingCount + extraCount;
    const expectedCount = expectedMap.size;
    const mismatchRate =
      expectedCount === 0
        ? mismatchCount > 0
          ? 1
          : 0
        : mismatchCount / expectedCount;

    periodSummaries.push({
      academicPeriodId: periodKey,
      versionId: preferredVersion ? String(preferredVersion.id) : null,
      versionStatus: preferredVersion?.status || null,
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

  periodSummaries.sort((a, b) =>
    a.academicPeriodId.localeCompare(b.academicPeriodId)
  );

  const totalsRaw = periodSummaries.reduce(
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

  const totals: TimetableParityTotals = {
    ...totalsRaw,
    mismatchRate:
      totalsRaw.expected === 0
        ? totalsRaw.mismatches > 0
          ? 1
          : 0
        : totalsRaw.mismatches / totalsRaw.expected,
  };

  return {
    schoolId: String(input.schoolId),
    academicPeriodId: input.academicPeriodId
      ? String(input.academicPeriodId)
      : null,
    versionId: input.versionId ? String(input.versionId) : null,
    generatedAt: new Date().toISOString(),
    totals,
    periods: periodSummaries,
  };
}
