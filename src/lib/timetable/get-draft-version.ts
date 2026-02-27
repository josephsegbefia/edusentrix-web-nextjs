import { Types } from "mongoose";
import { TimetableVersion } from "@/models/TimetableVersion";

/**
 * Find or create a draft timetable version for the given school and academic period.
 * Used by class-group slot creation and dual-write.
 */
export async function findOrCreateDraftVersion(args: {
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  actorId: Types.ObjectId;
}): Promise<Types.ObjectId> {
  const existingDraft = await TimetableVersion.findOne({
    schoolId: args.schoolId,
    academicPeriodId: args.academicPeriodId,
    status: "draft",
  })
    .sort({ updatedAt: -1, createdAt: -1 })
    .select("_id")
    .lean();

  if (existingDraft) {
    return (existingDraft as { _id: Types.ObjectId })._id;
  }

  const published = await TimetableVersion.findOne({
    schoolId: args.schoolId,
    academicPeriodId: args.academicPeriodId,
    status: "published",
  })
    .select("_id")
    .lean();

  const created = await TimetableVersion.create({
    schoolId: args.schoolId,
    academicPeriodId: args.academicPeriodId,
    name: `Draft ${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC`,
    status: "draft",
    baseVersionId: published ? (published as { _id: Types.ObjectId })._id : null,
    publishedAt: null,
    createdBy: args.actorId,
    updatedBy: args.actorId,
    lockVersion: 0,
  });

  return created._id;
}
