import "server-only";

import mongoose from "mongoose";
import { LessonAuditLog, type LessonAuditAction } from "@/models/LessonAuditLog";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  buildSchoolUserAuditContext,
  resolveAuditIdempotencyKey,
} from "@/lib/audit/fromApiRoute";
import { writeRetryableAuditEvent } from "@/lib/audit/writeRetryableAuditEvent";
import { canonicalJsonStringify } from "@/lib/audit/hash-chain";

function lessonsStreamKey(schoolId: mongoose.Types.ObjectId) {
  return `school:${String(schoolId)}:lessons`;
}

function actionToCode(action: LessonAuditAction): string {
  const map: Record<LessonAuditAction, string> = {
    lesson_created_from_note: "lesson.created_from_note",
    lesson_updated: "lesson.updated",
    lesson_published: "lesson.published",
    lesson_unpublished: "lesson.unpublished",
    lesson_archived: "lesson.archived",
    resource_added: "lesson.resource_added",
    resource_deleted: "lesson.resource_deleted",
    flashcards_published: "lesson.flashcards_published",
  };
  return map[action];
}

function stableMetadataIdempotency(
  prefix: string,
  metadata: Record<string, unknown> | undefined
): string {
  const md = metadata ?? {};
  const keys = Object.keys(md).sort();
  const ordered: Record<string, unknown> = {};
  for (const k of keys) {
    ordered[k] = md[k];
  }
  return `${prefix}:${canonicalJsonStringify(ordered)}`;
}

function lessonAuditIdempotencyFallback(
  action: LessonAuditAction,
  lessonId: mongoose.Types.ObjectId,
  metadata?: Record<string, unknown>
): string {
  const lid = String(lessonId);
  switch (action) {
    case "lesson_created_from_note":
      return `lesson.created_from_note:${lid}`;
    case "lesson_published":
      return `lesson.published:${lid}:${String(metadata?.publishedAt ?? metadata?.previousStatus ?? "na")}`;
    case "lesson_unpublished":
      return `lesson.unpublished:${lid}:${String(metadata?.previousStatus ?? "na")}`;
    case "lesson_archived":
      return `lesson.archived:${lid}:${String(metadata?.previousStatus ?? "na")}`;
    case "lesson_updated":
      return stableMetadataIdempotency(`lesson.updated:${lid}`, metadata);
    case "resource_added":
      return `lesson.resource_added:${String(metadata?.resourceId ?? lid)}`;
    case "resource_deleted":
      return `lesson.resource_deleted:${String(metadata?.resourceId ?? lid)}`;
    case "flashcards_published":
      return `lesson.flashcards_published:${lid}:${String(metadata?.publishedAt ?? metadata?.cardCount ?? "na")}`;
    default:
      return `lesson.audit:${lid}:${action}`;
  }
}

export async function recordLessonAudit(input: {
  schoolId: mongoose.Types.ObjectId;
  lessonId: mongoose.Types.ObjectId;
  actorId: mongoose.Types.ObjectId;
  action: LessonAuditAction;
  metadata?: Record<string, unknown>;
  /** When set, also appends a Tier-1 hash-chained row to `AuditEvent` (stream `school:<id>:lessons`). */
  httpRequest?: Request;
  actorRole?: string;
}): Promise<void> {
  try {
    await connectToDatabase();
    await LessonAuditLog.create({
      schoolId: input.schoolId,
      lessonId: input.lessonId,
      actorId: input.actorId,
      action: input.action,
      metadata:
        input.metadata && Object.keys(input.metadata).length > 0 ? input.metadata : {},
    });
  } catch (e) {
    console.error("[lessons] recordLessonAudit failed:", e);
    return;
  }

  const req = input.httpRequest;
  if (!req) return;

  const actionCode = actionToCode(input.action);
  const actorRole = input.actorRole?.trim() || "teacher";
  const idempotencyKey = resolveAuditIdempotencyKey(
    req,
    lessonAuditIdempotencyFallback(input.action, input.lessonId, input.metadata)
  );

  try {
    await writeRetryableAuditEvent({
      actionCode,
      scopeType: "school",
      scopeId: String(input.schoolId),
      result: "succeeded",
      target: {
        targetEntityType: "Lesson",
        targetEntityId: input.lessonId,
      },
      streamKey: lessonsStreamKey(input.schoolId),
      context: buildSchoolUserAuditContext(req, {
        userId: input.actorId,
        schoolId: input.schoolId,
        actorRole,
        idempotencyKey,
      }),
      payload: {
        metadata:
          input.metadata && Object.keys(input.metadata).length > 0 ? input.metadata : {},
      },
    });
  } catch (e) {
    console.error("[lessons] recordLessonAudit hash-chain failed:", e);
  }
}

export type { LessonAuditAction };
