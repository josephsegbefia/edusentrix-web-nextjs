import { getInngestClient } from "../inngest";
import { BACKGROUND_JOB_REQUESTED_EVENT } from "../events";
import { finalizeFailedBackgroundJob, runTrackedBackgroundJob } from "../worker-wrapper";
import { getBackgroundRetryPolicy, inngestRetriesForPolicy } from "../retry-policies";
import { AI_INNGEST_CONCURRENCY } from "../ai-concurrency";
import { executeExploreGeneration } from "@/lib/learn/explore/execute-explore-generation";
import { ExploreGenerationJob } from "@/models/ExploreGenerationJob";
import { BackgroundJob } from "@/models/BackgroundJob";

const KIND = "EXPLORE_GENERATION" as const;

export function createExploreGenerationBackgroundJobFunction() {
  const inngest = getInngestClient();
  const retries = inngestRetriesForPolicy(getBackgroundRetryPolicy("AI")) as 0 | 1 | 2 | 3 | 4 | 5;

  return inngest.createFunction(
    {
      id: "explore-generation",
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
          .lean<{ input?: { exploreGenerationJobId?: unknown } } | null>();
        const exploreId =
          typeof job?.input?.exploreGenerationJobId === "string"
            ? job.input.exploreGenerationJobId
            : null;
        if (exploreId) {
          await ExploreGenerationJob.updateOne(
            { _id: exploreId, status: { $nin: ["ready"] } },
            {
              $set: {
                status: "failed",
                errorCode: "BACKGROUND_JOB_FAILED",
                errorMessage: error instanceof Error ? error.message : "Explore generation failed",
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
      return step.run("run-explore-generation", async () => {
        const result = await runTrackedBackgroundJob({
          jobId: data.jobId,
          expectedKind: KIND,
          eventSchoolId: data.schoolId,
          inngestRunId: runId,
          handler: executeExploreGeneration,
        });
        return { outcome: result.outcome, jobId: String(result.job._id) };
      });
    }
  );
}
