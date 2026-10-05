import { getInngestClient } from "../inngest";
import { BACKGROUND_JOB_REQUESTED_EVENT } from "../events";
import { finalizeFailedBackgroundJob, runTrackedBackgroundJob } from "../worker-wrapper";
import { getBackgroundRetryPolicy, inngestRetriesForPolicy } from "../retry-policies";
import { IMPORT_INNGEST_CONCURRENCY } from "../operational-concurrency";
import { executeBulkImport } from "@/lib/imports/execute-bulk-import";
import { BulkImportJob } from "@/models/BulkImportJob";

const KIND = "BULK_IMPORT" as const;

export function createBulkImportBackgroundJobFunction() {
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
      id: "bulk-import",
      retries,
      triggers: [{ event: BACKGROUND_JOB_REQUESTED_EVENT }],
      concurrency: [...IMPORT_INNGEST_CONCURRENCY],
      onFailure: async ({ event, error }) => {
        const original = event.data.event.data as { jobId?: string } | undefined;
        if (original?.jobId) {
          await finalizeFailedBackgroundJob(original.jobId, error);
          const requestId = await loadBulkImportJobId(original.jobId);
          if (requestId) {
            await BulkImportJob.updateOne(
              { _id: requestId, status: { $in: ["pending", "processing"] } },
              {
                $set: {
                  status: "failed",
                  rowErrors: [
                    {
                      row: 0,
                      message:
                        error instanceof Error ? error.message.slice(0, 500) : "Bulk import failed",
                    },
                  ],
                },
              }
            );
          }
        }
      },
    },
    async ({ event, runId, step }) => {
      const data = event.data as { jobId: string; kind: string; schoolId?: string };
      if (data.kind !== KIND) return { skipped: true, reason: "kind_mismatch" };
      return step.run("run-bulk-import", async () => {
        const result = await runTrackedBackgroundJob({
          jobId: data.jobId,
          expectedKind: KIND,
          eventSchoolId: data.schoolId,
          inngestRunId: runId,
          handler: executeBulkImport,
        });
        return { outcome: result.outcome, jobId: String(result.job._id) };
      });
    }
  );
}

async function loadBulkImportJobId(jobId: string) {
  const { BackgroundJob } = await import("@/models/BackgroundJob");
  const job = await BackgroundJob.findById(jobId)
    .select("input")
    .lean<{ input?: { bulkImportJobId?: unknown } } | null>();
  return typeof job?.input?.bulkImportJobId === "string" ? job.input.bulkImportJobId : null;
}
