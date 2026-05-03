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
    lesson_deleted: "lesson.deleted",
    lesson_published: "lesson.published",
    lesson_unpublished: "lesson.unpublished",
    lesson_archived: "lesson.archived",
    student_content_updated: "lesson.student_content_updated",
    parent_summary_saved: "lesson.parent_summary_saved",
    parent_summary_visibility_changed: "lesson.parent_summary_visibility_changed",
    resource_added: "lesson.resource_added",
    resource_updated: "lesson.resource_updated",
    resource_deleted: "lesson.resource_deleted",
    resources_reordered: "lesson.resources_reordered",
    flashcard_deck_created: "lesson.flashcard_deck_created",
    flashcard_deck_updated: "lesson.flashcard_deck_updated",
    flashcard_deck_published: "lesson.flashcard_deck_published",
    flashcard_deck_archived: "lesson.flashcard_deck_archived",
    flashcard_added: "lesson.flashcard_added",
    flashcard_updated: "lesson.flashcard_updated",
    flashcard_deleted: "lesson.flashcard_deleted",
    flashcards_reordered: "lesson.flashcards_reordered",
    reflection_saved: "lesson.reflection_saved",
    teaching_mode_updated: "lesson.teaching_mode_updated",
    teaching_mode_generated: "lesson.teaching_mode_generated",
    collaborator_added: "lesson.collaborator_added",
    collaborator_removed: "lesson.collaborator_removed",
    comment_added: "lesson.comment_added",
    comment_resolved: "lesson.comment_resolved",
    ai_draft_generated: "lesson.ai_draft_generated",
    ai_draft_applied: "lesson.ai_draft_applied",
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
    case "lesson_deleted":
      return `lesson.deleted:${lid}`;
    case "resource_added":
      return `lesson.resource_added:${String(metadata?.resourceId ?? lid)}`;
    case "resource_updated":
      return stableMetadataIdempotency(`lesson.resource_updated:${String(metadata?.resourceId ?? lid)}`, metadata);
    case "resource_deleted":
      return `lesson.resource_deleted:${String(metadata?.resourceId ?? lid)}`;
    case "resources_reordered":
      return stableMetadataIdempotency(`lesson.resources_reordered:${lid}`, metadata);
    case "student_content_updated":
      return stableMetadataIdempotency(`lesson.student_content_updated:${lid}`, metadata);
    case "parent_summary_saved":
      return stableMetadataIdempotency(`lesson.parent_summary_saved:${lid}`, metadata);
    case "parent_summary_visibility_changed":
      return stableMetadataIdempotency(`lesson.parent_summary_visibility_changed:${lid}`, metadata);
    case "flashcard_deck_created":
    case "flashcard_deck_updated":
    case "flashcard_deck_published":
    case "flashcard_deck_archived":
      return stableMetadataIdempotency(`lesson.${action}:${String(metadata?.deckId ?? lid)}`, metadata);
    case "flashcard_added":
    case "flashcard_updated":
    case "flashcard_deleted":
      return stableMetadataIdempotency(`lesson.${action}:${String(metadata?.cardId ?? lid)}`, metadata);
    case "flashcards_reordered":
    case "reflection_saved":
    case "teaching_mode_updated":
    case "teaching_mode_generated":
    case "collaborator_added":
    case "collaborator_removed":
    case "comment_added":
    case "comment_resolved":
    case "ai_draft_generated":
    case "ai_draft_applied":
      return stableMetadataIdempotency(`lesson.${action}:${lid}`, metadata);
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
