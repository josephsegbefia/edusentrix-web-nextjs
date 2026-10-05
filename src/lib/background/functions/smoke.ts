import { getInngestClient } from "../inngest";
import { BACKGROUND_JOB_REQUESTED_EVENT } from "../events";
import { finalizeFailedBackgroundJob, runTrackedBackgroundJob } from "../worker-wrapper";
import { getBackgroundRetryPolicy, inngestRetriesForPolicy } from "../retry-policies";

const SMOKE_KIND = "SYSTEM_BACKGROUND_SMOKE" as const;

export function createSmokeBackgroundJobFunction() {
  const inngest = getInngestClient();
  const retries = inngestRetriesForPolicy(
    getBackgroundRetryPolicy("SYSTEM")
  ) as 0 | 1 | 2 | 3 | 4 | 5;

  return inngest.createFunction(
    {
      id: "system-background-smoke",
      retries,
      triggers: [{ event: BACKGROUND_JOB_REQUESTED_EVENT }],
      onFailure: async ({ event, error }) => {
        const original = event.data.event.data as { jobId?: string } | undefined;
        const jobId = original?.jobId;
        if (jobId) {
          await finalizeFailedBackgroundJob(jobId, error);
        }
      },
    },
    async ({ event, runId, step }) => {
      const data = event.data as {
        jobId: string;
        kind: string;
        schoolId?: string;
      };
      if (data.kind !== SMOKE_KIND) {
        return { skipped: true, reason: "kind_mismatch" };
      }

      return step.run("run-smoke-job", async () => {
        const result = await runTrackedBackgroundJob({
          jobId: data.jobId,
          expectedKind: SMOKE_KIND,
          eventSchoolId: data.schoolId,
          inngestRunId: runId,
          handler: async ({ updateProgress }) => {
            await updateProgress({
              progressPercent: 10,
              progressStage: "start",
              progressMessage: "Smoke job started",
            });
            await updateProgress({
              progressPercent: 50,
              progressStage: "halfway",
              progressMessage: "Smoke job halfway",
            });
            await updateProgress({
              progressPercent: 100,
              progressStage: "done",
              progressMessage: "Smoke job finished",
            });
            return { ok: true };
          },
        });
        return { outcome: result.outcome, jobId: String(result.job._id) };
      });
    }
  );
}
