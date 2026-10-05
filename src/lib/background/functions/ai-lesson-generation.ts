import { getInngestClient } from "../inngest";
import { BACKGROUND_JOB_REQUESTED_EVENT } from "../events";
import { finalizeFailedBackgroundJob, runTrackedBackgroundJob } from "../worker-wrapper";
import { getBackgroundRetryPolicy, inngestRetriesForPolicy } from "../retry-policies";
import { AI_INNGEST_CONCURRENCY } from "../ai-concurrency";
import { executeLessonAiGeneration } from "@/lib/lessons/execute-lesson-generation";
import { LessonAiGenerationRequest } from "@/models/LessonAiGenerationRequest";

const KIND = "AI_LESSON_GENERATION" as const;

export function createAiLessonGenerationBackgroundJobFunction() {
  const inngest = getInngestClient();
  const retries = inngestRetriesForPolicy(getBackgroundRetryPolicy("AI")) as 0 | 1 | 2 | 3 | 4 | 5;

  return inngest.createFunction(
    {
      id: "ai-lesson-generation",
      retries,
      triggers: [{ event: BACKGROUND_JOB_REQUESTED_EVENT }],
      concurrency: [...AI_INNGEST_CONCURRENCY],
      onFailure: async ({ event, error }) => {
        const original = event.data.event.data as { jobId?: string } | undefined;
        const jobId = original?.jobId;
        if (jobId) {
          await finalizeFailedBackgroundJob(jobId, error);
          const requestId = await loadGenerationRequestId(jobId);
          if (requestId) {
            await LessonAiGenerationRequest.updateOne(
              { _id: requestId, status: { $nin: ["succeeded"] } },
              { $set: { status: "failed", lastError: error instanceof Error ? error.message : "Generation failed" } }
            );
          }
        }
      },
    },
    async ({ event, runId, step }) => {
      const data = event.data as { jobId: string; kind: string; schoolId?: string };
      if (data.kind !== KIND) {
        return { skipped: true, reason: "kind_mismatch" };
      }

      return step.run("run-ai-lesson-generation", async () => {
        const result = await runTrackedBackgroundJob({
          jobId: data.jobId,
          expectedKind: KIND,
          eventSchoolId: data.schoolId,
          inngestRunId: runId,
          handler: executeLessonAiGeneration,
        });
        return { outcome: result.outcome, jobId: String(result.job._id) };
      });
    }
  );
}

async function loadGenerationRequestId(jobId: string) {
  const { BackgroundJob } = await import("@/models/BackgroundJob");
  const job = await BackgroundJob.findById(jobId)
    .select("input")
    .lean<{ input?: { generationRequestId?: unknown } } | null>();
  return typeof job?.input?.generationRequestId === "string" ? job.input.generationRequestId : null;
}
