import { getInngestClient } from "../inngest";
import { BACKGROUND_JOB_REQUESTED_EVENT } from "../events";
import { finalizeFailedBackgroundJob, runTrackedBackgroundJob } from "../worker-wrapper";
import { getBackgroundRetryPolicy, inngestRetriesForPolicy } from "../retry-policies";
import { IMPORT_INNGEST_CONCURRENCY } from "../operational-concurrency";
import { executeSchemeImportParse } from "@/lib/schemes/execute-scheme-import-parse";
import { SchemeImportJob } from "@/models/SchemeImportJob";

const KIND = "SCHEME_IMPORT" as const;

export function createSchemeImportBackgroundJobFunction() {
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
      id: "scheme-import",
      retries,
      triggers: [{ event: BACKGROUND_JOB_REQUESTED_EVENT }],
      concurrency: [...IMPORT_INNGEST_CONCURRENCY],
      onFailure: async ({ event, error }) => {
        const original = event.data.event.data as { jobId?: string } | undefined;
        if (original?.jobId) {
          await finalizeFailedBackgroundJob(original.jobId, error);
          const requestId = await loadSchemeImportJobId(original.jobId);
          if (requestId) {
            await SchemeImportJob.updateOne(
              { _id: requestId, status: { $in: ["queued", "parsing"] } },
              {
                $set: {
                  status: "failed",
                  parseError:
                    error instanceof Error ? error.message.slice(0, 4000) : "Scheme parse failed",
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
      return step.run("run-scheme-import", async () => {
        const result = await runTrackedBackgroundJob({
          jobId: data.jobId,
          expectedKind: KIND,
          eventSchoolId: data.schoolId,
          inngestRunId: runId,
          handler: executeSchemeImportParse,
        });
        return { outcome: result.outcome, jobId: String(result.job._id) };
      });
    }
  );
}

async function loadSchemeImportJobId(jobId: string) {
  const { BackgroundJob } = await import("@/models/BackgroundJob");
  const job = await BackgroundJob.findById(jobId)
    .select("input")
    .lean<{ input?: { schemeImportJobId?: unknown } } | null>();
  return typeof job?.input?.schemeImportJobId === "string" ? job.input.schemeImportJobId : null;
}
