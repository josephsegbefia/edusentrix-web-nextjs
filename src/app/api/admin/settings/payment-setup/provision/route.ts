import { NextResponse } from "next/server";
import { enqueueSchoolPaymentProvisioning } from "@/lib/jobs/payment-provisioning";
import {
  markPaystackSubaccountJobsDoneForSchool,
  provisionPaystackSubaccountForSchool,
} from "@/lib/jobs/provisioning";
import { requirePaymentSetupAccess } from "@/lib/auth/requirePaymentSetupAccess";
import { hasCompleteSchoolBankDetails } from "@/lib/school-payments/payment-setup";
import { School, type ISchool } from "@/models/School";
import { ProvisioningJob } from "@/models/ProvisioningJob";

type ProvisioningJobRow = {
  status: "pending" | "running" | "failed" | "done";
  attempts: number;
  lastError?: string | null;
  nextRunAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

async function loadLatestProvisioningJob(schoolId: string) {
  return ProvisioningJob.findOne({
    schoolId,
    kind: "paystack_subaccount",
  })
    .sort({ updatedAt: -1 })
    .lean<ProvisioningJobRow | null>();
}

export async function POST() {
  try {
    const access = await requirePaymentSetupAccess();
    if (!access.capabilities.canManage) {
      return NextResponse.json(
        {
          success: false,
          error: "Only the current billing owner or active setup controller can start payment setup.",
        },
        { status: 403 }
      );
    }
    if (access.shouldBindOwnerUserId || access.shouldBindDelegateUserId) {
      await School.findByIdAndUpdate(access.schoolId, {
        $set: {
          ...(access.shouldBindOwnerUserId
            ? {
                "billing.paymentSetup.ownerUserId": access.userId,
                "billing.paymentSetup.ownerName": access.userName || access.userEmail,
                "billing.paymentSetup.ownerEmail": access.userEmail.toLowerCase().trim(),
                "billing.paymentSetup.ownerAssignedAt": new Date(),
              }
            : {}),
          ...(access.shouldBindDelegateUserId
            ? {
                "billing.paymentSetup.delegateUserId": access.userId,
                "billing.paymentSetup.delegateName": access.userName || access.userEmail,
                "billing.paymentSetup.delegateEmail":
                  access.userEmail.toLowerCase().trim(),
                "billing.paymentSetup.delegateAssignedAt": new Date(),
              }
            : {}),
          "billing.paymentSetup.lastUpdatedAt": new Date(),
          "billing.paymentSetup.lastUpdatedBy": access.userId,
        },
      });
    }
    const school = await School.findById(access.schoolId)
      .select("bank billing")
      .lean<Pick<ISchool, "bank" | "billing"> | null>();

    if (!school) {
      return NextResponse.json(
        { success: false, error: "School not found" },
        { status: 404 }
      );
    }

    if (!hasCompleteSchoolBankDetails(school)) {
      return NextResponse.json(
        {
          success: false,
          error: "Complete payout details are required before setup can start.",
        },
        { status: 409 }
      );
    }

    if (school.billing?.paymentSetup?.status === "review_required") {
      return NextResponse.json(
        {
          success: false,
          error:
            school.billing?.paymentSetup?.reviewReason ||
            "This payout setup needs manual review before it can be submitted.",
        },
        { status: 409 }
      );
    }

    try {
      await provisionPaystackSubaccountForSchool({
        schoolId: access.schoolId,
        lastUpdatedBy: access.userId,
      });
      await markPaystackSubaccountJobsDoneForSchool(access.schoolId);
    } catch (syncError) {
      const message =
        syncError instanceof Error ? syncError.message : String(syncError);
      if (message === "School not found") {
        return NextResponse.json(
          { success: false, error: "School not found" },
          { status: 404 }
        );
      }

      await enqueueSchoolPaymentProvisioning({
        schoolId: access.schoolId,
        requestedBy: access.userId,
        queueAfterSyncFailureMessage: message,
      });

      const latestJob = await loadLatestProvisioningJob(String(access.schoolId));

      return NextResponse.json({
        success: true,
        data: {
          status: "pending_provisioning" as const,
          mode: "async_fallback" as const,
          syncAttemptError: message,
          jobStatus: latestJob?.status || "pending",
          attempts: latestJob?.attempts || 0,
        },
      });
    }

    const latestJob = await loadLatestProvisioningJob(String(access.schoolId));

    return NextResponse.json({
      success: true,
      data: {
        status: "provisioned" as const,
        mode: "sync" as const,
        jobStatus: latestJob?.status || "done",
        attempts: latestJob?.attempts || 0,
      },
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error("Failed to queue school payment provisioning:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to start payment setup",
      },
      { status: 500 }
    );
  }
}
