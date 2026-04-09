import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveBankCode } from "@/lib/banks/banks";
import { requirePaymentSetupAccess } from "@/lib/auth/requirePaymentSetupAccess";
import { maskAccountNumber } from "@/lib/platform-billing/payout-security";
import { getPaystackKeyMode } from "@/lib/paystack";
import {
  assessSchoolPaymentSetupReview,
  deriveSchoolPaymentSetupStatus,
  getMissingBankFields,
  getSchoolPaymentSetupMeta,
  hasCompleteSchoolBankDetails,
  isSchoolPaymentReady,
} from "@/lib/school-payments/payment-setup";
import { Invitation } from "@/models/Invitation";
import { ProvisioningJob } from "@/models/ProvisioningJob";
import { School, type ISchool } from "@/models/School";

const UpdatePaymentSetupSchema = z.object({
  bankName: z.string().trim().min(1, "Bank is required"),
  branchName: z.string().trim().min(1, "Branch is required"),
  accountName: z.string().trim().min(2, "Account name is required"),
  accountNumber: z
    .string()
    .trim()
    .min(6, "Account number is required")
    .max(32, "Account number is too long"),
});

type ProvisioningJobRow = {
  status: "pending" | "running" | "failed" | "done";
  attempts: number;
  lastError?: string | null;
  nextRunAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type PaymentSetupSchoolRow = Pick<
  ISchool,
  "_id" | "name" | "createdBy" | "bank" | "billing"
>;

type PendingInvitationRow = {
  _id: string;
  email: string;
  role: "billing_owner" | "bursar";
  sentAt: Date;
  expiresAt: Date;
  metadata?: {
    firstName?: string;
    lastName?: string;
    accessSurface?: string;
    paymentAuthorityMode?: string;
  } | null;
};

async function loadLatestProvisioningJob(schoolId: string) {
  return ProvisioningJob.findOne({
    schoolId,
    kind: "paystack_subaccount",
  })
    .sort({ updatedAt: -1 })
    .lean<ProvisioningJobRow | null>();
}

async function loadSchoolPaymentSetup(schoolId: string) {
  return School.findById(schoolId)
    .select("name createdBy bank billing")
    .lean<PaymentSetupSchoolRow | null>();
}

async function loadPendingInvitations(schoolId: string) {
  const [ownerInvite, delegateInvite] = await Promise.all([
    Invitation.findOne({
      schoolId,
      role: "billing_owner",
      status: "pending",
      expiresAt: { $gt: new Date() },
    })
      .sort({ sentAt: -1 })
      .lean<PendingInvitationRow | null>(),
    Invitation.findOne({
      schoolId,
      role: "bursar",
      status: "pending",
      expiresAt: { $gt: new Date() },
      "metadata.accessSurface": "payment_setup_delegate",
    })
      .sort({ sentAt: -1 })
      .lean<PendingInvitationRow | null>(),
  ]);

  return { ownerInvite, delegateInvite };
}

async function bindAssignmentsIfNeeded(input: {
  schoolId: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  shouldBindOwnerUserId: boolean;
  shouldBindDelegateUserId: boolean;
}) {
  if (!input.shouldBindOwnerUserId && !input.shouldBindDelegateUserId) return;

  const now = new Date();
  const updates: Record<string, string | Date> = {
    "billing.paymentSetup.lastUpdatedAt": now,
    "billing.paymentSetup.lastUpdatedBy": input.userId,
  };

  if (input.shouldBindOwnerUserId) {
    updates["billing.paymentSetup.ownerUserId"] = input.userId;
    updates["billing.paymentSetup.ownerName"] = input.userName || input.userEmail;
    updates["billing.paymentSetup.ownerEmail"] = input.userEmail.toLowerCase().trim();
    updates["billing.paymentSetup.ownerAssignedAt"] = now;
  }

  await School.findByIdAndUpdate(input.schoolId, {
    $set: {
      ...updates,
      ...(input.shouldBindDelegateUserId
        ? {
            "billing.paymentSetup.delegateUserId": input.userId,
            "billing.paymentSetup.delegateName": input.userName || input.userEmail,
            "billing.paymentSetup.delegateEmail": input.userEmail.toLowerCase().trim(),
            "billing.paymentSetup.delegateAssignedAt": now,
          }
        : {}),
    },
  });
}

function serializePaymentSetup(
  school: PaymentSetupSchoolRow,
  access: Awaited<ReturnType<typeof requirePaymentSetupAccess>>,
  latestJob: ProvisioningJobRow | null,
  pendingInvitations: Awaited<ReturnType<typeof loadPendingInvitations>>
) {
  const status = deriveSchoolPaymentSetupStatus(school);
  const statusMeta = getSchoolPaymentSetupMeta(status);
  const paymentReady = isSchoolPaymentReady(school);
  const canManage = access.capabilities.canManage;
  const accountNumber = canManage ? school.bank?.accountNumber || "" : "";

  return {
    schoolId: String(school._id),
    schoolName: school.name || "Unnamed School",
    paystackKeyMode: getPaystackKeyMode(),
    accessMode: access.accessMode,
    capabilities: access.capabilities,
    paymentReady,
    status,
    statusLabel: statusMeta.label,
    statusTone: statusMeta.tone,
    statusDescription: statusMeta.description,
    canSubmitSetup:
      canManage &&
      hasCompleteSchoolBankDetails(school) &&
      !paymentReady &&
      status !== "review_required",
    reviewReason: canManage
      ? school.billing?.paymentSetup?.reviewReason || null
      : null,
    bank: {
      bankName: canManage ? school.bank?.bankName || "" : "",
      branchName: canManage ? school.bank?.branchName || "" : "",
      sortCode: canManage ? school.bank?.sortCode || "" : "",
      accountName: canManage ? school.bank?.accountName || "" : "",
      accountNumber,
      maskedAccountNumber: accountNumber
        ? maskAccountNumber(accountNumber)
        : "",
    },
    missingFields: getMissingBankFields(school),
    billingOwner: {
      userId: canManage && school.billing?.paymentSetup?.ownerUserId
        ? String(school.billing.paymentSetup.ownerUserId)
        : null,
      name: canManage ? school.billing?.paymentSetup?.ownerName || null : null,
      email: canManage ? school.billing?.paymentSetup?.ownerEmail || null : null,
      assignedAt:
        school.billing?.paymentSetup?.ownerAssignedAt?.toISOString?.() || null,
    },
    financeDelegate: {
      userId: canManage && school.billing?.paymentSetup?.delegateUserId
        ? String(school.billing.paymentSetup.delegateUserId)
        : null,
      name: canManage ? school.billing?.paymentSetup?.delegateName || null : null,
      email: canManage ? school.billing?.paymentSetup?.delegateEmail || null : null,
      assignedAt:
        school.billing?.paymentSetup?.delegateAssignedAt?.toISOString?.() || null,
    },
    pendingInvitations: {
      billingOwner: canManage && pendingInvitations.ownerInvite
        ? {
            invitationId: String(pendingInvitations.ownerInvite._id),
            email: pendingInvitations.ownerInvite.email,
            name:
              [
                pendingInvitations.ownerInvite.metadata?.firstName,
                pendingInvitations.ownerInvite.metadata?.lastName,
              ]
                .filter(Boolean)
                .join(" ")
                .trim() ||
              pendingInvitations.ownerInvite.metadata?.firstName ||
              null,
            mode:
              pendingInvitations.ownerInvite.metadata?.paymentAuthorityMode ===
              "owner_replacement"
                ? "replacement"
                : "initial",
            sentAt: pendingInvitations.ownerInvite.sentAt.toISOString(),
            expiresAt: pendingInvitations.ownerInvite.expiresAt.toISOString(),
          }
        : null,
      financeDelegate: canManage && pendingInvitations.delegateInvite
        ? {
            invitationId: String(pendingInvitations.delegateInvite._id),
            email: pendingInvitations.delegateInvite.email,
            name:
              [
                pendingInvitations.delegateInvite.metadata?.firstName,
                pendingInvitations.delegateInvite.metadata?.lastName,
              ]
                .filter(Boolean)
                .join(" ")
                .trim() ||
              pendingInvitations.delegateInvite.metadata?.firstName ||
              null,
            sentAt: pendingInvitations.delegateInvite.sentAt.toISOString(),
            expiresAt: pendingInvitations.delegateInvite.expiresAt.toISOString(),
          }
        : null,
    },
    paystack: {
      subaccountCode: canManage
        ? school.billing?.paystack?.subaccountCode || null
        : null,
      subaccountId: canManage ? school.billing?.paystack?.subaccountId || null : null,
      lastError: canManage ? school.billing?.paystack?.lastError || null : null,
    },
    provisioning: latestJob
      ? {
          status: latestJob.status,
          attempts: latestJob.attempts,
          lastError: canManage ? latestJob.lastError || null : null,
          nextRunAt: latestJob.nextRunAt?.toISOString?.() || null,
          createdAt: latestJob.createdAt.toISOString(),
          updatedAt: latestJob.updatedAt.toISOString(),
        }
      : null,
    timestamps: {
      submittedAt:
        school.billing?.paymentSetup?.submittedAt?.toISOString?.() || null,
      approvedAt:
        school.billing?.paymentSetup?.approvedAt?.toISOString?.() || null,
      lastUpdatedAt:
        school.billing?.paymentSetup?.lastUpdatedAt?.toISOString?.() || null,
    },
    audit: {
      approvedByEmail: canManage
        ? school.billing?.paymentSetup?.approvedByEmail || null
        : null,
    },
  };
}

export async function GET() {
  try {
    const access = await requirePaymentSetupAccess();
    await bindAssignmentsIfNeeded({
      schoolId: String(access.schoolId),
      userId: String(access.userId),
      userEmail: access.userEmail,
      userName: access.userName,
      shouldBindOwnerUserId: access.shouldBindOwnerUserId,
      shouldBindDelegateUserId: access.shouldBindDelegateUserId,
    });
    const [school, latestJob, pendingInvitations] = await Promise.all([
      loadSchoolPaymentSetup(String(access.schoolId)),
      loadLatestProvisioningJob(String(access.schoolId)),
      loadPendingInvitations(String(access.schoolId)),
    ]);

    if (!school) {
      return NextResponse.json(
        { success: false, error: "School not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: serializePaymentSetup(school, access, latestJob, pendingInvitations),
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error("Failed to load school payment setup:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load payment setup",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const access = await requirePaymentSetupAccess();
    if (!access.capabilities.canManage) {
      return NextResponse.json(
        {
          success: false,
          error: "Only the current billing owner or active setup controller can edit payout details.",
        },
        { status: 403 }
      );
    }
    await bindAssignmentsIfNeeded({
      schoolId: String(access.schoolId),
      userId: String(access.userId),
      userEmail: access.userEmail,
      userName: access.userName,
      shouldBindOwnerUserId: access.shouldBindOwnerUserId,
      shouldBindDelegateUserId: access.shouldBindDelegateUserId,
    });
    const body = UpdatePaymentSetupSchema.parse(await req.json());
    const school = await School.findById(access.schoolId);

    if (!school) {
      return NextResponse.json(
        { success: false, error: "School not found" },
        { status: 404 }
      );
    }

    const derivedSortCode = await resolveBankCode(body.bankName, body.branchName);
    if (!derivedSortCode) {
      return NextResponse.json(
        {
          success: false,
          error: "We could not match that bank branch to a valid sort code.",
        },
        { status: 400 }
      );
    }
    const now = new Date();
    const existingBank = school.bank || {};
    const hadProvisionedRail = Boolean(
      school.billing?.paystack?.subaccountCode || school.billing?.paystack?.subaccountId
    );
    const bankChanged =
      (existingBank.bankName || "") !== body.bankName ||
      (existingBank.branchName || "") !== body.branchName ||
      (existingBank.accountName || "") !== body.accountName ||
      (existingBank.accountNumber || "") !== body.accountNumber;
    const review = assessSchoolPaymentSetupReview({
      schoolName: school.name,
      accountName: body.accountName,
      hadProvisionedRail,
      bankChanged,
    });

    if (bankChanged && hadProvisionedRail && !access.capabilities.canApprovePayoutChange) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only the billing owner can approve payout destination changes for a live school.",
        },
        { status: 403 }
      );
    }

    school.bank = {
      bankName: body.bankName,
      branchName: body.branchName,
      sortCode: derivedSortCode,
      accountName: body.accountName,
      accountNumber: body.accountNumber,
    };

    const billing = school.billing || (school.billing = {});
    const existingPaymentSetup = billing.paymentSetup || {};
    const existingPaystack = billing.paystack || {};
    const hasRecordedOwner = Boolean(
      existingPaymentSetup.ownerUserId ||
        existingPaymentSetup.ownerEmail?.trim() ||
        existingPaymentSetup.ownerName?.trim()
    );
    const defaultOwnerUserId =
      access.accessMode === "billing_owner" ||
      access.accessMode === "school_creator" ||
      access.accessMode === "admin_fallback"
        ? access.userId
        : null;

    billing.status = bankChanged ? "unprovisioned" : billing.status || "unprovisioned";
    billing.paymentSetup = {
      ...existingPaymentSetup,
      ownerUserId: hasRecordedOwner
        ? existingPaymentSetup.ownerUserId || null
        : defaultOwnerUserId,
      ownerName: hasRecordedOwner
        ? existingPaymentSetup.ownerName || null
        : access.userName || access.userEmail,
      ownerEmail: hasRecordedOwner
        ? existingPaymentSetup.ownerEmail || null
        : access.userEmail.toLowerCase().trim(),
      ownerAssignedAt: hasRecordedOwner
        ? existingPaymentSetup.ownerAssignedAt || now
        : now,
      ownerAssignedBy: hasRecordedOwner
        ? existingPaymentSetup.ownerAssignedBy || access.userId
        : access.userId,
      delegateUserId: existingPaymentSetup.delegateUserId || null,
      delegateName: existingPaymentSetup.delegateName || null,
      delegateEmail: existingPaymentSetup.delegateEmail || null,
      delegateAssignedAt: existingPaymentSetup.delegateAssignedAt || null,
      delegateAssignedBy: existingPaymentSetup.delegateAssignedBy || null,
      status: review.requiresReview ? "review_required" : "details_submitted",
      submittedAt: now,
      submittedBy: access.userId,
      approvedAt: bankChanged ? null : existingPaymentSetup.approvedAt || null,
      approvedBy: bankChanged ? null : existingPaymentSetup.approvedBy || null,
      approvedByEmail: bankChanged
        ? null
        : existingPaymentSetup.approvedByEmail || null,
      reviewReason: review.reason,
      lastUpdatedAt: now,
      lastUpdatedBy: access.userId,
    };
    billing.paystack = {
      ...existingPaystack,
      subaccountCode: bankChanged ? null : existingPaystack.subaccountCode || null,
      subaccountId: bankChanged ? null : existingPaystack.subaccountId || null,
      lastError: null,
    };

    await school.save();

    const [updatedSchool, latestJob, pendingInvitations] = await Promise.all([
      loadSchoolPaymentSetup(String(access.schoolId)),
      loadLatestProvisioningJob(String(access.schoolId)),
      loadPendingInvitations(String(access.schoolId)),
    ]);

    return NextResponse.json({
      success: true,
      data: updatedSchool
        ? serializePaymentSetup(updatedSchool, access, latestJob, pendingInvitations)
        : null,
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: error.issues[0]?.message || "Invalid payment setup payload",
        },
        { status: 400 }
      );
    }

    console.error("Failed to update school payment setup:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update payment setup",
      },
      { status: 500 }
    );
  }
}
