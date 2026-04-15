import mongoose, { Types } from "mongoose";
import { TimetableConflict } from "@/models/TimetableConflict";
import { TimetableVersion } from "@/models/TimetableVersion";
import { recomputeConflictsForVersion } from "@/lib/timetable/recompute-conflicts";
import { recordTimetableChangeLog } from "@/lib/timetable/audit";
import { writeTransactionalAuditEvent } from "@/lib/audit/writeTransactionalAuditEvent";
import type { AuditRequestContext } from "@/lib/audit/types";

export class TimetablePublishError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "TIMETABLE_PUBLISH_ERROR") {
    super(message);
    this.name = "TimetablePublishError";
    this.status = status;
    this.code = code;
  }
}

export interface PublishTimetableVersionInput {
  schoolId: Types.ObjectId;
  versionId: Types.ObjectId;
  actorId: Types.ObjectId;
  /** When set, dual-write normalized AuditEvent alongside TimetableChangeLog. */
  auditContext?: AuditRequestContext;
}

export interface PublishTimetableVersionResult {
  publishedVersionId: string;
  archivedVersionId: string | null;
  publishedAt: string;
  openErrorCount: number;
}

export async function publishTimetableVersion(
  input: PublishTimetableVersionInput
): Promise<PublishTimetableVersionResult> {
  const targetVersion = await TimetableVersion.findOne({
    _id: input.versionId,
    schoolId: input.schoolId,
  });
  if (!targetVersion) {
    throw new TimetablePublishError(
      "Timetable version not found for school.",
      404,
      "TIMETABLE_VERSION_NOT_FOUND"
    );
  }

  if (targetVersion.status === "archived") {
    throw new TimetablePublishError(
      "Archived versions cannot be published.",
      409,
      "TIMETABLE_VERSION_ARCHIVED"
    );
  }

  await recomputeConflictsForVersion({
    schoolId: input.schoolId,
    versionId: input.versionId,
  });

  const openErrorCount = await TimetableConflict.countDocuments({
    schoolId: input.schoolId,
    versionId: input.versionId,
    status: "open",
    severity: "error",
  });
  if (openErrorCount > 0) {
    throw new TimetablePublishError(
      "Publish blocked: unresolved error conflicts exist.",
      409,
      "TIMETABLE_PUBLISH_BLOCKED"
    );
  }

  if (targetVersion.status === "published") {
    return {
      publishedVersionId: String(targetVersion._id),
      archivedVersionId: null,
      publishedAt: (targetVersion.publishedAt || new Date()).toISOString(),
      openErrorCount: 0,
    };
  }

  const session = await mongoose.startSession();
  const now = new Date();

  let archivedVersionId: Types.ObjectId | null = null;

  try {
    await session.withTransaction(async () => {
      const versionInTxn = await TimetableVersion.findOne({
        _id: input.versionId,
        schoolId: input.schoolId,
      }).session(session);

      if (!versionInTxn) {
        throw new TimetablePublishError(
          "Timetable version not found in transaction.",
          404,
          "TIMETABLE_VERSION_NOT_FOUND"
        );
      }
      if (versionInTxn.status !== "draft") {
        throw new TimetablePublishError(
          "Only draft versions can be published.",
          409,
          "TIMETABLE_VERSION_NOT_DRAFT"
        );
      }

      const previousPublished = await TimetableVersion.findOne({
        schoolId: input.schoolId,
        academicPeriodId: versionInTxn.academicPeriodId,
        status: "published",
        _id: { $ne: versionInTxn._id },
      }).session(session);

      if (previousPublished) {
        archivedVersionId = previousPublished._id;
        const previousStatusBefore = previousPublished.status;
        previousPublished.status = "archived";
        previousPublished.updatedBy = input.actorId;
        previousPublished.lockVersion = (previousPublished.lockVersion || 0) + 1;
        await previousPublished.save({ session });

        await recordTimetableChangeLog({
          schoolId: input.schoolId,
          academicPeriodId: previousPublished.academicPeriodId,
          versionId: previousPublished._id,
          action: "archived",
          actorId: input.actorId,
          entityId: previousPublished._id,
          before: { status: previousStatusBefore },
          after: { status: "archived" },
          session,
        });

        if (input.auditContext) {
          const ctx = {
            ...input.auditContext,
            idempotencyKey: `${input.auditContext.idempotencyKey}:archived:${String(previousPublished._id)}`,
          };
          await writeTransactionalAuditEvent(session, {
            actionCode: "timetable.version.archived",
            scopeType: "school",
            scopeId: String(input.schoolId),
            result: "succeeded",
            target: {
              targetEntityType: "TimetableVersion",
              targetEntityId: previousPublished._id,
            },
            context: ctx,
            payload: {
              before: { status: previousStatusBefore },
              after: { status: "archived" },
              metadata: {
                academicPeriodId: String(previousPublished.academicPeriodId),
              },
            },
            streamKey: `school:${String(input.schoolId)}:timetable`,
          });
        }
      }

      const targetStatusBefore = versionInTxn.status;
      versionInTxn.status = "published";
      versionInTxn.publishedAt = now;
      versionInTxn.updatedBy = input.actorId;
      versionInTxn.lockVersion = (versionInTxn.lockVersion || 0) + 1;
      await versionInTxn.save({ session });

      await recordTimetableChangeLog({
        schoolId: input.schoolId,
        academicPeriodId: versionInTxn.academicPeriodId,
        versionId: versionInTxn._id,
        action: "published",
        actorId: input.actorId,
        entityId: versionInTxn._id,
        before: { status: targetStatusBefore },
        after: { status: "published", publishedAt: now.toISOString() },
        session,
      });

      if (input.auditContext) {
        const ctx = {
          ...input.auditContext,
          idempotencyKey: `${input.auditContext.idempotencyKey}:published:${String(versionInTxn._id)}`,
        };
        await writeTransactionalAuditEvent(session, {
          actionCode: "timetable.version.published",
          scopeType: "school",
          scopeId: String(input.schoolId),
          result: "succeeded",
          target: {
            targetEntityType: "TimetableVersion",
            targetEntityId: versionInTxn._id,
          },
          context: ctx,
          payload: {
            before: { status: targetStatusBefore },
            after: { status: "published", publishedAt: now.toISOString() },
            metadata: {
              academicPeriodId: String(versionInTxn.academicPeriodId),
            },
          },
          streamKey: `school:${String(input.schoolId)}:timetable`,
        });
      }
    });
  } catch (error) {
    if (error instanceof TimetablePublishError) throw error;
    throw new TimetablePublishError(
      error instanceof Error ? error.message : "Failed to publish timetable version.",
      500,
      "TIMETABLE_PUBLISH_FAILED"
    );
  } finally {
    await session.endSession();
  }

  return {
    publishedVersionId: String(input.versionId),
    archivedVersionId: archivedVersionId ? String(archivedVersionId) : null,
    publishedAt: now.toISOString(),
    openErrorCount: 0,
  };
}
