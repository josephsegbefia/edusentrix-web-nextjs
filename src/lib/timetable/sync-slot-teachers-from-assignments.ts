import mongoose from "mongoose";
import { TimetableSlot } from "@/models/TimetableSlot";
import { TimetableVersion } from "@/models/TimetableVersion";
import { recomputeConflictsForVersion } from "@/lib/timetable/recompute-conflicts";

/**
 * When a subject–teacher assignment is created for a class, fill in draft timetable
 * slots that were placed before a teacher existed (teacherId was null).
 */
export async function syncDraftSlotTeachersFromAssignment(args: {
  schoolId: mongoose.Types.ObjectId;
  academicPeriodId: mongoose.Types.ObjectId;
  classGroupId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
}): Promise<{ matched: number }> {
  const version = await TimetableVersion.findOne({
    schoolId: args.schoolId,
    academicPeriodId: args.academicPeriodId,
    status: "draft",
  })
    .sort({ updatedAt: -1 })
    .select("_id")
    .lean();

  if (!version) {
    return { matched: 0 };
  }

  const versionId = (version as { _id: mongoose.Types.ObjectId })._id;

  const res = await TimetableSlot.updateMany(
    {
      schoolId: args.schoolId,
      versionId,
      classGroupId: args.classGroupId,
      subjectId: args.subjectId,
      $or: [{ teacherId: null }, { teacherId: { $exists: false } }],
    },
    {
      $set: {
        teacherId: args.teacherId,
        ...(args.updatedBy ? { updatedBy: args.updatedBy } : {}),
      },
    }
  );

  const matched = typeof res.modifiedCount === "number" ? res.modifiedCount : 0;
  if (matched > 0) {
    await recomputeConflictsForVersion({ schoolId: args.schoolId, versionId });
  }

  return { matched };
}
