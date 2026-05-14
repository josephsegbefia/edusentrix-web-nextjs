import { Types } from "mongoose";
import { ClassGroup, type IClassGroup } from "@/models/ClassGroup";
import { Grade, type IGrade } from "@/models/Grade";

export type ClassroomLabelSource = "default_room_name" | "generated_fallback";

export interface BuildClassroomLabelInput {
  gradeName: string;
  classGroupName: string;
  defaultRoomName?: string | null;
}

export interface ResolveClassroomLabelInput {
  schoolId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  gradeId?: Types.ObjectId | null;
}

export interface ResolvedClassroomLabel {
  classroomLabel: string;
  source: ClassroomLabelSource;
  classGroupId: Types.ObjectId;
  gradeId: Types.ObjectId;
  roomId: Types.ObjectId | null;
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function hasText(value?: string | null): value is string {
  return typeof value === "string" && normalizeSpaces(value).length > 0;
}

export function buildClassroomLabel(input: BuildClassroomLabelInput): ResolvedClassroomLabel["classroomLabel"] {
  if (hasText(input.defaultRoomName)) {
    return normalizeSpaces(input.defaultRoomName);
  }

  const grade = normalizeSpaces(input.gradeName);
  const classGroup = normalizeSpaces(input.classGroupName);
  const prefix = [grade, classGroup].filter(Boolean).join(" ").trim();

  if (!prefix) {
    throw new Error(
      "Cannot generate classroom label: gradeName and classGroupName are empty."
    );
  }

  return `${prefix} Classroom`;
}

export async function resolveClassroomLabel(
  input: ResolveClassroomLabelInput
): Promise<ResolvedClassroomLabel> {
  const classGroupRaw = await ClassGroup.findOne({
    _id: input.classGroupId,
    schoolId: input.schoolId,
  })
    .select("_id schoolId gradeId name defaultRoomId defaultRoomName")
    .lean();

  const classGroupNormalized = Array.isArray(classGroupRaw)
    ? classGroupRaw[0]
    : classGroupRaw;
  const classGroup = classGroupNormalized as Pick<
    IClassGroup,
    "_id" | "schoolId" | "gradeId" | "name" | "defaultRoomId" | "defaultRoomName"
  > | null;

  if (!classGroup) {
    throw new Error("ClassGroup not found for school.");
  }

  if (input.gradeId && String(input.gradeId) !== String(classGroup.gradeId)) {
    throw new Error("Provided gradeId does not match ClassGroup.gradeId.");
  }

  const resolvedGradeId = input.gradeId ?? classGroup.gradeId;

  const gradeRaw = await Grade.findOne({
    _id: resolvedGradeId,
    schoolId: input.schoolId,
  })
    .select("_id name")
    .lean();

  const gradeNormalized = Array.isArray(gradeRaw) ? gradeRaw[0] : gradeRaw;
  const grade = gradeNormalized as Pick<IGrade, "_id" | "name"> | null;

  if (!grade) {
    throw new Error("Grade not found for school.");
  }

  const classroomLabel = buildClassroomLabel({
    gradeName: grade.name,
    classGroupName: classGroup.name,
    defaultRoomName: classGroup.defaultRoomName,
  });

  const source: ClassroomLabelSource = hasText(classGroup.defaultRoomName)
    ? "default_room_name"
    : "generated_fallback";

  return {
    classroomLabel,
    source,
    classGroupId: classGroup._id,
    gradeId: grade._id,
    roomId: classGroup.defaultRoomId ?? null,
  };
}
