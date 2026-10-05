import { getInngestClient } from "../inngest";
import { BACKGROUND_JOB_REQUESTED_EVENT } from "../events";
import { finalizeFailedBackgroundJob, runTrackedBackgroundJob } from "../worker-wrapper";
import { getBackgroundRetryPolicy, inngestRetriesForPolicy } from "../retry-policies";
import { PROVISIONING_INNGEST_CONCURRENCY } from "../operational-concurrency";
import { executeSchoolProvisioning } from "@/lib/jobs/execute-school-provisioning";

const KIND = "SCHOOL_PROVISIONING" as const;

export function createSchoolProvisioningBackgroundJobFunction() {
  const inngest = getInngestClient();
  const retries = inngestRetriesForPolicy(getBackgroundRetryPolicy("PROVISIONING")) as
    | 0
    | 1
    | 2
    | 3
    | 4
    | 5;

  return inngest.createFunction(
    {
      id: "school-provisioning",
      retries,
      triggers: [{ event: BACKGROUND_JOB_REQUESTED_EVENT }],
      concurrency: [...PROVISIONING_INNGEST_CONCURRENCY],
      onFailure: async ({ event, error }) => {
        const original = event.data.event.data as { jobId?: string } | undefined;
        if (original?.jobId) await finalizeFailedBackgroundJob(original.jobId, error);
      },
    },
    async ({ event, runId, step }) => {
      const data = event.data as { jobId: string; kind: string; schoolId?: string };
      if (data.kind !== KIND) return { skipped: true, reason: "kind_mismatch" };
      return step.run("run-school-provisioning", async () => {
        const result = await runTrackedBackgroundJob({
          jobId: data.jobId,
          expectedKind: KIND,
          eventSchoolId: data.schoolId,
          inngestRunId: runId,
          handler: executeSchoolProvisioning,
        });
        return { outcome: result.outcome, jobId: String(result.job._id) };
      });
    }
  );
}
