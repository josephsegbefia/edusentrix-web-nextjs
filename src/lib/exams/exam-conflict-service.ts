import mongoose, { Types } from "mongoose";
import { z } from "zod";
import {
  ExamConflictSnapshot,
  type IExamConflictSnapshot,
  type IExamConflictSnapshotConflict,
} from "@/models/ExamConflictSnapshot";
import { ExamInvigilatorAssignment } from "@/models/ExamInvigilatorAssignment";
import { ExamSession, type IExamSession } from "@/models/ExamSession";
import { ExamTimetableEntry } from "@/models/ExamTimetableEntry";
import type {
  ExamConflictCheckResultDTO,
  ExamConflictDTO,
  ExamConflictSnapshotDTO,
} from "@/types/academics/exam-scheduling-engine";
import {
  recordExamConflictOverridden,
  recordExamConflictSnapshotSynced,
} from "@/lib/exams/exam-conflict-audit";
import {
  computeExamReadinessScore,
  detectExamSessionConflicts,
  mergeConflictOverrides,
  summarizeActiveConflicts,
} from "@/lib/exams/exam-conflict-detection";
import { resolveExamPolicyForSchool } from "@/lib/exams/exam-policy-service";

export class ExamConflictServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ExamConflictServiceError";
    this.status = status;
  }
}

const overrideConflictBodySchema = z.object({
  conflictKey: z.string().trim().min(1),
  reason: z.string().trim().max(2000).nullable().optional(),
});

export type OverrideExamConflictBodyInput = z.infer<typeof overrideConflictBodySchema>;

export function parseOverrideExamConflictBody(body: unknown) {
  const parsed = overrideConflictBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid request body.",
    };
  }
  return { ok: true as const, data: parsed.data };
}

async function loadExamSession(input: {
  schoolId: Types.ObjectId;
  sessionId: string;
}): Promise<IExamSession> {
  if (!mongoose.Types.ObjectId.isValid(input.sessionId)) {
    throw new ExamConflictServiceError("Invalid exam session id.", 400);
  }

  const session = await ExamSession.findOne({
    _id: input.sessionId,
    schoolId: input.schoolId,
  });

  if (!session) {
    throw new ExamConflictServiceError("Exam session not found.", 404);
  }

  return session;
}

function toObjectIdArray(values: string[]): Types.ObjectId[] {
  return values
    .filter((value) => mongoose.Types.ObjectId.isValid(value))
    .map((value) => new Types.ObjectId(value));
}

function conflictToSnapshotRow(conflict: ExamConflictDTO): IExamConflictSnapshotConflict {
  return {
    key: conflict.key,
    type: conflict.type,
    severity: conflict.severity,
    message: conflict.message,
    affectedEntryIds: toObjectIdArray(conflict.affectedEntryIds),
    affectedTeacherIds: toObjectIdArray(conflict.affectedTeacherIds),
    affectedClassGroupIds: toObjectIdArray(conflict.affectedClassGroupIds),
    affectedVenueIds: toObjectIdArray(conflict.affectedVenueIds),
    suggestion: conflict.suggestion,
    canOverride: conflict.canOverride,
    overriddenBy: conflict.overriddenBy ? new Types.ObjectId(conflict.overriddenBy) : null,
    overrideReason: conflict.overrideReason ?? null,
    overriddenAt: conflict.overriddenAt ? new Date(conflict.overriddenAt) : null,
  };
}

function serializeSnapshot(doc: IExamConflictSnapshot): ExamConflictSnapshotDTO {
  return {
    id: String(doc._id),
    examSessionId: String(doc.examSessionId),
    status: doc.status,
    generatedAt: doc.generatedAt.toISOString(),
    generatedBy: doc.generatedBy ? String(doc.generatedBy) : null,
  };
}

function snapshotRowToOverride(row: IExamConflictSnapshotConflict) {
  return {
    key: row.key,
    overriddenBy: row.overriddenBy ? String(row.overriddenBy) : null,
    overrideReason: row.overrideReason ?? null,
    overriddenAt: row.overriddenAt ? row.overriddenAt.toISOString() : null,
  };
}

function mergeLiveWithStoredOverrides(
  liveConflicts: ExamConflictDTO[],
  storedConflicts: IExamConflictSnapshotConflict[]
): ExamConflictDTO[] {
  return mergeConflictOverrides(
    liveConflicts,
    storedConflicts.map(snapshotRowToOverride)
  );
}

function buildSnapshotRowsPreservingOverrides(
  liveConflicts: ExamConflictDTO[],
  storedConflicts: IExamConflictSnapshotConflict[]
): IExamConflictSnapshotConflict[] {
  const storedByKey = new Map(storedConflicts.map((row) => [row.key, row]));

  return liveConflicts.map((live) => {
    const stored = storedByKey.get(live.key);
    if (stored?.overriddenBy) {
      return {
        ...conflictToSnapshotRow({
          ...live,
          isOverridden: true,
          overriddenBy: String(stored.overriddenBy),
          overrideReason: stored.overrideReason ?? null,
          overriddenAt: stored.overriddenAt ? stored.overriddenAt.toISOString() : null,
        }),
      };
    }
    return conflictToSnapshotRow(live);
  });
}

function deriveSnapshotStatus(rows: IExamConflictSnapshotConflict[]) {
  return rows.some((row) => row.overriddenBy) ? "overridden" : "open";
}

function buildCheckResult(input: {
  session: IExamSession;
  entryCount: number;
  conflicts: ExamConflictDTO[];
  snapshot: IExamConflictSnapshot | null;
  policy: {
    allowConflictOverride: boolean;
    requireOverrideReason: boolean;
  };
}): ExamConflictCheckResultDTO {
  const { grouped, overriddenCount } = summarizeActiveConflicts(input.conflicts);

  return {
    examSessionId: String(input.session._id),
    checkedAt: new Date().toISOString(),
    snapshot: input.snapshot ? serializeSnapshot(input.snapshot) : null,
    policy: {
      allowConflictOverride: input.policy.allowConflictOverride,
      requireOverrideReason: input.policy.requireOverrideReason,
    },
    summary: {
      total: input.conflicts.length,
      errors: grouped.errors.length,
      warnings: grouped.warnings.length,
      info: grouped.info.length,
      overridden: overriddenCount,
      entryCount: input.entryCount,
      readinessScore: computeExamReadinessScore({
        errorCount: grouped.errors.length,
        warningCount: grouped.warnings.length,
        entryCount: input.entryCount,
      }),
    },
    grouped,
    conflicts: input.conflicts,
  };
}

async function detectLiveConflicts(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  session: IExamSession;
}) {
  const [entries, invigilators, policy] = await Promise.all([
    ExamTimetableEntry.find({
      schoolId: input.schoolId,
      examSessionId: input.session._id,
      status: { $ne: "cancelled" },
    })
      .select(
        "_id date startTime endTime durationMinutes venueId roomLabel classGroupIds status isUnscheduled"
      )
      .lean(),
    ExamInvigilatorAssignment.find({
      schoolId: input.schoolId,
      examSessionId: input.session._id,
      status: { $in: ["assigned", "acknowledged"] },
    })
      .select("_id examTimetableEntryId teacherId status")
      .lean(),
    resolveExamPolicyForSchool({
      schoolId: input.schoolId,
      policyId: input.session.policyId ?? null,
      actorId: input.actorId,
    }),
  ]);

  const conflicts = detectExamSessionConflicts({
    session: {
      startDate: input.session.startDate.toISOString(),
      endDate: input.session.endDate.toISOString(),
    },
    entries: entries.map((entry) => ({
      id: String(entry._id),
      date: new Date(entry.date).toISOString(),
      startTime: entry.startTime,
      endTime: entry.endTime,
      durationMinutes: entry.durationMinutes,
      venueId: entry.venueId ? String(entry.venueId) : null,
      roomLabel: entry.roomLabel ?? null,
      classGroupIds: (entry.classGroupIds ?? []).map((id) => String(id)),
      status: entry.status,
      isUnscheduled: entry.isUnscheduled ?? false,
    })),
    invigilators: invigilators.map((row) => ({
      id: String(row._id),
      examTimetableEntryId: String(row.examTimetableEntryId),
      teacherId: String(row.teacherId),
      status: row.status,
    })),
    policy: {
      requireVenue: policy.requireVenue,
      requireInvigilator: policy.requireInvigilator,
      preventRoomDoubleBooking: policy.preventRoomDoubleBooking,
      preventClassExamOverlap: policy.preventClassExamOverlap,
      preventTeacherInvigilationOverlap: policy.preventTeacherInvigilationOverlap,
      allowConflictOverride: policy.allowConflictOverride,
    },
  });

  return { conflicts, entryCount: entries.length, policy };
}

async function persistConflictSnapshot(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  session: IExamSession;
  liveConflicts: ExamConflictDTO[];
  existingSnapshot: IExamConflictSnapshot | null;
  auditSync?: boolean;
}) {
  const rows = buildSnapshotRowsPreservingOverrides(
    input.liveConflicts,
    input.existingSnapshot?.conflicts ?? []
  );
  const mergedConflicts = mergeLiveWithStoredOverrides(
    input.liveConflicts,
    rows
  );
  const status = deriveSnapshotStatus(rows);
  const generatedAt = new Date();

  const snapshot = await ExamConflictSnapshot.findOneAndUpdate(
    {
      schoolId: input.schoolId,
      examSessionId: input.session._id,
    },
    {
      $set: {
        generatedAt,
        generatedBy: input.actorId,
        status,
        conflicts: rows,
      },
      $setOnInsert: {
        schoolId: input.schoolId,
        examSessionId: input.session._id,
      },
    },
    { upsert: true, new: true }
  );

  if (input.auditSync) {
    await recordExamConflictSnapshotSynced({
      schoolId: input.schoolId,
      actorId: input.actorId,
      examSessionId: input.session._id,
      snapshotId: snapshot._id,
      conflictCount: mergedConflicts.length,
      overriddenCount: mergedConflicts.filter((row) => row.isOverridden).length,
    });
  }

  return { snapshot, mergedConflicts };
}

export async function runExamSessionConflictCheck(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  sessionId: string;
}): Promise<ExamConflictCheckResultDTO> {
  const session = await loadExamSession({
    schoolId: input.schoolId,
    sessionId: input.sessionId,
  });

  const existingSnapshot = await ExamConflictSnapshot.findOne({
    schoolId: input.schoolId,
    examSessionId: session._id,
  });

  const { conflicts: liveConflicts, entryCount, policy } = await detectLiveConflicts({
    schoolId: input.schoolId,
    actorId: input.actorId,
    session,
  });

  const { snapshot, mergedConflicts } = await persistConflictSnapshot({
    schoolId: input.schoolId,
    actorId: input.actorId,
    session,
    liveConflicts,
    existingSnapshot,
  });

  return buildCheckResult({
    session,
    entryCount,
    conflicts: mergedConflicts,
    snapshot,
    policy: {
      allowConflictOverride: policy.allowConflictOverride,
      requireOverrideReason: policy.requireOverrideReason,
    },
  });
}

export async function overrideExamSessionConflict(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  sessionId: string;
  body: OverrideExamConflictBodyInput;
}): Promise<ExamConflictCheckResultDTO> {
  const session = await loadExamSession({
    schoolId: input.schoolId,
    sessionId: input.sessionId,
  });

  const { conflicts: liveConflicts, entryCount, policy } = await detectLiveConflicts({
    schoolId: input.schoolId,
    actorId: input.actorId,
    session,
  });

  if (!policy.allowConflictOverride) {
    throw new ExamConflictServiceError(
      "Conflict overrides are not allowed by the exam policy for this school.",
      403
    );
  }

  const existingSnapshot = await ExamConflictSnapshot.findOne({
    schoolId: input.schoolId,
    examSessionId: session._id,
  });

  const mergedConflicts = mergeLiveWithStoredOverrides(
    liveConflicts,
    existingSnapshot?.conflicts ?? []
  );

  const conflict = mergedConflicts.find((row) => row.key === input.body.conflictKey);
  if (!conflict) {
    throw new ExamConflictServiceError("Conflict not found for this exam session.", 404);
  }

  if (!conflict.canOverride) {
    throw new ExamConflictServiceError("This conflict cannot be overridden.", 409);
  }

  if (conflict.isOverridden) {
    throw new ExamConflictServiceError("This conflict has already been overridden.", 409);
  }

  const reason = input.body.reason?.trim() ? input.body.reason.trim() : null;
  if (policy.requireOverrideReason && !reason) {
    throw new ExamConflictServiceError("An override reason is required.", 400);
  }

  const overriddenAt = new Date().toISOString();
  const overriddenConflict: ExamConflictDTO = {
    ...conflict,
    isOverridden: true,
    overriddenBy: String(input.actorId),
    overrideReason: reason,
    overriddenAt,
  };

  const rows = buildSnapshotRowsPreservingOverrides(liveConflicts, existingSnapshot?.conflicts ?? [])
    .map((row) =>
      row.key === conflict.key
        ? conflictToSnapshotRow(overriddenConflict)
        : row
    );

  const snapshot = await ExamConflictSnapshot.findOneAndUpdate(
    {
      schoolId: input.schoolId,
      examSessionId: session._id,
    },
    {
      $set: {
        generatedAt: new Date(),
        generatedBy: input.actorId,
        status: deriveSnapshotStatus(rows),
        conflicts: rows,
      },
      $setOnInsert: {
        schoolId: input.schoolId,
        examSessionId: session._id,
      },
    },
    { upsert: true, new: true }
  );

  await recordExamConflictOverridden({
    schoolId: input.schoolId,
    actorId: input.actorId,
    examSessionId: session._id,
    snapshotId: snapshot._id,
    conflict: overriddenConflict,
    reason,
  });

  const finalConflicts = mergeLiveWithStoredOverrides(liveConflicts, rows);

  return buildCheckResult({
    session,
    entryCount,
    conflicts: finalConflicts,
    snapshot,
    policy: {
      allowConflictOverride: policy.allowConflictOverride,
      requireOverrideReason: policy.requireOverrideReason,
    },
  });
}
