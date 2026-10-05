import "server-only";

import mongoose from "mongoose";
import type { TrackedJobContext } from "@/lib/background/worker-wrapper";
import {
  classifyAiProviderError,
  lessonGenerationPrerequisiteError,
} from "@/lib/background/ai-errors";
import { generateLessonIllustrationDraft } from "@/lib/leo/generate-lesson-illustration";
import { LessonIllustrationRequest } from "@/models/LessonIllustrationRequest";

export async function executeLessonIllustration(
  tracked: TrackedJobContext
): Promise<Record<string, unknown>> {
  const illustrationRequestId =
    typeof tracked.job.input?.illustrationRequestId === "string"
      ? tracked.job.input.illustrationRequestId
      : null;
  if (!illustrationRequestId || !mongoose.Types.ObjectId.isValid(illustrationRequestId)) {
    throw lessonGenerationPrerequisiteError("illustrationRequestId is required");
  }

  const request = await LessonIllustrationRequest.findById(illustrationRequestId);
  if (!request) {
    throw lessonGenerationPrerequisiteError("Illustration request not found");
  }
  if (String(request.schoolId) !== String(tracked.job.schoolId)) {
    throw lessonGenerationPrerequisiteError("Illustration tenant mismatch");
  }

  request.status = "running";
  await request.save();
  await tracked.updateProgress({
    progressPercent: 10,
    progressStage: "preparing_context",
    progressMessage: "Planning illustration",
  });
  await tracked.throwIfCancellationRequested();

  if (request.imageUrl && request.storageKey) {
    request.status = "succeeded";
    await request.save();
    return {
      illustrationRequestId: String(request._id),
      storageKey: request.storageKey,
      imageUrl: request.imageUrl,
      notification: {
        title: "Illustration draft ready",
        body: "Your illustration draft is ready to review.",
      },
    };
  }

  await tracked.updateProgress({
    progressPercent: 30,
    progressStage: "generating",
    progressMessage: "Generating illustration",
  });

  const result = await generateLessonIllustrationDraft({
    schoolId: request.schoolId,
    prompt: request.prompt ?? undefined,
    fact: request.fact ?? undefined,
    detail: request.detail ?? undefined,
    sessionTitle: request.sessionTitle ?? undefined,
    recordUsage: !request.usageRecorded,
  });

  if (!result.ok) {
    request.status = "failed";
    request.lastError = result.error;
    await request.save();
    throw classifyAiProviderError(new Error(result.error));
  }

  request.imageUrl = result.imageUrl;
  request.storageKey = result.uploadThingKey;
  request.generationPrompt = result.generationPrompt;
  request.usageRecorded = true;
  request.status = "succeeded";
  request.lastError = null;
  await request.save();

  await tracked.updateProgress({
    progressPercent: 100,
    progressStage: "complete",
    progressMessage: "Illustration draft ready",
  });

  return {
    illustrationRequestId: String(request._id),
    storageKey: result.uploadThingKey,
    imageUrl: result.imageUrl,
    notification: {
      title: "Illustration draft ready",
      body: "Your illustration draft is ready to review.",
    },
  };
}
