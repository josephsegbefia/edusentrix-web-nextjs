import "server-only";

import mongoose from "mongoose";
import { BackgroundJobError } from "@/lib/background/errors";
import type { TrackedJobContext } from "@/lib/background/worker-wrapper";
import { schoolProvisioningActionUrl } from "@/lib/jobs/enqueue-school-provisioning";
import { provisionPaystackSubaccountForSchool } from "@/lib/jobs/provisioning";
import { isLikelyPaystackSubaccountCode } from "@/lib/school-payments/paystack-subaccount-code";
import { splitPublicAndDetailError } from "@/lib/school-payments/provision-error";
import { ProvisioningJob } from "@/models/ProvisioningJob";
import { School } from "@/models/School";

export async function executeSchoolProvisioning(
  tracked: TrackedJobContext
): Promise<Record<string, unknown>> {
  const provisioningJobId =
    typeof tracked.job.input?.provisioningJobId === "string"
      ? tracked.job.input.provisioningJobId
      : null;
  if (!provisioningJobId || !mongoose.Types.ObjectId.isValid(provisioningJobId)) {
    throw new BackgroundJobError({
      message: "provisioningJobId is required",
      category: "PREREQUISITE_FAILED",
    });
  }

  const domain = await ProvisioningJob.findById(provisioningJobId);
  if (!domain) {
    throw new BackgroundJobError({
      message: "Provisioning job not found",
      category: "PREREQUISITE_FAILED",
    });
  }
  if (String(domain.schoolId) !== String(tracked.job.schoolId)) {
    throw new BackgroundJobError({
      message: "Provisioning tenant mismatch",
      category: "PREREQUISITE_FAILED",
    });
  }

  const school = await School.findById(domain.schoolId);
  if (!school) {
    domain.status = "done";
    domain.lastError = "School not found";
    await domain.save();
    throw new BackgroundJobError({
      message: "School not found",
      category: "PREREQUISITE_FAILED",
    });
  }

  if (domain.status === "done" || isLikelyPaystackSubaccountCode(school.billing?.paystack?.subaccountCode)) {
    domain.status = "done";
    domain.lastError = null;
    await domain.save();
    return {
      provisioningJobId,
      alreadyProvisioned: true,
      notification: {
        title: "Payment provisioning completed",
        body: "School payment provisioning completed.",
        actionUrl: schoolProvisioningActionUrl(),
      },
    };
  }

  domain.status = "running";
  domain.lastError = null;
  domain.nextRunAt = null;
  domain.attempts = (domain.attempts ?? 0) + 1;
  await domain.save();

  try {
    await provisionPaystackSubaccountForSchool({
      schoolId: domain.schoolId,
      lastUpdatedBy: tracked.job.initiatedByUserId,
    });
    domain.status = "done";
    domain.lastError = null;
    await domain.save();
    return {
      provisioningJobId,
      alreadyProvisioned: false,
      notification: {
        title: "Payment provisioning completed",
        body: "School payment provisioning completed.",
        actionUrl: schoolProvisioningActionUrl(),
      },
    };
  } catch (error) {
    const { publicMessage, detail } = splitPublicAndDetailError(error);
    domain.status = "failed";
    domain.lastError = publicMessage;
    await domain.save();
    await School.findByIdAndUpdate(domain.schoolId, {
      $set: {
        "billing.status": "failed",
        "billing.paymentSetup.status": "failed",
        "billing.paystack.lastError": publicMessage,
        "billing.paystack.lastErrorDetail": detail,
        "billing.paystack.lastErrorAt": new Date(),
        "billing.paymentSetup.lastUpdatedAt": new Date(),
      },
    });
    throw new BackgroundJobError({
      message: publicMessage,
      category: /missing account|bank/i.test(publicMessage) ? "PERMANENT" : "RETRYABLE",
    });
  }
}
