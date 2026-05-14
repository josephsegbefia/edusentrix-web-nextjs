import mongoose from "mongoose";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { TimetableSlot } from "@/models/TimetableSlot";
import { TimetableVersion } from "@/models/TimetableVersion";
import { recomputeConflictsForVersion } from "@/lib/timetable/recompute-conflicts";

type AssignmentPair = {
  academicPeriodId: mongoose.Types.ObjectId;
  classGroupId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
};

function pairKey(pair: AssignmentPair): string {
  return [
    String(pair.academicPeriodId),
    String(pair.classGroupId),
    String(pair.subjectId),
  ].join("|");
}

async function syncSinglePairWithoutRecompute(args: {
  schoolId: mongoose.Types.ObjectId;
  pair: AssignmentPair;
  updatedBy?: mongoose.Types.ObjectId;
}): Promise<{
  modified: number;
  affectedVersionIds: mongoose.Types.ObjectId[];
}> {
  const versions = await TimetableVersion.find({
    schoolId: args.schoolId,
    academicPeriodId: args.pair.academicPeriodId,
    status: "draft",
  })
    .select("_id")
    .lean();

  if (!versions.length) {
    return { modified: 0, affectedVersionIds: [] };
  }

  const affectedVersionIds = (versions as Array<{ _id: mongoose.Types.ObjectId }>).map(
    (version) => version._id
  );

  const assignmentRows = await TeacherAssignment.find({
    schoolId: args.schoolId,
    academicPeriodId: args.pair.academicPeriodId,
    classGroupId: args.pair.classGroupId,
    subjectId: args.pair.subjectId,
    status: "active",
  })
    .sort({ assignedAt: 1, createdAt: 1, _id: 1 })
    .select("teacherId assignedAt createdAt")
    .lean();

  const activeTeacherIds: mongoose.Types.ObjectId[] = [];
  const seenTeacherIds = new Set<string>();
  for (const row of assignmentRows as Array<{ teacherId: mongoose.Types.ObjectId }>) {
    const teacherId = row.teacherId;
    const key = String(teacherId);
    if (!key || seenTeacherIds.has(key)) continue;
    seenTeacherIds.add(key);
    activeTeacherIds.push(teacherId);
  }

  const baseFilter: Record<string, unknown> = {
    schoolId: args.schoolId,
    academicPeriodId: args.pair.academicPeriodId,
    versionId: { $in: affectedVersionIds },
    classGroupId: args.pair.classGroupId,
    subjectId: args.pair.subjectId,
  };

  if (activeTeacherIds.length === 0) {
    const updateOps: Record<string, unknown> = {
      $unset: { teacherId: 1 },
    };
    if (args.updatedBy) {
      updateOps.$set = { updatedBy: args.updatedBy };
    }

    const res = await TimetableSlot.updateMany(
      {
        ...baseFilter,
        teacherId: { $exists: true },
      },
      updateOps
    );

    return {
      modified: res.modifiedCount ?? 0,
      affectedVersionIds,
    };
  }

  const primaryTeacherId = activeTeacherIds[0];
  const res = await TimetableSlot.updateMany(
    {
      ...baseFilter,
      $or: [
        { teacherId: { $exists: false } },
        { teacherId: null },
        { teacherId: { $nin: activeTeacherIds } },
      ],
    },
    {
      $set: {
        teacherId: primaryTeacherId,
        ...(args.updatedBy ? { updatedBy: args.updatedBy } : {}),
      },
    }
  );

  return {
    modified: res.modifiedCount ?? 0,
    affectedVersionIds,
  };
}

export async function syncTimetableSlotTeachersFromAssignments(args: {
  schoolId: mongoose.Types.ObjectId;
  pairs: AssignmentPair[];
  updatedBy?: mongoose.Types.ObjectId;
}): Promise<{
  modified: number;
  affectedVersionIds: string[];
}> {
  const uniquePairs = Array.from(
    new Map(args.pairs.map((pair) => [pairKey(pair), pair])).values()
  );

  if (uniquePairs.length === 0) {
    return { modified: 0, affectedVersionIds: [] };
  }

  let modified = 0;
  const versionIdsToRecompute = new Map<string, mongoose.Types.ObjectId>();

  for (const pair of uniquePairs) {
    const result = await syncSinglePairWithoutRecompute({
      schoolId: args.schoolId,
      pair,
      updatedBy: args.updatedBy,
    });
    modified += result.modified;
    if (result.modified > 0) {
      for (const versionId of result.affectedVersionIds) {
        versionIdsToRecompute.set(String(versionId), versionId);
      }
    }
  }

  for (const versionId of versionIdsToRecompute.values()) {
    await recomputeConflictsForVersion({
      schoolId: args.schoolId,
      versionId,
    });
  }

  return {
    modified,
    affectedVersionIds: Array.from(versionIdsToRecompute.keys()),
  };
}

/**
 * Legacy helper name kept for compatibility with older assignment flows.
 * Only draft timetable slots are updated; published timetables are immutable snapshots.
 */
export async function syncDraftSlotTeachersFromAssignment(args: {
  schoolId: mongoose.Types.ObjectId;
  academicPeriodId: mongoose.Types.ObjectId;
  classGroupId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
}): Promise<{ matched: number }> {
  void args.teacherId;
  const result = await syncTimetableSlotTeachersFromAssignments({
    schoolId: args.schoolId,
    pairs: [
      {
        academicPeriodId: args.academicPeriodId,
        classGroupId: args.classGroupId,
        subjectId: args.subjectId,
      },
    ],
    updatedBy: args.updatedBy,
  });

  return { matched: result.modified };
}
