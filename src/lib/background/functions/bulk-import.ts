import { getInngestClient } from "../inngest";
import { BACKGROUND_JOB_REQUESTED_EVENT } from "../events";
import { finalizeFailedBackgroundJob, runTrackedBackgroundJob } from "../worker-wrapper";
import { getBackgroundRetryPolicy, inngestRetriesForPolicy } from "../retry-policies";
import { IMPORT_INNGEST_CONCURRENCY } from "../operational-concurrency";
import { executeBulkImport } from "@/lib/imports/execute-bulk-import";
import { TeacherImportJob } from "@/models/TeacherImportJob";
import { StudentImportJob } from "@/models/StudentImportJob";
import { resolveBulkImportRouting } from "@/lib/imports/bulk-import-routing";
import { quarantineLegacyBulkImport } from "@/lib/imports/legacy-bulk-import-quarantine";

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
          const backgroundJob = await loadBulkImportBackgroundJob(original.jobId);
          if (!backgroundJob) return;
          const routing = resolveBulkImportRouting(backgroundJob);
          if (!routing.ok) return;
          if (routing.routing.kind === "teacher_staged") {
            await TeacherImportJob.updateOne(
              {
                _id: routing.routing.importJobId,
                status: {
                  $in:
                    routing.routing.phase === "analysis"
                      ? ["uploaded", "analyzing"]
                      : ["committing"],
                },
              },
              {
                $set: {
                  status: "failed",
                  analysisErrors: [
                    {
                      code: "background_failed",
                      message:
                        error instanceof Error ? error.message.slice(0, 1000) : "Teacher import failed",
                    },
                  ],
                },
              }
            );
          }
          if (routing.routing.kind === "student_staged") {
            await StudentImportJob.updateOne(
              {
                _id: routing.routing.importJobId,
                status: {
                  $in:
                    routing.routing.phase === "analysis"
                      ? ["uploaded", "analyzing"]
                      : ["committing"],
                },
              },
              {
                $set: {
                  status: "failed",
                  analysisErrors: [
                    {
                      code: "background_failed",
                      message:
                        error instanceof Error ? error.message.slice(0, 1000) : "Student import failed",
                    },
                  ],
                },
              }
            );
          }
          if (routing.routing.kind === "legacy" && backgroundJob.schoolId) {
            await quarantineLegacyBulkImport({
              bulkImportJobId: routing.routing.importJobId,
              schoolId: backgroundJob.schoolId,
            });
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

async function loadBulkImportBackgroundJob(jobId: string) {
  const { BackgroundJob } = await import("@/models/BackgroundJob");
  return BackgroundJob.findById(jobId)
    .select("subjectType subjectId schoolId input")
    .lean();
}
