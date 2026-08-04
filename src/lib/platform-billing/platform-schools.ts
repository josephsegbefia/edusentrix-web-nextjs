import mongoose from "mongoose";
import { resolveTransactionFeeConfigForSchool } from "@/lib/billing/transaction-fees";
import { maskAccountNumber } from "@/lib/platform-billing/payout-security";
import { School } from "@/models/School";
import { UsageMetric } from "@/models/UsageMetric";
import { ProvisioningJob } from "@/models/ProvisioningJob";
import { User } from "@/models/User";
import { UserMembership } from "@/models/UserMembership";
import {
  deriveSchoolPaymentSetupStatus,
  getSchoolPaymentSetupMeta,
  isSchoolPaymentReady,
} from "@/lib/school-payments/payment-setup";
import { getSchoolSetupProgress } from "@/lib/platform/schools/setup-progress";

export async function getPlatformSchoolList() {
  const [schools, usageMetrics] = await Promise.all([
    School.find({})
      .select("name status createdBy bank billing")
      .sort({ name: 1 })
      .lean<Array<{
        _id: mongoose.Types.ObjectId;
        name?: string;
        status?: string;
        createdBy?: mongoose.Types.ObjectId | null;
        bank?: {
          bankName?: string | null;
          branchName?: string | null;
          sortCode?: string | null;
          accountName?: string | null;
          accountNumber?: string | null;
        } | null;
        billing?: {
          status?: "unprovisioned" | "provisioned" | "failed" | null;
          paymentSetup?: {
            status?:
              | "not_started"
              | "awaiting_billing_owner"
              | "details_submitted"
              | "pending_provisioning"
              | "review_required"
              | "provisioned"
              | "failed"
              | null;
            ownerUserId?: mongoose.Types.ObjectId | null;
            ownerName?: string | null;
            ownerEmail?: string | null;
            reviewReason?: string | null;
          } | null;
          paystack?: {
            subaccountCode?: string | null;
            subaccountId?: string | null;
            lastError?: string | null;
          } | null;
          transactionFees?: {
            mode?: "platform_default" | "custom" | "disabled";
            percent?: number | null;
            capMinor?: number | null;
            notes?: string | null;
            updatedAt?: Date | null;
          };
        };
      }>>(),
    UsageMetric.aggregate<{
      _id: mongoose.Types.ObjectId;
      totalEstimatedCostMinor: number;
      metricsCount: number;
    }>([
      {
        $group: {
          _id: "$schoolId",
          totalEstimatedCostMinor: { $sum: "$estimatedCostMinor" },
          metricsCount: { $sum: 1 },
        },
      },
    ]),
  ]);

  const usageBySchool = new Map(
    usageMetrics.map((row) => [String(row._id), row])
  );

  return schools.map((school) => {
    const schoolId = String(school._id);
    const usage = usageBySchool.get(schoolId);
    const feeConfig = resolveTransactionFeeConfigForSchool(
      school.billing?.transactionFees || null
    );
    const paymentSetupStatus = deriveSchoolPaymentSetupStatus(school);

    return {
      id: schoolId,
      name: school.name || "Unnamed School",
      status: school.status || "pending",
      paymentReady: isSchoolPaymentReady(school),
      paymentSetupStatus,
      transactionFeePolicy: {
        mode: school.billing?.transactionFees?.mode || "platform_default",
        percent: school.billing?.transactionFees?.percent ?? null,
        capMinor: school.billing?.transactionFees?.capMinor ?? null,
        notes: school.billing?.transactionFees?.notes || null,
        updatedAt: school.billing?.transactionFees?.updatedAt?.toISOString?.() || null,
      },
      effectiveTransactionFee: feeConfig,
      subscription: null,
      usage: {
        totalEstimatedCostMinor: Math.max(
          0,
          Math.round(Number(usage?.totalEstimatedCostMinor || 0))
        ),
        metricsCount: Math.max(0, Math.round(Number(usage?.metricsCount || 0))),
      },
    };
  });
}

export async function getPlatformSchoolDetail(schoolId: string) {
  if (!mongoose.Types.ObjectId.isValid(schoolId)) {
    return null;
  }

  const schoolIdObj = new mongoose.Types.ObjectId(schoolId);
  const [school, usageMetrics, latestProvisioningJob, setupProgress, adminMembership, legacyAdminUser] =
    await Promise.all([
    School.findById(schoolIdObj)
      .select(
        "name status createdBy bank billing city region email environmentType"
      )
      .lean<{
        _id: mongoose.Types.ObjectId;
        name?: string;
        status?: string;
        city?: string;
        region?: string;
        email?: string;
        environmentType?: string;
        createdBy?: mongoose.Types.ObjectId | null;
        bank?: {
          bankName?: string | null;
          branchName?: string | null;
          sortCode?: string | null;
          accountName?: string | null;
          accountNumber?: string | null;
        } | null;
        billing?: {
          status?: "unprovisioned" | "provisioned" | "failed" | null;
          paymentSetup?: {
            status?:
              | "not_started"
              | "awaiting_billing_owner"
              | "details_submitted"
              | "pending_provisioning"
              | "review_required"
              | "provisioned"
              | "failed"
              | null;
            ownerUserId?: mongoose.Types.ObjectId | null;
            ownerName?: string | null;
            ownerEmail?: string | null;
            reviewReason?: string | null;
            pendingPlatformPayout?: {
              bankName?: string | null;
              branchName?: string | null;
              sortCode?: string | null;
              accountName?: string | null;
              accountNumber?: string | null;
              note?: string | null;
              proposedByEmail?: string | null;
              proposedAt?: Date | null;
            } | null;
          } | null;
          paystack?: {
            subaccountCode?: string | null;
            subaccountId?: string | null;
            lastError?: string | null;
            lastErrorDetail?: string | null;
            lastErrorAt?: Date | null;
          } | null;
          transactionFees?: {
            mode?: "platform_default" | "custom" | "disabled";
            percent?: number | null;
            capMinor?: number | null;
            notes?: string | null;
            updatedAt?: Date | null;
          };
        };
      } | null>(),
    UsageMetric.find({ schoolId: schoolIdObj })
      .sort({ updatedAt: -1 })
      .limit(25)
      .lean<Array<{
        _id: mongoose.Types.ObjectId;
        provider: string;
        metricKey: string;
        quantity?: number;
        unitLabel?: string;
        estimatedCostMinor?: number;
        periodStart: Date;
        periodEnd: Date;
        updatedAt?: Date | null;
      }>>(),
    ProvisioningJob.findOne({
      schoolId: schoolIdObj,
      kind: "paystack_subaccount",
    })
      .sort({ updatedAt: -1 })
      .lean<{
        _id: mongoose.Types.ObjectId;
        status?: "pending" | "running" | "failed" | "done";
        attempts?: number;
        lastError?: string | null;
        nextRunAt?: Date | null;
        createdAt?: Date;
        updatedAt?: Date;
      } | null>(),
    getSchoolSetupProgress(schoolIdObj),
    UserMembership.findOne({
      schoolId: schoolIdObj,
      roles: "school_admin",
      status: { $in: ["active", "invited"] },
    })
      .sort({ createdAt: 1 })
      .select("userId")
      .lean<{ userId: mongoose.Types.ObjectId } | null>(),
    User.findOne({
      schoolId: schoolIdObj,
      role: "school_admin",
    })
      .sort({ createdAt: 1 })
      .select("_id email firstName lastName name clerkUserId pendingOnboarding")
      .lean<{
        _id: mongoose.Types.ObjectId;
        email?: string | null;
        firstName?: string | null;
        lastName?: string | null;
        name?: string | null;
        clerkUserId?: string | null;
        pendingOnboarding?: boolean | null;
      } | null>(),
  ]);

  if (!school) {
    return null;
  }

  const memberAdminUser = adminMembership?.userId
    ? await User.findById(adminMembership.userId)
        .select("_id email firstName lastName name clerkUserId pendingOnboarding")
        .lean<{
          _id: mongoose.Types.ObjectId;
          email?: string | null;
          firstName?: string | null;
          lastName?: string | null;
          name?: string | null;
          clerkUserId?: string | null;
          pendingOnboarding?: boolean | null;
        } | null>()
    : null;
  const adminUser = memberAdminUser || legacyAdminUser;

  const feeConfig = resolveTransactionFeeConfigForSchool(
    school.billing?.transactionFees || null
  );
  const paymentSetupStatus = deriveSchoolPaymentSetupStatus(school);
  const paymentSetupMeta = getSchoolPaymentSetupMeta(paymentSetupStatus);
  const totalEstimatedCostMinor = usageMetrics.reduce(
    (sum, metric) => sum + Math.max(0, Math.round(Number(metric.estimatedCostMinor || 0))),
    0
  );
  return {
    id: String(school._id),
    name: school.name || "Unnamed School",
    status: school.status || "pending",
    city: school.city || null,
    region: school.region || null,
    email: school.email || null,
    environmentType: school.environmentType || "production",
    adminAccount: adminUser
      ? {
          id: String(adminUser._id),
          name:
            adminUser.name ||
            [adminUser.firstName, adminUser.lastName].filter(Boolean).join(" ") ||
            null,
          email: adminUser.email || null,
          hasPlatformAccount: Boolean(adminUser.clerkUserId),
          pendingOnboarding: Boolean(adminUser.pendingOnboarding),
        }
      : null,
    setupProgress,
    paymentReady: isSchoolPaymentReady(school),
    paymentSetup: {
      status: paymentSetupStatus,
      statusLabel: paymentSetupMeta.label,
      statusTone: paymentSetupMeta.tone,
      reviewReason: school.billing?.paymentSetup?.reviewReason || null,
      billingOwner: {
        name: school.billing?.paymentSetup?.ownerName || null,
        email: school.billing?.paymentSetup?.ownerEmail || null,
      },
      bank: {
        bankName: school.bank?.bankName || null,
        branchName: school.bank?.branchName || null,
        accountName: school.bank?.accountName || null,
        maskedAccountNumber: school.bank?.accountNumber
          ? maskAccountNumber(school.bank.accountNumber)
          : null,
      },
      paystack: {
        subaccountCode: school.billing?.paystack?.subaccountCode || null,
        lastError: school.billing?.paystack?.lastError || null,
        lastErrorDetail: school.billing?.paystack?.lastErrorDetail || null,
        lastErrorAt:
          school.billing?.paystack?.lastErrorAt?.toISOString?.() || null,
      },
      pendingPlatformPayout: (() => {
        const p = school.billing?.paymentSetup?.pendingPlatformPayout;
        if (!p?.bankName?.trim()) return null;
        return {
          bankName: p.bankName || null,
          branchName: p.branchName || null,
          sortCode: p.sortCode || null,
          accountName: p.accountName || null,
          maskedAccountNumber: p.accountNumber
            ? maskAccountNumber(p.accountNumber)
            : null,
          note: p.note || null,
          proposedByEmail: p.proposedByEmail || null,
          proposedAt: p.proposedAt?.toISOString?.() || null,
        };
      })(),
      provisioningJob: latestProvisioningJob
        ? {
            id: String(latestProvisioningJob._id),
            status: latestProvisioningJob.status || "pending",
            attempts: latestProvisioningJob.attempts ?? 0,
            lastError: latestProvisioningJob.lastError || null,
            nextRunAt:
              latestProvisioningJob.nextRunAt?.toISOString?.() || null,
            createdAt:
              latestProvisioningJob.createdAt?.toISOString?.() ||
              new Date().toISOString(),
            updatedAt:
              latestProvisioningJob.updatedAt?.toISOString?.() ||
              new Date().toISOString(),
          }
        : null,
    },
    transactionFeePolicy: {
      mode: school.billing?.transactionFees?.mode || "platform_default",
      percent: school.billing?.transactionFees?.percent ?? null,
      capMinor: school.billing?.transactionFees?.capMinor ?? null,
      notes: school.billing?.transactionFees?.notes || null,
      updatedAt: school.billing?.transactionFees?.updatedAt?.toISOString?.() || null,
    },
    effectiveTransactionFee: feeConfig,
    subscription: null,
    usage: {
      totalEstimatedCostMinor,
      metricsCount: usageMetrics.length,
      metrics: usageMetrics.map((metric) => ({
        id: String(metric._id),
        provider: metric.provider,
        metricKey: metric.metricKey,
        quantity: Math.max(0, Number(metric.quantity || 0)),
        unitLabel: metric.unitLabel || "units",
        estimatedCostMinor: Math.max(
          0,
          Math.round(Number(metric.estimatedCostMinor || 0))
        ),
        periodStart: metric.periodStart.toISOString().slice(0, 10),
        periodEnd: metric.periodEnd.toISOString().slice(0, 10),
        updatedAt: metric.updatedAt?.toISOString?.() || null,
      })),
    },
    events: [],
  };
}
