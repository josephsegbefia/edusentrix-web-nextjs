import mongoose from "mongoose";
import { ClassGroup } from "@/models/ClassGroup";
import type { IStudent } from "@/models/Student";

export async function getEffectiveSubjectIdsForStudent(
  student: Pick<IStudent, "classGroupId" | "subjectAddIds" | "subjectRemoveIds">
): Promise<mongoose.Types.ObjectId[]> {
  const grpRaw = await ClassGroup.findById(student.classGroupId)
    .select("subjectIds")
    .lean();
  const grp = (Array.isArray(grpRaw) ? grpRaw[0] : grpRaw) as {
    subjectIds?: mongoose.Types.ObjectId[];
  } | null;

  const base = new Set<string>(
    (grp?.subjectIds || []).map((id) => String(id))
  );
  for (const add of student.subjectAddIds || []) base.add(String(add));
  for (const rem of student.subjectRemoveIds || []) base.delete(String(rem));

  return Array.from(base).map((id) => new mongoose.Types.ObjectId(id));
}
