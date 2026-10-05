import { BackgroundJob } from "@/models/BackgroundJob";
import { getInngestClient } from "../inngest";
import { BACKGROUND_JOB_REQUESTED_EVENT } from "../events";
import { finalizeFailedBackgroundJob, runTrackedBackgroundJob } from "../worker-wrapper";
import { getBackgroundRetryPolicy, inngestRetriesForPolicy } from "../retry-policies";
import {
  dispatchOutboundEmailMessage,
  markEmailMessageDispatchFailed,
} from "@/lib/email/dispatch-outbound-message";

const EMAIL_KIND = "EMAIL_DISPATCH" as const;

async function markEmailFailedFromJob(jobId: string | undefined, error: unknown) {
  if (!jobId) return;
  const job = await BackgroundJob.findById(jobId)
    .select("input")
    .lean<{ input?: { emailMessageId?: unknown } } | null>();
  const emailMessageId =
    typeof job?.input?.emailMessageId === "string" ? job.input.emailMessageId : null;
  if (emailMessageId) {
    await markEmailMessageDispatchFailed({ emailMessageId, error });
  }
}

export function createEmailDispatchBackgroundJobFunction() {
  const inngest = getInngestClient();
  const retries = inngestRetriesForPolicy(
    getBackgroundRetryPolicy("EMAIL")
  ) as 0 | 1 | 2 | 3 | 4 | 5;

  return inngest.createFunction(
    {
      id: "email-dispatch",
      retries,
      triggers: [{ event: BACKGROUND_JOB_REQUESTED_EVENT }],
      concurrency: { limit: 5 },
      onFailure: async ({ event, error }) => {
        const original = event.data.event.data as { jobId?: string } | undefined;
        const jobId = original?.jobId;
        if (jobId) {
          await finalizeFailedBackgroundJob(jobId, error);
          await markEmailFailedFromJob(jobId, error);
        }
      },
    },
    async ({ event, runId, step }) => {
      const data = event.data as {
        jobId: string;
        kind: string;
        schoolId?: string;
      };
      if (data.kind !== EMAIL_KIND) {
        return { skipped: true, reason: "kind_mismatch" };
      }

      return step.run("run-email-dispatch", async () => {
        const result = await runTrackedBackgroundJob({
          jobId: data.jobId,
          expectedKind: EMAIL_KIND,
          eventSchoolId: data.schoolId,
          inngestRunId: runId,
          handler: async ({ job }) => {
            const emailMessageId =
              typeof job.input?.emailMessageId === "string"
                ? job.input.emailMessageId
                : null;
            if (!emailMessageId) {
              const { BackgroundJobError } = await import("../errors");
              throw new BackgroundJobError({
                message: "EMAIL_DISPATCH input.emailMessageId is required",
                category: "PERMANENT",
                code: "EMAIL_MESSAGE_ID_REQUIRED",
              });
            }
            const dispatched = await dispatchOutboundEmailMessage({
              emailMessageId,
              expectedSchoolId: job.schoolId ? String(job.schoolId) : null,
            });
            return {
              outcome: dispatched.outcome,
              providerAccepted: dispatched.outcome === "sent",
            };
          },
        });
        return { outcome: result.outcome, jobId: String(result.job._id) };
      });
    }
  );
}
