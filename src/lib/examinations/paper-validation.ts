import { Types } from "mongoose";
import { ClassGroup } from "@/models/ClassGroup";
import { ExamType } from "@/models/ExamType";
import { Grade } from "@/models/Grade";
import { Subject } from "@/models/Subject";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import type { ExamPaperScope } from "@/types/examinations";

export function objectId(value: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`${label} is invalid`);
  }
  return new Types.ObjectId(value);
}

export function optionalObjectId(
  value: string | null | undefined,
  label: string
): Types.ObjectId | null {
  if (!value) return null;
  return objectId(value, label);
}

export async function validateExamPaperAcademicRefs(input: {
  schoolId: Types.ObjectId;
  examTypeId: Types.ObjectId;
  gradeId: Types.ObjectId;
  subjectId: Types.ObjectId;
  scope: ExamPaperScope;
  classGroupId?: Types.ObjectId | null;
  classGroupIds: Types.ObjectId[];
}) {
  const [examType, grade, subject] = await Promise.all([
    ExamType.exists({ _id: input.examTypeId, schoolId: input.schoolId, status: "active" }),
    Grade.exists({ _id: input.gradeId, schoolId: input.schoolId, isActive: true }),
    Subject.exists({ _id: input.subjectId, schoolId: input.schoolId, isActive: true }),
  ]);

  if (!examType) throw new Error("Exam type was not found for this school");
  if (!grade) throw new Error("Grade was not found for this school");
  if (!subject) throw new Error("Subject was not found for this school");

  if (input.scope === "class_group" && !input.classGroupId) {
    throw new Error("Class group is required for a class-group exam paper");
  }

  if (input.scope === "grade_wide" && input.classGroupIds.length === 0) {
    throw new Error("At least one class group is required for a grade-wide exam paper");
  }

  const classGroupIds =
    input.scope === "class_group" && input.classGroupId
      ? [input.classGroupId]
      : input.classGroupIds;

  const uniqueClassGroupIds = Array.from(new Set(classGroupIds.map(String))).map(
    (value) => new Types.ObjectId(value)
  );

  const classGroupCount = await ClassGroup.countDocuments({
    _id: { $in: uniqueClassGroupIds },
    schoolId: input.schoolId,
    gradeId: input.gradeId,
    isActive: true,
  });

  if (classGroupCount !== uniqueClassGroupIds.length) {
    throw new Error("One or more class groups do not belong to the selected grade");
  }

  return { classGroupIds: uniqueClassGroupIds };
}

export async function validateTeacherCanSetPaper(input: {
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  subjectId: Types.ObjectId;
  classGroupIds: Types.ObjectId[];
}) {
  const assignmentCount = await TeacherAssignment.countDocuments({
    schoolId: input.schoolId,
    teacherId: input.teacherId,
    academicPeriodId: input.academicPeriodId,
    subjectId: input.subjectId,
    classGroupId: { $in: input.classGroupIds },
    status: "active",
  });

  if (assignmentCount !== input.classGroupIds.length) {
    throw new Error(
      "This paper includes a class group that is not assigned to this teacher for the selected period and subject"
    );
  }
}
