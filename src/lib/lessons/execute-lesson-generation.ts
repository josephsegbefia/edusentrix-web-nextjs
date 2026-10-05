import "server-only";

import mongoose from "mongoose";
import type { TeacherContext } from "@/lib/auth/requireTeacher";
import type { TrackedJobContext } from "@/lib/background/worker-wrapper";
import {
  classifyAiProviderError,
  lessonGenerationPrerequisiteError,
} from "@/lib/background/ai-errors";
import { generateSessionContentBlocks } from "@/lib/lessons/generate-session-content";
import {
  lessonGenerationActionUrl,
} from "@/lib/lessons/enqueue-lesson-generation";
import { summarizeContentBlocksForHandoff } from "@/lib/lessons/session-content-handoff";
import {
  LessonAiGenerationRequest,
  type ILessonAiGenerationRequest,
} from "@/models/LessonAiGenerationRequest";
import { LessonSession } from "@/models/LessonSession";
import { Teacher } from "@/models/Teacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { gateLessonsFeature, gateLessonsModule } from "@/lib/lessons/lesson-gates";
import { requireEntitlement } from "@/lib/billing/require-entitlement";

async function rebuildTeacherContext(request: ILessonAiGenerationRequest): Promise<TeacherContext> {
  const teacher = await Teacher.findOne({
    _id: request.teacherId,
    schoolId: request.schoolId,
  })
    .select("_id")
    .lean<{ _id: mongoose.Types.ObjectId } | null>();
  if (!teacher) {
    throw lessonGenerationPrerequisiteError("Teacher is no longer available for this generation.");
  }
  return {
    userId: request.teacherUserId,
    teacherId: request.teacherId,
    schoolId: request.schoolId,
    roles: ["teacher"],
    subroles: [],
    permissions: [PERMISSIONS.lessonAiUse],
    isAdmin: false,
  };
}

async function assertExecutionEntitlement(context: TeacherContext) {
  const moduleGate = await gateLessonsModule(context.schoolId);
  if (!moduleGate.ok) {
    throw lessonGenerationPrerequisiteError(moduleGate.error);
  }
  const leoFeature = gateLessonsFeature(
    moduleGate.settings,
    "enableLeoLessonTools",
    "Leo lesson tools"
  );
  if (!leoFeature.ok) {
    throw lessonGenerationPrerequisiteError(leoFeature.error);
  }
  if (!can(context.permissions, PERMISSIONS.lessonAiUse)) {
    throw lessonGenerationPrerequisiteError("Leo lesson generation is not permitted.");
  }
  await requireEntitlement({
    schoolId: context.schoolId,
    featureKey: "ai_lesson_notes",
    limitKey: "maxAICallsPerMonth",
    expensive: true,
  });
}

export async function executeLessonAiGeneration(
  tracked: TrackedJobContext
): Promise<Record<string, unknown>> {
  const generationRequestId =
    typeof tracked.job.input?.generationRequestId === "string"
      ? tracked.job.input.generationRequestId
      : null;
  if (!generationRequestId || !mongoose.Types.ObjectId.isValid(generationRequestId)) {
    throw lessonGenerationPrerequisiteError("generationRequestId is required");
  }

  const request = await LessonAiGenerationRequest.findById(generationRequestId);
  if (!request) {
    throw lessonGenerationPrerequisiteError("Lesson generation request not found");
  }
  if (String(request.schoolId) !== String(tracked.job.schoolId)) {
    throw lessonGenerationPrerequisiteError("Lesson generation tenant mismatch");
  }

  request.status = "running";
  await request.save();

  await tracked.updateProgress({
    progressPercent: 5,
    progressStage: "preparing_context",
    progressMessage: "Preparing lesson context",
  });
  await tracked.throwIfCancellationRequested();

  const context = await rebuildTeacherContext(request);
  await assertExecutionEntitlement(context);

  const slots = request.slots ?? [];
  if (slots.length === 0) {
    throw lessonGenerationPrerequisiteError("No session slots to generate");
  }

  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index]!;
    await tracked.throwIfCancellationRequested();

    const existingResult = request.slotResults.find(
      (row) => row.slotDraftId === slot.slotDraftId && row.status === "succeeded" && row.contentBlocks?.length
    );
    if (existingResult) {
      continue;
    }

    const generatingPercent = Math.min(70, 20 + Math.round((index / slots.length) * 50));
    await tracked.updateProgress({
      progressPercent: generatingPercent,
      progressStage: slots.length > 1 ? `generating_slot_${index + 1}_of_${slots.length}` : "generating",
      progressMessage:
        slots.length > 1
          ? `Generating session ${index + 1} of ${slots.length}`
          : "Generating lesson draft",
    });

    const checkpoint = request.providerCheckpoints.find((row) => row.slotDraftId === slot.slotDraftId);
    let rawBlocks: unknown[] | null = null;
    let usage = checkpoint?.usage;

    if (checkpoint?.raw && typeof checkpoint.raw === "object") {
      const raw = checkpoint.raw as { contentBlocks?: unknown[] };
      rawBlocks = Array.isArray(raw.contentBlocks) ? raw.contentBlocks : [checkpoint.raw];
    } else {
      const generated = await generateSessionContentBlocks({
        context,
        lessonNoteId: String(request.lessonNoteId),
        sessionId: request.sessionId ? String(request.sessionId) : null,
        slot,
        recordUsage: false,
      });
      if (!generated.ok) {
        request.slotResults = request.slotResults.map((row) =>
          row.slotDraftId === slot.slotDraftId
            ? { ...row, status: "failed", error: generated.error }
            : row
        );
        request.status = "failed";
        request.lastError = generated.error;
        await request.save();
        throw classifyAiProviderError(new Error(generated.error));
      }

      usage = generated.usage;
      rawBlocks = generated.contentBlocks;
      request.providerCheckpoints = [
        ...request.providerCheckpoints.filter((row) => row.slotDraftId !== slot.slotDraftId),
        {
          slotDraftId: slot.slotDraftId,
          raw: { contentBlocks: generated.contentBlocks },
          usage: generated.usage,
          usageRecorded: false,
        },
      ];
      await request.save();

      const { trackUsage } = await import("@/lib/billing/trackUsage");
      await trackUsage({
        schoolId: request.schoolId,
        provider: "openai",
        metricKey: "ai_calls",
        quantity: 1,
        unitLabel: "calls",
        allocationMethod: "direct",
        sourceType: "manual",
        notes: "Lesson background generation.",
      });
      await trackUsage({
        schoolId: request.schoolId,
        provider: "openai",
        metricKey: "total_tokens",
        quantity: Math.max(0, Number(usage?.totalTokens || 0)),
        unitLabel: "tokens",
        allocationMethod: "direct",
        sourceType: "manual",
        notes: "Lesson background generation tokens.",
      });
      request.providerCheckpoints = request.providerCheckpoints.map((row) =>
        row.slotDraftId === slot.slotDraftId ? { ...row, usageRecorded: true } : row
      );
      await request.save();
    }

    await tracked.updateProgress({
      progressPercent: 75,
      progressStage: "validating",
      progressMessage: "Validating lesson draft",
    });

    const contentBlocks = Array.isArray(rawBlocks) ? rawBlocks : [];
    const nextSlots = [...slots];
    if (index + 1 < nextSlots.length && contentBlocks.length > 0) {
      const handoff = {
        title: slot.title,
        focusSummary: slot.focusSummary || undefined,
        keyPointsSummary:
          summarizeContentBlocksForHandoff(
            contentBlocks as Parameters<typeof summarizeContentBlocksForHandoff>[0]
          ) ?? undefined,
      };
      const later = nextSlots[index + 1]!;
      later.priorSessions = [...(later.priorSessions ?? []), handoff];
      later.previousSession = handoff;
      request.slots = nextSlots;
    }

    request.slotResults = request.slotResults.map((row) =>
      row.slotDraftId === slot.slotDraftId
        ? {
            slotDraftId: slot.slotDraftId,
            status: "succeeded",
            contentBlocks: contentBlocks as ILessonAiGenerationRequest["slotResults"][number]["contentBlocks"],
            error: null,
            usageRecorded: true,
          }
        : row
    );
    await request.save();
  }

  await tracked.updateProgress({
    progressPercent: 85,
    progressStage: "saving_draft",
    progressMessage: "Saving draft",
  });

  if (request.sessionId) {
    const first = request.slotResults.find((row) => row.status === "succeeded");
    if (first?.contentBlocks?.length) {
      await LessonSession.updateOne(
        { _id: request.sessionId, schoolId: request.schoolId },
        {
          $set: {
            pendingAiContentBlocks: first.contentBlocks,
            "aiMetadata.leoGeneratedAt": new Date(),
          },
        }
      );
    }
  }

  request.status = "succeeded";
  request.lastError = null;
  await request.save();

  await tracked.updateProgress({
    progressPercent: 100,
    progressStage: "complete",
    progressMessage: "Lesson draft ready to review",
  });

  return {
    generationRequestId: String(request._id),
    sessionId: request.sessionId ? String(request.sessionId) : null,
    lessonNoteId: String(request.lessonNoteId),
    slotCount: request.slots.length,
    actionUrl: lessonGenerationActionUrl(request),
    notification: {
      title: "Lesson draft ready to review",
      body: "Your lesson draft is ready to review.",
      actionUrl: lessonGenerationActionUrl(request),
    },
  };
}
