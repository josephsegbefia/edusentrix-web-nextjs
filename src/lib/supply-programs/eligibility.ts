import type { FilterQuery } from "mongoose";
import type { Types } from "mongoose";

import type { ISupplyProgram } from "@/models/SupplyProgram";

export type StudentAudienceShape = {
  _id: Types.ObjectId;
  gradeId: Types.ObjectId;
  classGroupId: Types.ObjectId;
};

export function publishedProgramQueryForStudent(
  schoolId: Types.ObjectId,
  student: StudentAudienceShape
): FilterQuery<ISupplyProgram> {
  return {
    schoolId,
    status: "published",
    $or: [
      { audienceMode: "whole_school" },
      { audienceMode: "grades", audienceIds: student.gradeId },
      { audienceMode: "class_groups", audienceIds: student.classGroupId },
      { audienceMode: "students", audienceIds: student._id },
    ],
  };
}

export function studentMatchesProgramAudience(
  student: StudentAudienceShape,
  program: Pick<
    ISupplyProgram,
    "audienceMode" | "audienceIds"
  >
): boolean {
  const ids = (program.audienceIds || []).map((x) => String(x));
  switch (program.audienceMode) {
    case "whole_school":
      return true;
    case "grades":
      return ids.includes(String(student.gradeId));
    case "class_groups":
      return ids.includes(String(student.classGroupId));
    case "students":
      return ids.includes(String(student._id));
    default:
      return false;
  }
}
