import "server-only";

import mongoose from "mongoose";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";

export type ShareableClassGroupOption = {
  classGroupId: string;
  classGroupName: string;
  gradeName: string | null;
};

export async function listShareableClassGroupsForWeekPlan(input: {
  schoolId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  academicPeriodId: mongoose.Types.ObjectId;
  subjectOfferingId: mongoose.Types.ObjectId;
  primaryClassGroupId: mongoose.Types.ObjectId;
}): Promise<ShareableClassGroupOption[]> {
  const assignments = await TeacherAssignment.find({
    schoolId: input.schoolId,
    teacherId: input.teacherId,
    academicPeriodId: input.academicPeriodId,
    subjectOfferingId: input.subjectOfferingId,
    status: "active",
    classGroupId: { $ne: input.primaryClassGroupId },
  })
    .select("classGroupId")
    .lean<Array<{ classGroupId: mongoose.Types.ObjectId }>>();

  const classGroupIds = [
    ...new Set(assignments.map((a) => String(a.classGroupId)).filter(Boolean)),
  ];
  if (classGroupIds.length === 0) return [];

  const classGroups = await ClassGroup.find({
    _id: { $in: classGroupIds.map((id) => new mongoose.Types.ObjectId(id)) },
    schoolId: input.schoolId,
  })
    .select("_id name gradeId")
    .lean<Array<{ _id: mongoose.Types.ObjectId; name: string; gradeId?: mongoose.Types.ObjectId }>>();

  const gradeIds = [
    ...new Set(classGroups.map((g) => String(g.gradeId)).filter(Boolean)),
  ];
  const grades =
    gradeIds.length > 0
      ? await Grade.find({ _id: { $in: gradeIds } })
          .select("_id name")
          .lean<Array<{ _id: mongoose.Types.ObjectId; name: string }>>()
      : [];
  const gradeNameById = new Map(grades.map((g) => [String(g._id), g.name]));

  return classGroups
    .map((group) => ({
      classGroupId: String(group._id),
      classGroupName: group.name,
      gradeName: group.gradeId ? gradeNameById.get(String(group.gradeId)) ?? null : null,
    }))
    .sort((a, b) =>
      `${a.gradeName ?? ""} ${a.classGroupName}`.localeCompare(
        `${b.gradeName ?? ""} ${b.classGroupName}`,
      ),
    );
}
