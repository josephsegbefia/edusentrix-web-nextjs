import { Types } from "mongoose";
import { recordActivity } from "@/lib/audit/recordActivity";
import type { ExamConflictDTO } from "@/types/academics/exam-scheduling-engine";

export async function recordExamConflictSnapshotSynced(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  examSessionId: Types.ObjectId;
  snapshotId: Types.ObjectId;
  conflictCount: number;
  overriddenCount: number;
}) {
  await recordActivity({
    schoolId: input.schoolId,
    userId: input.actorId,
    type: "exam.conflicts.snapshot_synced",
    entityType: "ExamConflictSnapshot",
    entityId: input.snapshotId,
    description: "Exam conflict review snapshot synced.",
    metadata: {
      examSessionId: String(input.examSessionId),
      conflictCount: input.conflictCount,
      overriddenCount: input.overriddenCount,
    },
  });
}

export async function recordExamConflictOverridden(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  examSessionId: Types.ObjectId;
  snapshotId: Types.ObjectId;
  conflict: ExamConflictDTO;
  reason: string | null;
}) {
  await recordActivity({
    schoolId: input.schoolId,
    userId: input.actorId,
    type: "exam.conflicts.overridden",
    entityType: "ExamConflictSnapshot",
    entityId: input.snapshotId,
    description: "An exam scheduling conflict was overridden.",
    metadata: {
      examSessionId: String(input.examSessionId),
      conflictKey: input.conflict.key,
      conflictType: input.conflict.type,
      conflictSeverity: input.conflict.severity,
      overrideReason: input.reason,
      affectedEntryIds: input.conflict.affectedEntryIds,
    },
  });
}
