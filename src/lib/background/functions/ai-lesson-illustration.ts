import { getInngestClient } from "../inngest";
import { BACKGROUND_JOB_REQUESTED_EVENT } from "../events";
import { finalizeFailedBackgroundJob, runTrackedBackgroundJob } from "../worker-wrapper";
import { getBackgroundRetryPolicy, inngestRetriesForPolicy } from "../retry-policies";
import { AI_INNGEST_CONCURRENCY } from "../ai-concurrency";
import { executeLessonIllustration } from "@/lib/lessons/execute-lesson-illustration";
import { LessonIllustrationRequest } from "@/models/LessonIllustrationRequest";
import { BackgroundJob } from "@/models/BackgroundJob";

const KIND = "AI_LESSON_ILLUSTRATION" as const;

export function createAiLessonIllustrationBackgroundJobFunction() {
  const inngest = getInngestClient();
  const retries = inngestRetriesForPolicy(getBackgroundRetryPolicy("AI")) as 0 | 1 | 2 | 3 | 4 | 5;

  return inngest.createFunction(
    {
      id: "ai-lesson-illustration",
      retries,
      triggers: [{ event: BACKGROUND_JOB_REQUESTED_EVENT }],
      concurrency: [...AI_INNGEST_CONCURRENCY],
      onFailure: async ({ event, error }) => {
        const original = event.data.event.data as { jobId?: string } | undefined;
        const jobId = original?.jobId;
        if (!jobId) return;
        await finalizeFailedBackgroundJob(jobId, error);
        const job = await BackgroundJob.findById(jobId)
          .select("input")
          .lean<{ input?: { illustrationRequestId?: unknown } } | null>();
        const requestId =
          typeof job?.input?.illustrationRequestId === "string"
            ? job.input.illustrationRequestId
            : null;
        if (requestId) {
          await LessonIllustrationRequest.updateOne(
            { _id: requestId, status: { $nin: ["succeeded"] } },
            {
              $set: {
                status: "failed",
                lastError: error instanceof Error ? error.message : "Illustration failed",
              },
            }
          );
        }
      },
    },
    async ({ event, runId, step }) => {
      const data = event.data as { jobId: string; kind: string; schoolId?: string };
      if (data.kind !== KIND) {
        return { skipped: true, reason: "kind_mismatch" };
      }
      return step.run("run-ai-lesson-illustration", async () => {
        const result = await runTrackedBackgroundJob({
          jobId: data.jobId,
          expectedKind: KIND,
          eventSchoolId: data.schoolId,
          inngestRunId: runId,
          handler: executeLessonIllustration,
        });
        return { outcome: result.outcome, jobId: String(result.job._id) };
      });
    }
  );
}
