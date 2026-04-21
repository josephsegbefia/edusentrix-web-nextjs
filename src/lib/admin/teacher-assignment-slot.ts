import mongoose from "mongoose";
import { TeacherAssignment } from "@/models/TeacherAssignment";

export type ExistingTeacherOnSlot = {
  assignmentId: string;
  teacherId: string;
  displayName: string;
};

/**
 * Active assignments for the same subject + class + period, excluding one teacher.
 */
export async function findOtherTeachersOnSlot(params: {
  schoolId: mongoose.Types.ObjectId;
  academicPeriodId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  classGroupId: mongoose.Types.ObjectId;
  requestingTeacherId: mongoose.Types.ObjectId;
}): Promise<ExistingTeacherOnSlot[]> {
  const rows = await TeacherAssignment.find({
    schoolId: params.schoolId,
    academicPeriodId: params.academicPeriodId,
    subjectId: params.subjectId,
    classGroupId: params.classGroupId,
    status: "active",
    teacherId: { $ne: params.requestingTeacherId },
  })
    .populate({
      path: "teacherId",
      select: "userId",
      populate: { path: "userId", select: "firstName lastName" },
    })
    .lean();

  return (rows || []).map((row: any) => {
    const t = row.teacherId;
    const u = t?.userId;
    const displayName = u
      ? `${u.firstName || ""} ${u.lastName || ""}`.trim() || "Teacher"
      : "Teacher";
    return {
      assignmentId: String(row._id),
      teacherId: String(t?._id ?? row.teacherId),
      displayName,
    };
  });
}

export async function deactivateOtherTeachersOnSlot(params: {
  schoolId: mongoose.Types.ObjectId;
  academicPeriodId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  classGroupId: mongoose.Types.ObjectId;
  keepTeacherId: mongoose.Types.ObjectId;
}): Promise<number> {
  const res = await TeacherAssignment.updateMany(
    {
      schoolId: params.schoolId,
      academicPeriodId: params.academicPeriodId,
      subjectId: params.subjectId,
      classGroupId: params.classGroupId,
      status: "active",
      teacherId: { $ne: params.keepTeacherId },
    },
    { $set: { status: "inactive" } }
  );
  return res.modifiedCount ?? 0;
}
