import { Types } from "mongoose";
import { ClassGroup, type IClassGroup } from "@/models/ClassGroup";
import { Grade, type IGrade } from "@/models/Grade";
import { Subject } from "@/models/Subject";
import { Teacher } from "@/models/Teacher";

export type TimetableValidationCode =
  | "INVALID_DAY_OF_WEEK"
  | "INVALID_TIME_RANGE"
  | "MISSING_TEACHER"
  | "MISSING_SUBJECT"
  | "MISSING_CLASSGROUP"
  | "MISSING_GRADE"
  | "MISSING_CLASSROOM_LABEL"
  | "GRADE_CLASSGROUP_MISMATCH";

export interface TimetableValidationIssue {
  code: TimetableValidationCode;
  message: string;
  field?: string;
  severity: "error";
}

export interface TimetableSlotValidationInput {
  schoolId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  gradeId: Types.ObjectId;
  subjectId: Types.ObjectId;
  /** Null when no subject–teacher assignment exists yet. */
  teacherId: Types.ObjectId | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  classroomLabel: string;
}

export const TIMETABLE_HHMM_REGEX = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function parseTimeToMinutes(hhmm: string): number | null {
  if (!TIMETABLE_HHMM_REGEX.test(hhmm)) return null;
  const [hh, mm] = hhmm.split(":").map(Number);
  return hh * 60 + mm;
}

export function isTimeRangeValid(startTime: string, endTime: string): boolean {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start === null || end === null) return false;
  return end > start;
}

export function slotsOverlap(
  slotA: Pick<TimetableSlotValidationInput, "startTime" | "endTime">,
  slotB: Pick<TimetableSlotValidationInput, "startTime" | "endTime">
): boolean {
  const aStart = parseTimeToMinutes(slotA.startTime);
  const aEnd = parseTimeToMinutes(slotA.endTime);
  const bStart = parseTimeToMinutes(slotB.startTime);
  const bEnd = parseTimeToMinutes(slotB.endTime);

  if (aStart === null || aEnd === null || bStart === null || bEnd === null) {
    return false;
  }

  return aStart < bEnd && bStart < aEnd;
}

export function validateTimetableSlotShape(
  input: TimetableSlotValidationInput
): TimetableValidationIssue[] {
  const issues: TimetableValidationIssue[] = [];

  if (!Number.isInteger(input.dayOfWeek) || input.dayOfWeek < 0 || input.dayOfWeek > 6) {
    issues.push({
      code: "INVALID_DAY_OF_WEEK",
      field: "dayOfWeek",
      message: "dayOfWeek must be an integer from 0 to 6.",
      severity: "error",
    });
  }

  if (!isTimeRangeValid(input.startTime, input.endTime)) {
    issues.push({
      code: "INVALID_TIME_RANGE",
      field: "startTime",
      message: "startTime and endTime must be valid HH:MM values and endTime must be after startTime.",
      severity: "error",
    });
  }

  if (!normalizeSpaces(input.classroomLabel)) {
    issues.push({
      code: "MISSING_CLASSROOM_LABEL",
      field: "classroomLabel",
      message: "classroomLabel is required.",
      severity: "error",
    });
  }

  return issues;
}

export async function validateTimetableSlotReferences(
  input: TimetableSlotValidationInput
): Promise<TimetableValidationIssue[]> {
  const issues = validateTimetableSlotShape(input);

  const [teacherExists, subjectExists, classGroupRaw, gradeRaw] =
    await Promise.all([
      input.teacherId
        ? Teacher.exists({ _id: input.teacherId, schoolId: input.schoolId })
        : Promise.resolve(true),
      Subject.exists({ _id: input.subjectId, schoolId: input.schoolId }),
      ClassGroup.findOne({
        _id: input.classGroupId,
        schoolId: input.schoolId,
      })
        .select("_id gradeId")
        .lean(),
      Grade.findOne({ _id: input.gradeId, schoolId: input.schoolId })
        .select("_id")
        .lean(),
    ]);

  if (input.teacherId && !teacherExists) {
    issues.push({
      code: "MISSING_TEACHER",
      field: "teacherId",
      message: "teacherId was not found for this school.",
      severity: "error",
    });
  }

  if (!subjectExists) {
    issues.push({
      code: "MISSING_SUBJECT",
      field: "subjectId",
      message: "subjectId was not found for this school.",
      severity: "error",
    });
  }

  const classGroupNormalized = Array.isArray(classGroupRaw)
    ? classGroupRaw[0]
    : classGroupRaw;
  const classGroup = classGroupNormalized as Pick<IClassGroup, "_id" | "gradeId"> | null;

  if (!classGroup) {
    issues.push({
      code: "MISSING_CLASSGROUP",
      field: "classGroupId",
      message: "classGroupId was not found for this school.",
      severity: "error",
    });
  }

  const gradeNormalized = Array.isArray(gradeRaw) ? gradeRaw[0] : gradeRaw;
  const grade = gradeNormalized as Pick<IGrade, "_id"> | null;
  if (!grade) {
    issues.push({
      code: "MISSING_GRADE",
      field: "gradeId",
      message: "gradeId was not found for this school.",
      severity: "error",
    });
  }

  if (classGroup && grade && String(classGroup.gradeId) !== String(input.gradeId)) {
    issues.push({
      code: "GRADE_CLASSGROUP_MISMATCH",
      field: "gradeId",
      message: "gradeId must match classGroup.gradeId.",
      severity: "error",
    });
  }

  return issues;
}
