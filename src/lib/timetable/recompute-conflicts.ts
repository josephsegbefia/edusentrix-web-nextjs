import { Types } from "mongoose";
import { TimetableConflict, type TimetableConflictCode } from "@/models/TimetableConflict";
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
import { Subject } from "@/models/Subject";
import { Teacher } from "@/models/Teacher";

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

interface MaterializedValidationConflict {
  code: TimetableConflictCode;
  slotIds: string[];
  message: string;
  metadata: Record<string, unknown>;
}

function mapValidationIssueToConflict(
  issue: TimetableValidationIssue,
  slotId: string
): MaterializedValidationConflict | null {
  if (issue.code === "INVALID_DAY_OF_WEEK") {
    return {
      code: "INVALID_TIME_RANGE",
      slotIds: [slotId],
      message: issue.message,
      metadata: { field: issue.field, validationCode: issue.code },
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
      slotIds: [slotId],
      message: issue.message,
      metadata: { field: issue.field, validationCode: issue.code },
    };
  }

  if (issue.code === "MISSING_GRADE" || issue.code === "GRADE_CLASSGROUP_MISMATCH") {
    return {
      code: "MISSING_CLASSGROUP",
      slotIds: [slotId],
      message: issue.message,
      metadata: { field: issue.field, validationCode: issue.code },
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
}) {
  return {
    schoolId: args.schoolId,
    academicPeriodId: args.academicPeriodId,
    versionId: args.versionId,
    code: args.code,
    severity: "error" as const,
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

  const teacherIds = Array.from(new Set(slots.map((s) => String(s.teacherId))));
  const subjectIds = Array.from(new Set(slots.map((s) => String(s.subjectId))));
  const classGroupIds = Array.from(new Set(slots.map((s) => String(s.classGroupId))));
  const gradeIds = Array.from(new Set(slots.map((s) => String(s.gradeId))));

  const [teachers, subjects, classGroups, grades] = await Promise.all([
    teacherIds.length
      ? Teacher.find({
          schoolId: input.schoolId,
          _id: { $in: teacherIds.map((id) => new Types.ObjectId(id)) },
        })
          .select("_id")
          .lean()
      : [],
    subjectIds.length
      ? Subject.find({
          schoolId: input.schoolId,
          _id: { $in: subjectIds.map((id) => new Types.ObjectId(id)) },
        })
          .select("_id")
          .lean()
      : [],
    classGroupIds.length
      ? ClassGroup.find({
          schoolId: input.schoolId,
          _id: { $in: classGroupIds.map((id) => new Types.ObjectId(id)) },
        })
          .select("_id gradeId")
          .lean()
      : [],
    gradeIds.length
      ? Grade.find({
          schoolId: input.schoolId,
          _id: { $in: gradeIds.map((id) => new Types.ObjectId(id)) },
        })
          .select("_id")
          .lean()
      : [],
  ]);

  const teacherSet = new Set(teachers.map((t) => String((t as { _id: Types.ObjectId })._id)));
  const subjectSet = new Set(subjects.map((s) => String((s as { _id: Types.ObjectId })._id)));
  const gradeSet = new Set(grades.map((g) => String((g as { _id: Types.ObjectId })._id)));
  const classGroupMap = new Map(
    classGroups.map((c) => [
      String((c as { _id: Types.ObjectId })._id),
      String((c as { gradeId: Types.ObjectId }).gradeId),
    ])
  );

  const generatedValidationConflicts: MaterializedValidationConflict[] = [];

  for (const slot of slots) {
    const slotId = String(slot._id);

    const shapeIssues = validateTimetableSlotShape({
      schoolId: slot.schoolId,
      classGroupId: slot.classGroupId,
      gradeId: slot.gradeId,
      subjectId: slot.subjectId,
      teacherId: slot.teacherId,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      classroomLabel: slot.classroomLabel,
    });

    for (const issue of shapeIssues) {
      const mapped = mapValidationIssueToConflict(issue, slotId);
      if (mapped) generatedValidationConflicts.push(mapped);
    }

    if (!teacherSet.has(String(slot.teacherId))) {
      generatedValidationConflicts.push({
        code: "MISSING_TEACHER",
        slotIds: [slotId],
        message: "teacherId was not found for this school.",
        metadata: { field: "teacherId", validationCode: "MISSING_TEACHER" },
      });
    }

    if (!subjectSet.has(String(slot.subjectId))) {
      generatedValidationConflicts.push({
        code: "MISSING_SUBJECT",
        slotIds: [slotId],
        message: "subjectId was not found for this school.",
        metadata: { field: "subjectId", validationCode: "MISSING_SUBJECT" },
      });
    }

    const classGroupGrade = classGroupMap.get(String(slot.classGroupId));
    if (!classGroupGrade) {
      generatedValidationConflicts.push({
        code: "MISSING_CLASSGROUP",
        slotIds: [slotId],
        message: "classGroupId was not found for this school.",
        metadata: { field: "classGroupId", validationCode: "MISSING_CLASSGROUP" },
      });
    }

    if (!gradeSet.has(String(slot.gradeId))) {
      generatedValidationConflicts.push({
        code: "MISSING_CLASSGROUP",
        slotIds: [slotId],
        message: "gradeId was not found for this school.",
        metadata: { field: "gradeId", validationCode: "MISSING_GRADE" },
      });
    }

    if (classGroupGrade && classGroupGrade !== String(slot.gradeId)) {
      generatedValidationConflicts.push({
        code: "MISSING_CLASSGROUP",
        slotIds: [slotId],
        message: "gradeId must match classGroup.gradeId.",
        metadata: { field: "gradeId", validationCode: "GRADE_CLASSGROUP_MISMATCH" },
      });
    }

  }

  const overlaps: DetectedTimetableConflict[] = detectTimetableConflicts(
    slots.map((slot) => ({
      _id: slot._id,
      teacherId: slot.teacherId,
      classGroupId: slot.classGroupId,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
    }))
  );

  const normalizedOverlapConflicts: MaterializedValidationConflict[] = overlaps.map(
    (overlap) => ({
      code: overlap.code,
      slotIds: overlap.slotIds,
      message: overlap.message,
      metadata: overlap.metadata,
    })
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
        })
      )
    );
  }

  const byCode = ordered.reduce<Record<string, number>>((acc, conflict) => {
    acc[conflict.code] = (acc[conflict.code] || 0) + 1;
    return acc;
  }, {});

  return {
    versionId: String(input.versionId),
    slotCount,
    totalConflicts: ordered.length,
    errorConflicts: ordered.length,
    warningConflicts: 0,
    byCode,
  };
}
