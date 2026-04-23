import { Types } from "mongoose";
import {
  TimetableConflict,
  type TimetableConflictCode,
  type TimetableConflictSeverity,
} from "@/models/TimetableConflict";
import { TimetableSlot } from "@/models/TimetableSlot";
import { TimetableVersion } from "@/models/TimetableVersion";
import {
  detectTimetableConflicts,
  type DetectedTimetableConflict,
} from "@/lib/timetable/conflicts";
import {
  validateTimetableSlotShape,
  type TimetableValidationIssue,
} from "@/lib/timetable/validate";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { SchoolSettings, type ISchoolSettings } from "@/models/SchoolSettings";
import {
  SchoolDailySchedule,
  type ISchoolDailySchedule,
} from "@/models/SchoolDailySchedule";
import { Subject } from "@/models/Subject";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";
import {
  getResolvedScheduleDiagnostics,
  getResolvedScheduleSettings,
  type ResolvedScheduleDiagnostics,
  type ResolvedScheduleSettings,
} from "@/lib/timetable/scheduleSettings";
import { schoolSettingsToScheduleInput } from "@/lib/timetable/schoolSettingsScheduleInput";
import { slotAlignsWithSchoolPeriods } from "@/lib/timetable/period-alignment";
import { buildResolvedFromSchoolDailyConfig } from "@/lib/timetable/dailyScheduleTimetable";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export interface RecomputeConflictsInput {
  schoolId: Types.ObjectId;
  versionId: Types.ObjectId;
}

export interface RecomputeConflictsResult {
  versionId: string;
  slotCount: number;
  totalConflicts: number;
  errorConflicts: number;
  warningConflicts: number;
  byCode: Record<string, number>;
}

type ConflictSlotSummary = {
  slotId: string;
  classGroupId: string;
  className: string;
  gradeId: string;
  gradeName: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  teacherId: string | null;
  teacherName: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  classroomLabel: string;
};

type ConflictResolvedDaySummary = {
  startTime: string;
  endTime: string;
  periodDuration: number;
  periodsPerDay: number;
  expectedPeriodSlots: Array<{
    periodNumber: number;
    startTime: string;
    endTime: string;
    label?: string;
  }>;
  diagnostics: ResolvedScheduleDiagnostics;
};

interface MaterializedValidationConflict {
  code: TimetableConflictCode;
  slotIds: string[];
  message: string;
  metadata: Record<string, unknown>;
  severity?: TimetableConflictSeverity;
}

function dayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] || `Day ${dayOfWeek}`;
}

function describeSlot(summary: ConflictSlotSummary): string {
  return `${summary.subjectName} in ${summary.className} (${summary.startTime}-${summary.endTime})`;
}

function formatTeacherName(user: { firstName?: string; lastName?: string } | null | undefined) {
  const firstName = user?.firstName || "";
  const lastName = user?.lastName || "";
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || null;
}

function buildResolvedDaySummary(
  resolved: ResolvedScheduleSettings
): ConflictResolvedDaySummary {
  return {
    startTime: resolved.startTime,
    endTime: resolved.endTime,
    periodDuration: resolved.periodDuration,
    periodsPerDay: resolved.periodsPerDay,
    expectedPeriodSlots: resolved.periodSlots.map((slot) => ({
      periodNumber: slot.periodNumber,
      startTime: slot.startTime,
      endTime: slot.endTime,
      label: slot.label,
    })),
    diagnostics: getResolvedScheduleDiagnostics(resolved),
  };
}

function withSlotMetadata(
  slot: ConflictSlotSummary,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    slot,
    slots: [slot],
    ...extra,
  };
}

function mapValidationIssueToConflict(
  issue: TimetableValidationIssue,
  slot: ConflictSlotSummary
): MaterializedValidationConflict | null {
  const metadata = withSlotMetadata(slot, {
    field: issue.field,
    validationCode: issue.code,
  });

  if (issue.code === "INVALID_DAY_OF_WEEK") {
    return {
      code: "INVALID_TIME_RANGE",
      slotIds: [slot.slotId],
      message: `${describeSlot(slot)} has an invalid weekday or time range.`,
      metadata,
    };
  }

  const passthroughCodes = new Set<TimetableConflictCode>([
    "INVALID_TIME_RANGE",
    "MISSING_TEACHER",
    "MISSING_SUBJECT",
    "MISSING_CLASSGROUP",
    "MISSING_CLASSROOM_LABEL",
  ]);

  if (passthroughCodes.has(issue.code as TimetableConflictCode)) {
    return {
      code: issue.code as TimetableConflictCode,
      slotIds: [slot.slotId],
      message: `${describeSlot(slot)}: ${issue.message}`,
      metadata,
    };
  }

  if (issue.code === "MISSING_GRADE" || issue.code === "GRADE_CLASSGROUP_MISMATCH") {
    return {
      code: "MISSING_CLASSGROUP",
      slotIds: [slot.slotId],
      message: `${describeSlot(slot)}: ${issue.message}`,
      metadata,
    };
  }

  return null;
}

function buildConflictInsertDoc(args: {
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  versionId: Types.ObjectId;
  code: TimetableConflictCode;
  slotIds: string[];
  message: string;
  metadata: Record<string, unknown>;
  severity?: TimetableConflictSeverity;
}) {
  return {
    schoolId: args.schoolId,
    academicPeriodId: args.academicPeriodId,
    versionId: args.versionId,
    code: args.code,
    severity: args.severity ?? ("error" as const),
    slotIds: args.slotIds.map((id) => new Types.ObjectId(id)),
    message: args.message,
    metadata: args.metadata,
    status: "open" as const,
  };
}

function stableConflictKey(conflict: {
  code: string;
  slotIds: string[];
  message: string;
}): string {
  const slotIds = [...conflict.slotIds].sort((a, b) => a.localeCompare(b));
  return `${conflict.code}|${slotIds.join(",")}|${conflict.message}`;
}

function buildOutsidePeriodRangeMessage(args: {
  slot: ConflictSlotSummary;
  resolvedDay: ConflictResolvedDaySummary;
}) {
  const { slot, resolvedDay } = args;
  const shortfall = resolvedDay.diagnostics.periodsShortfall;
  const lastPeriodEnd = resolvedDay.diagnostics.lastPeriodEndTime;
  const availablePeriods = resolvedDay.expectedPeriodSlots.length;

  if (shortfall > 0) {
    const shortfallLabel =
      shortfall === 1 ? "1 period short" : `${shortfall} periods short`;
    return `${describeSlot(slot)} no longer fits ${dayName(slot.dayOfWeek)}. The day is currently ${shortfallLabel} of the configured ${resolvedDay.periodsPerDay} period(s).`;
  }

  if (lastPeriodEnd) {
    return `${describeSlot(slot)} no longer matches ${dayName(slot.dayOfWeek)}. ${availablePeriods} teaching period(s) are currently available and the last one ends at ${lastPeriodEnd}.`;
  }

  return `${describeSlot(slot)} no longer matches ${dayName(slot.dayOfWeek)}'s available teaching periods.`;
}

function buildOverlapMessage(
  overlap: DetectedTimetableConflict,
  summaries: ConflictSlotSummary[]
) {
  const first = summaries[0];
  const second = summaries[1];
  const fallbackDayName = dayName(overlap.metadata.dayOfWeek);

  if (!first || !second) {
    return overlap.message;
  }

  if (overlap.code === "TEACHER_OVERLAP") {
    const teacherName = first.teacherName || second.teacherName || "A teacher";
    return `${teacherName} is double-booked on ${fallbackDayName}: ${describeSlot(first)} overlaps ${describeSlot(second)}.`;
  }

  return `${first.className} has overlapping lessons on ${fallbackDayName}: ${describeSlot(first)} overlaps ${describeSlot(second)}.`;
}

export async function recomputeConflictsForVersion(
  input: RecomputeConflictsInput
): Promise<RecomputeConflictsResult> {
  const version = await TimetableVersion.findOne({
    _id: input.versionId,
    schoolId: input.schoolId,
  })
    .select("_id academicPeriodId")
    .lean();

  if (!version) {
    throw new Error("Timetable version not found for school.");
  }

  const academicPeriodId = (version as { academicPeriodId: Types.ObjectId }).academicPeriodId;

  const slots = await TimetableSlot.find({
    schoolId: input.schoolId,
    versionId: input.versionId,
  })
    .sort({ dayOfWeek: 1, startTime: 1, _id: 1 })
    .lean();

  const slotCount = slots.length;

  const teacherIds = Array.from(
    new Set(slots.filter((slot) => slot.teacherId).map((slot) => String(slot.teacherId)))
  );
  const subjectIds = Array.from(new Set(slots.map((slot) => String(slot.subjectId))));
  const classGroupIds = Array.from(new Set(slots.map((slot) => String(slot.classGroupId))));
  const gradeIds = Array.from(new Set(slots.map((slot) => String(slot.gradeId))));

  void User;

  const [settingsDoc, dailyScheduleDoc, teachers, subjects, classGroups, grades] =
    await Promise.all([
    SchoolSettings.findOne({ schoolId: input.schoolId }).lean() as Promise<ISchoolSettings | null>,
    SchoolDailySchedule.findOne({ schoolId: input.schoolId })
      .select("config")
      .lean<Pick<ISchoolDailySchedule, "config"> | null>(),
    teacherIds.length
      ? Teacher.find({
          schoolId: input.schoolId,
          _id: { $in: teacherIds.map((id) => new Types.ObjectId(id)) },
        })
          .select("_id userId")
          .populate({ path: "userId", select: "firstName lastName", model: User })
          .lean()
      : [],
    subjectIds.length
      ? Subject.find({
          schoolId: input.schoolId,
          _id: { $in: subjectIds.map((id) => new Types.ObjectId(id)) },
        })
          .select("_id name code")
          .lean()
      : [],
    classGroupIds.length
      ? ClassGroup.find({
          schoolId: input.schoolId,
          _id: { $in: classGroupIds.map((id) => new Types.ObjectId(id)) },
        })
          .select("_id gradeId name")
          .lean()
      : [],
    gradeIds.length
      ? Grade.find({
          schoolId: input.schoolId,
          _id: { $in: gradeIds.map((id) => new Types.ObjectId(id)) },
        })
          .select("_id name")
          .lean()
      : [],
  ]);

  const teacherMap = new Map(
    teachers.map((teacher) => {
      const row = teacher as {
        _id: Types.ObjectId;
        userId?: { firstName?: string; lastName?: string } | null;
      };
      return [String(row._id), formatTeacherName(row.userId)];
    })
  );

  const subjectMap = new Map(
    subjects.map((subject) => {
      const row = subject as {
        _id: Types.ObjectId;
        name?: string;
        code?: string | null;
      };
      return [String(row._id), { name: row.name || "Unknown subject", code: row.code ?? null }];
    })
  );

  const classGroupMap = new Map(
    classGroups.map((classGroup) => {
      const row = classGroup as {
        _id: Types.ObjectId;
        gradeId: Types.ObjectId;
        name?: string;
      };
      return [
        String(row._id),
        {
          gradeId: String(row.gradeId),
          name: row.name || "Unknown class",
        },
      ];
    })
  );

  const gradeMap = new Map(
    grades.map((grade) => {
      const row = grade as { _id: Types.ObjectId; name?: string };
      return [String(row._id), row.name || "Unknown grade"];
    })
  );

  const teacherSet = new Set(teacherMap.keys());
  const subjectSet = new Set(subjectMap.keys());
  const gradeSet = new Set(gradeMap.keys());

  const slotSummaryMap = new Map<string, ConflictSlotSummary>();
  for (const slot of slots) {
    const slotId = String(slot._id);
    const classInfo = classGroupMap.get(String(slot.classGroupId));
    const gradeId = String(slot.gradeId);
    const subjectInfo = subjectMap.get(String(slot.subjectId));
    const teacherId = slot.teacherId ? String(slot.teacherId) : null;
    const teacherName = teacherId ? teacherMap.get(teacherId) ?? null : null;

    slotSummaryMap.set(slotId, {
      slotId,
      classGroupId: String(slot.classGroupId),
      className: classInfo?.name || "Unknown class",
      gradeId,
      gradeName: gradeMap.get(gradeId) || "Unknown grade",
      subjectId: String(slot.subjectId),
      subjectName: subjectInfo?.name || "Unknown subject",
      subjectCode: subjectInfo?.code ?? null,
      teacherId,
      teacherName,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      classroomLabel: slot.classroomLabel,
    });
  }

  const scheduleInput = settingsDoc ? schoolSettingsToScheduleInput(settingsDoc) : null;
  const resolvedScheduleCache = new Map<string, ResolvedScheduleSettings | null>();

  const getResolvedForSlot = (slot: { gradeId: Types.ObjectId; dayOfWeek: number }) => {
    const key = `${String(slot.gradeId)}:${slot.dayOfWeek}`;
    if (resolvedScheduleCache.has(key)) {
      return resolvedScheduleCache.get(key)!;
    }

    let resolved: ResolvedScheduleSettings | null = null;
    if (dailyScheduleDoc?.config) {
      const fromDaily = buildResolvedFromSchoolDailyConfig(
        dailyScheduleDoc.config,
        String(slot.gradeId),
        slot.dayOfWeek
      );
      if (fromDaily?.isConfigured) resolved = fromDaily;
    }
    if (!resolved && scheduleInput) {
      const fromSettings = getResolvedScheduleSettings(
        scheduleInput,
        String(slot.gradeId),
        slot.dayOfWeek
      );
      resolved = fromSettings.isConfigured ? fromSettings : null;
    }
    resolvedScheduleCache.set(key, resolved);
    return resolved;
  };

  const generatedValidationConflicts: MaterializedValidationConflict[] = [];

  for (const slot of slots) {
    const slotId = String(slot._id);
    const slotSummary = slotSummaryMap.get(slotId);
    if (!slotSummary) continue;

    const shapeIssues = validateTimetableSlotShape({
      schoolId: slot.schoolId,
      classGroupId: slot.classGroupId,
      gradeId: slot.gradeId,
      subjectId: slot.subjectId,
      teacherId: slot.teacherId ?? null,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      classroomLabel: slot.classroomLabel,
    });

    for (const issue of shapeIssues) {
      const mapped = mapValidationIssueToConflict(issue, slotSummary);
      if (mapped) generatedValidationConflicts.push(mapped);
    }

    const resolved = getResolvedForSlot(slot);
    const resolvedDay = resolved ? buildResolvedDaySummary(resolved) : null;
    if (
      resolved &&
      resolved.isConfigured &&
      resolvedDay &&
      !slotAlignsWithSchoolPeriods(resolved, slot.startTime, slot.endTime)
    ) {
      generatedValidationConflicts.push({
        code: "OUTSIDE_PERIOD_RANGE",
        slotIds: [slotId],
        message: buildOutsidePeriodRangeMessage({ slot: slotSummary, resolvedDay }),
        metadata: withSlotMetadata(slotSummary, {
          field: "startTime",
          validationCode: "OUTSIDE_PERIOD_RANGE",
          resolvedDay,
        }),
      });
    }

    if (!slot.teacherId) {
      generatedValidationConflicts.push({
        code: "TEACHER_PENDING_ASSIGNMENT",
        slotIds: [slotId],
        message: `${describeSlot(slotSummary)} still needs a teacher assignment.`,
        metadata: withSlotMetadata(slotSummary, { field: "teacherId" }),
        severity: "warning",
      });
    } else if (!teacherSet.has(String(slot.teacherId))) {
      generatedValidationConflicts.push({
        code: "MISSING_TEACHER",
        slotIds: [slotId],
        message: `${describeSlot(slotSummary)} references a teacher record that no longer exists.`,
        metadata: withSlotMetadata(slotSummary, {
          field: "teacherId",
          validationCode: "MISSING_TEACHER",
        }),
      });
    }

    if (!subjectSet.has(String(slot.subjectId))) {
      generatedValidationConflicts.push({
        code: "MISSING_SUBJECT",
        slotIds: [slotId],
        message: `${describeSlot(slotSummary)} references a subject record that no longer exists.`,
        metadata: withSlotMetadata(slotSummary, {
          field: "subjectId",
          validationCode: "MISSING_SUBJECT",
        }),
      });
    }

    const classInfo = classGroupMap.get(String(slot.classGroupId));
    if (!classInfo) {
      generatedValidationConflicts.push({
        code: "MISSING_CLASSGROUP",
        slotIds: [slotId],
        message: `${describeSlot(slotSummary)} references a class group that no longer exists.`,
        metadata: withSlotMetadata(slotSummary, {
          field: "classGroupId",
          validationCode: "MISSING_CLASSGROUP",
        }),
      });
    }

    if (!gradeSet.has(String(slot.gradeId))) {
      generatedValidationConflicts.push({
        code: "MISSING_CLASSGROUP",
        slotIds: [slotId],
        message: `${describeSlot(slotSummary)} references a grade that no longer exists.`,
        metadata: withSlotMetadata(slotSummary, {
          field: "gradeId",
          validationCode: "MISSING_GRADE",
        }),
      });
    }

    if (classInfo && classInfo.gradeId !== String(slot.gradeId)) {
      generatedValidationConflicts.push({
        code: "MISSING_CLASSGROUP",
        slotIds: [slotId],
        message: `${describeSlot(slotSummary)} no longer matches the class group's grade.`,
        metadata: withSlotMetadata(slotSummary, {
          field: "gradeId",
          validationCode: "GRADE_CLASSGROUP_MISMATCH",
        }),
      });
    }
  }

  const overlaps: DetectedTimetableConflict[] = detectTimetableConflicts(
    slots.map((slot) => ({
      _id: slot._id,
      teacherId: slot.teacherId ?? undefined,
      classGroupId: slot.classGroupId,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
    }))
  );

  const normalizedOverlapConflicts: MaterializedValidationConflict[] = overlaps.map(
    (overlap) => {
      const summaries = overlap.slotIds
        .map((slotId) => slotSummaryMap.get(slotId))
        .filter((summary): summary is ConflictSlotSummary => Boolean(summary));

      return {
        code: overlap.code,
        slotIds: overlap.slotIds,
        message: buildOverlapMessage(overlap, summaries),
        metadata: {
          ...overlap.metadata,
          dayName: dayName(overlap.metadata.dayOfWeek),
          slots: summaries,
        },
        severity: "error" as const,
      };
    }
  );

  const deduped = new Map<string, MaterializedValidationConflict>();
  for (const conflict of [...generatedValidationConflicts, ...normalizedOverlapConflicts]) {
    const key = stableConflictKey(conflict);
    if (!deduped.has(key)) deduped.set(key, conflict);
  }

  const ordered = Array.from(deduped.values()).sort((a, b) => {
    if (a.code !== b.code) return a.code.localeCompare(b.code);
    const slotA = [...a.slotIds].sort((x, y) => x.localeCompare(y)).join(",");
    const slotB = [...b.slotIds].sort((x, y) => x.localeCompare(y)).join(",");
    if (slotA !== slotB) return slotA.localeCompare(slotB);
    return a.message.localeCompare(b.message);
  });

  await TimetableConflict.deleteMany({
    schoolId: input.schoolId,
    versionId: input.versionId,
  });

  if (ordered.length > 0) {
    await TimetableConflict.insertMany(
      ordered.map((conflict) =>
        buildConflictInsertDoc({
          schoolId: input.schoolId,
          academicPeriodId,
          versionId: input.versionId,
          code: conflict.code,
          slotIds: conflict.slotIds,
          message: conflict.message,
          metadata: conflict.metadata,
          severity: conflict.severity ?? "error",
        })
      )
    );
  }

  const byCode = ordered.reduce<Record<string, number>>((acc, conflict) => {
    acc[conflict.code] = (acc[conflict.code] || 0) + 1;
    return acc;
  }, {});

  const errorConflicts = ordered.filter((c) => (c.severity ?? "error") === "error").length;
  const warningConflicts = ordered.filter((c) => c.severity === "warning").length;

  return {
    versionId: String(input.versionId),
    slotCount,
    totalConflicts: ordered.length,
    errorConflicts,
    warningConflicts,
    byCode,
  };
}
