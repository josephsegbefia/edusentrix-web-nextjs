import { Types } from "mongoose";
import { TimetableSlot } from "@/models/TimetableSlot";
import { TimetableVersion } from "@/models/TimetableVersion";

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}

async function copyPublishedSlotsIntoDraft(args: {
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  publishedVersionId: Types.ObjectId;
  draftVersionId: Types.ObjectId;
  actorId: Types.ObjectId;
  onlyMissingClassGroups?: boolean;
}) {
  let classGroupIdsToSkip = new Set<string>();
  if (args.onlyMissingClassGroups) {
    const existingDraftClassGroups = await TimetableSlot.distinct("classGroupId", {
      schoolId: args.schoolId,
      academicPeriodId: args.academicPeriodId,
      versionId: args.draftVersionId,
    });
    classGroupIdsToSkip = new Set(existingDraftClassGroups.map((id) => String(id)));
  }

  const publishedQuery: Record<string, unknown> = {
    schoolId: args.schoolId,
    academicPeriodId: args.academicPeriodId,
    versionId: args.publishedVersionId,
  };
  if (classGroupIdsToSkip.size > 0) {
    publishedQuery.classGroupId = {
      $nin: Array.from(classGroupIdsToSkip).map((id) => new Types.ObjectId(id)),
    };
  }

  const publishedSlots = await TimetableSlot.find(publishedQuery)
    .select(
      "schoolId academicPeriodId classGroupId gradeId subjectId subjectOfferingId teacherId roomId dayOfWeek startTime endTime classroomLabel source legacyAssignmentId"
    )
    .lean();

  if (!publishedSlots.length) return 0;

  await TimetableSlot.insertMany(
    publishedSlots.map((slot) => ({
      schoolId: slot.schoolId,
      academicPeriodId: slot.academicPeriodId,
      versionId: args.draftVersionId,
      classGroupId: slot.classGroupId,
      gradeId: slot.gradeId,
      subjectId: slot.subjectId,
      subjectOfferingId: slot.subjectOfferingId ?? null,
      teacherId: slot.teacherId ?? null,
      roomId: slot.roomId ?? null,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      classroomLabel: slot.classroomLabel,
      source: "manual",
      legacyAssignmentId: slot.legacyAssignmentId ?? null,
      createdBy: args.actorId,
      updatedBy: args.actorId,
    })),
    { ordered: false }
  );

  return publishedSlots.length;
}

/**
 * Find or create a draft timetable version for the given school and academic period.
 * Used by class-group slot creation and timetable mutation flows.
 */
export async function findOrCreateDraftVersion(args: {
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  actorId: Types.ObjectId;
}): Promise<Types.ObjectId> {
  const [existingDraft, published] = await Promise.all([
    TimetableVersion.findOne({
      schoolId: args.schoolId,
      academicPeriodId: args.academicPeriodId,
      status: "draft",
    })
      .sort({ updatedAt: -1, createdAt: -1 })
      .select("_id")
      .lean(),
    TimetableVersion.findOne({
      schoolId: args.schoolId,
      academicPeriodId: args.academicPeriodId,
      status: "published",
    })
      .select("_id")
      .lean(),
  ]);

  if (existingDraft) {
    if (published) {
      await copyPublishedSlotsIntoDraft({
        schoolId: args.schoolId,
        academicPeriodId: args.academicPeriodId,
        publishedVersionId: (published as { _id: Types.ObjectId })._id,
        draftVersionId: (existingDraft as { _id: Types.ObjectId })._id,
        actorId: args.actorId,
        onlyMissingClassGroups: true,
      });
    }
    return (existingDraft as { _id: Types.ObjectId })._id;
  }

  let created: { _id: Types.ObjectId };
  try {
    created = await TimetableVersion.create({
      schoolId: args.schoolId,
      academicPeriodId: args.academicPeriodId,
      name: `Draft ${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC`,
      status: "draft",
      baseVersionId: published ? (published as { _id: Types.ObjectId })._id : null,
      publishedAt: null,
      stale: false,
      staleReasons: [],
      createdBy: args.actorId,
      updatedBy: args.actorId,
      lockVersion: 0,
    });

    if (published) {
      await copyPublishedSlotsIntoDraft({
        schoolId: args.schoolId,
        academicPeriodId: args.academicPeriodId,
        publishedVersionId: (published as { _id: Types.ObjectId })._id,
        draftVersionId: created._id,
        actorId: args.actorId,
      });
    }
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const existingAfterRace = await TimetableVersion.findOne({
      schoolId: args.schoolId,
      academicPeriodId: args.academicPeriodId,
      status: "draft",
    })
      .select("_id")
      .lean();
    if (existingAfterRace) {
      return (existingAfterRace as { _id: Types.ObjectId })._id;
    }
    throw error;
  }

  return created._id;
}
