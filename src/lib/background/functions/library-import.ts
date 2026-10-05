import { getInngestClient } from "../inngest";
import { BACKGROUND_JOB_REQUESTED_EVENT } from "../events";
import { finalizeFailedBackgroundJob, runTrackedBackgroundJob } from "../worker-wrapper";
import { getBackgroundRetryPolicy, inngestRetriesForPolicy } from "../retry-policies";
import { IMPORT_INNGEST_CONCURRENCY } from "../operational-concurrency";
import { executeLibraryImportBackground } from "@/lib/library/execute-library-import";

const KIND = "LIBRARY_IMPORT" as const;

export function createLibraryImportBackgroundJobFunction() {
  const inngest = getInngestClient();
  const retries = inngestRetriesForPolicy(getBackgroundRetryPolicy("IMPORT")) as
    | 0
    | 1
    | 2
    | 3
    | 4
    | 5;

  return inngest.createFunction(
    {
      id: "library-import",
      retries,
      triggers: [{ event: BACKGROUND_JOB_REQUESTED_EVENT }],
      concurrency: [...IMPORT_INNGEST_CONCURRENCY],
      onFailure: async ({ event, error }) => {
        const original = event.data.event.data as { jobId?: string } | undefined;
        if (original?.jobId) await finalizeFailedBackgroundJob(original.jobId, error);
      },
    },
    async ({ event, runId, step }) => {
      const data = event.data as { jobId: string; kind: string; schoolId?: string };
      if (data.kind !== KIND) return { skipped: true, reason: "kind_mismatch" };
      return step.run("run-library-import", async () => {
        const result = await runTrackedBackgroundJob({
          jobId: data.jobId,
          expectedKind: KIND,
          eventSchoolId: data.schoolId,
          inngestRunId: runId,
          handler: executeLibraryImportBackground,
        });
        return { outcome: result.outcome, jobId: String(result.job._id) };
      });
    }
  );
}
