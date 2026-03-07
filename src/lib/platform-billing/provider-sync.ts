import mongoose from "mongoose";
import { isUploadThingUrl } from "@/lib/uploads/provider";
import {
  PLATFORM_BILLING_PROVIDER_LABELS,
  PLATFORM_BILLING_PROVIDERS,
  type PlatformBillingProvider,
} from "@/lib/platform-billing/providers";
import { AIFeatureUsageEvent } from "@/models/AIFeatureUsageEvent";
import { Homework } from "@/models/Homework";
import { Message } from "@/models/Message";
import { MessageThread } from "@/models/MessageThread";
import { Payment } from "@/models/Payment";
import { PaymentIntent } from "@/models/PaymentIntent";
import {
  ProviderSyncRun,
  type ProviderSyncTriggerMode,
} from "@/models/ProviderSyncRun";
import { ServiceCostEntry } from "@/models/ServiceCostEntry";
import { Submission } from "@/models/Submission";
import { Student } from "@/models/Student";
import { Teacher } from "@/models/Teacher";
import { TeacherDocument } from "@/models/TeacherDocument";
import { User } from "@/models/User";
import { UserMembership } from "@/models/UserMembership";
import { UsageMetric } from "@/models/UsageMetric";
import { Notice } from "@/models/Notice";

export const AUTO_SYNC_PROVIDERS: readonly PlatformBillingProvider[] = [
  "clerk",
  "mongodb",
  "vercel",
  "openai",
  "uploadthing",
  "paystack",
  "internal",
] as const;

export const PROVIDER_SYNC_NOTES: Record<PlatformBillingProvider, string> = {
  clerk:
    "Automatic sync uses active school memberships as the allocation weight and distributes invoice-imported Clerk cost across schools.",
  mongodb:
    "Automatic sync uses school-scoped document footprint as the allocation weight and distributes invoice-imported MongoDB cost across schools.",
  vercel:
    "Automatic sync uses school-scoped activity as the allocation weight and distributes invoice-imported Vercel cost across schools.",
  openai:
    "Automatic sync derives AI token usage from recorded platform AI usage events.",
  uploadthing:
    "Automatic sync derives upload usage from UploadThing-backed assets already recorded in the platform database.",
  paystack:
    "Automatic sync uses completed paystack-backed payments already recorded by the platform.",
  email:
    "Automatic sync not implemented yet. Use manual cost and usage attribution until provider integration is added.",
  storage:
    "Automatic sync not implemented yet. Use manual cost and usage attribution until provider integration is added.",
  internal:
    "Automatic sync derives current operational footprint from internal platform records.",
};

type ProviderSyncActor = {
  userId?: mongoose.Types.ObjectId | null;
  email?: string | null;
};

const OPENAI_COST_PER_1M_TOKENS_MINOR = Math.max(
  0,
  Number(process.env.OPENAI_COST_PER_1M_TOKENS_MINOR || "0")
);
const UPLOADTHING_COST_PER_GB_MINOR = Math.max(
  0,
  Number(process.env.UPLOADTHING_COST_PER_GB_MINOR || "0")
);
const BYTES_PER_GB = 1024 * 1024 * 1024;

export type ProviderSyncResult = {
  provider: PlatformBillingProvider;
  metricsUpserted: number;
  costEntriesUpserted: number;
  summary: string;
  metadata?: Record<string, unknown>;
};

export type ProviderSyncExecutionResult = ProviderSyncResult & {
  runId: string;
};

type UsageMetricUpsertInput = {
  schoolId: mongoose.Types.ObjectId;
  provider: PlatformBillingProvider;
  metricKey: string;
  quantity: number;
  unitLabel: string;
  unitCostMinor: number;
  estimatedCostMinor: number;
  allocationMethod: "direct" | "weighted" | "manual";
  sourceType: "manual" | "provider_sync" | "system_estimate";
  periodStart: Date;
  periodEnd: Date;
  notes?: string | null;
  actor: ProviderSyncActor;
};

function isAutoSyncProvider(provider: PlatformBillingProvider) {
  return AUTO_SYNC_PROVIDERS.includes(provider);
}

export function getProviderSyncCatalog() {
  return PLATFORM_BILLING_PROVIDERS.map((provider) => ({
    value: provider,
    label: PLATFORM_BILLING_PROVIDER_LABELS[provider],
    autoSyncAvailable: isAutoSyncProvider(provider),
    note: PROVIDER_SYNC_NOTES[provider],
  }));
}

function toInclusiveRangeEnd(date: Date) {
  const next = new Date(date);
  next.setUTCHours(23, 59, 59, 999);
  return next;
}

function estimatePerThousandCostMinor(totalUnits: number, rateMinor: number) {
  if (rateMinor <= 0 || totalUnits <= 0) return 0;
  return Math.max(0, Math.round((totalUnits / 1000) * rateMinor));
}

async function getInvoiceImportedCostTotal(args: {
  provider: PlatformBillingProvider;
  periodStart: Date;
  periodEnd: Date;
}) {
  const rows = await ServiceCostEntry.aggregate<{ totalAmountMinor: number }>([
    {
      $match: {
        provider: args.provider,
        sourceType: "invoice_import",
        periodStart: args.periodStart,
        periodEnd: args.periodEnd,
      },
    },
    {
      $group: {
        _id: null,
        totalAmountMinor: { $sum: { $ifNull: ["$amountMinor", 0] } },
      },
    },
  ]);

  return Math.max(0, Math.round(Number(rows[0]?.totalAmountMinor || 0)));
}

function allocateInvoiceBackedSharedCost(args: {
  importedCostMinor: number;
  weight: number;
  totalWeight: number;
}) {
  if (args.importedCostMinor <= 0 || args.weight <= 0 || args.totalWeight <= 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.round((args.importedCostMinor * args.weight) / args.totalWeight)
  );
}

async function upsertUsageMetric(input: UsageMetricUpsertInput) {
  await UsageMetric.findOneAndUpdate(
    {
      schoolId: input.schoolId,
      provider: input.provider,
      metricKey: input.metricKey,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
    },
    {
      $set: {
        quantity: input.quantity,
        unitLabel: input.unitLabel,
        unitCostMinor: input.unitCostMinor,
        estimatedCostMinor: input.estimatedCostMinor,
        allocationMethod: input.allocationMethod,
        sourceType: input.sourceType,
        notes: input.notes || null,
        updatedBy: input.actor.userId || null,
        updatedByEmail: input.actor.email || null,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );
}

async function upsertServiceCostEntry(args: {
  provider: PlatformBillingProvider;
  category: string;
  description?: string | null;
  amountMinor: number;
  allocationMethod: "shared" | "direct" | "n_a";
  sourceType: "manual" | "provider_sync" | "invoice_import";
  periodStart: Date;
  periodEnd: Date;
  notes?: string | null;
  actor: ProviderSyncActor;
}) {
  await ServiceCostEntry.findOneAndUpdate(
    {
      provider: args.provider,
      category: args.category,
      sourceType: args.sourceType,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
    },
    {
      $set: {
        description: args.description || null,
        amountMinor: args.amountMinor,
        currency: "GHS",
        allocationMethod: args.allocationMethod,
        notes: args.notes || null,
        createdBy: args.actor.userId || null,
        createdByEmail: args.actor.email || null,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );
}

async function syncClerkProvider(args: {
  periodStart: Date;
  periodEnd: Date;
  actor: ProviderSyncActor;
}): Promise<ProviderSyncResult> {
  const userCollectionName = User.collection.name;
  const [activeMembershipRows, newMembershipRows] = await Promise.all([
    UserMembership.aggregate<{
      _id: mongoose.Types.ObjectId;
      activeMemberships: number;
    }>([
      { $match: { status: "active" } },
      {
        $lookup: {
          from: userCollectionName,
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      { $match: { "user.clerkUserId": { $exists: true, $ne: null } } },
      {
        $group: {
          _id: "$schoolId",
          activeMemberships: { $sum: 1 },
        },
      },
    ]),
    UserMembership.aggregate<{
      _id: mongoose.Types.ObjectId;
      newMemberships: number;
    }>([
      {
        $match: {
          status: { $in: ["active", "invited"] },
          createdAt: {
            $gte: args.periodStart,
            $lte: toInclusiveRangeEnd(args.periodEnd),
          },
        },
      },
      {
        $lookup: {
          from: userCollectionName,
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      { $match: { "user.clerkUserId": { $exists: true, $ne: null } } },
      {
        $group: {
          _id: "$schoolId",
          newMemberships: { $sum: 1 },
        },
      },
    ]),
  ]);

  const bySchool = new Map<
    string,
    {
      schoolId: mongoose.Types.ObjectId;
      activeMemberships: number;
      newMemberships: number;
    }
  >();

  for (const row of activeMembershipRows) {
    bySchool.set(String(row._id), {
      schoolId: row._id,
      activeMemberships: Number(row.activeMemberships || 0),
      newMemberships: 0,
    });
  }

  for (const row of newMembershipRows) {
    const existing = bySchool.get(String(row._id));
    if (existing) {
      existing.newMemberships = Number(row.newMemberships || 0);
      continue;
    }

    bySchool.set(String(row._id), {
      schoolId: row._id,
      activeMemberships: 0,
      newMemberships: Number(row.newMemberships || 0),
    });
  }

  let metricsUpserted = 0;
  const totalActiveMemberships = Array.from(bySchool.values()).reduce(
    (sum, row) => sum + row.activeMemberships,
    0
  );
  const totalNewMemberships = Array.from(bySchool.values()).reduce(
    (sum, row) => sum + row.newMemberships,
    0
  );
  const importedCostMinor = await getInvoiceImportedCostTotal({
    provider: "clerk",
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
  });
  const unitCostMinor =
    totalActiveMemberships > 0
      ? importedCostMinor / totalActiveMemberships
      : 0;

  for (const row of bySchool.values()) {
    const estimatedCostMinor = allocateInvoiceBackedSharedCost({
      importedCostMinor,
      weight: row.activeMemberships,
      totalWeight: totalActiveMemberships,
    });

    await upsertUsageMetric({
      schoolId: row.schoolId,
      provider: "clerk",
      metricKey: "active_memberships",
      quantity: row.activeMemberships,
      unitLabel: "memberships",
      unitCostMinor,
      estimatedCostMinor,
      allocationMethod: "weighted",
      sourceType: "provider_sync",
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      notes:
        importedCostMinor > 0
          ? "Invoice-backed Clerk cost allocated by active school memberships linked to Clerk-backed users."
          : "Clerk usage weights were captured, but no invoice-imported Clerk cost exists for this period, so allocated cost remains zero.",
      actor: args.actor,
    });
    metricsUpserted += 1;

    await upsertUsageMetric({
      schoolId: row.schoolId,
      provider: "clerk",
      metricKey: "new_memberships_period",
      quantity: row.newMemberships,
      unitLabel: "memberships",
      unitCostMinor: 0,
      estimatedCostMinor: 0,
      allocationMethod: "weighted",
      sourceType: "provider_sync",
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      notes:
        "New school memberships created in the selected period for Clerk-backed users.",
      actor: args.actor,
    });
    metricsUpserted += 1;
  }

  return {
    provider: "clerk",
    metricsUpserted,
    costEntriesUpserted: 0,
    summary:
      bySchool.size > 0
        ? `Synced Clerk allocation for ${bySchool.size} schools across ${totalActiveMemberships} active memberships.`
        : "No Clerk-backed school memberships were found.",
    metadata: {
      schoolsTouched: bySchool.size,
      activeMemberships: totalActiveMemberships,
      newMembershipsPeriod: totalNewMemberships,
      invoiceImportedCostMinor: importedCostMinor,
      invoiceBacked: importedCostMinor > 0,
    },
  };
}

async function syncMongoDbProvider(args: {
  periodStart: Date;
  periodEnd: Date;
  actor: ProviderSyncActor;
}): Promise<ProviderSyncResult> {
  const [
    studentRows,
    teacherRows,
    messageRows,
    messageThreadRows,
    homeworkRows,
    submissionRows,
    noticeRows,
    teacherDocumentRows,
    paymentRows,
    paymentIntentRows,
    aiUsageRows,
  ] = await Promise.all([
    Student.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      { $group: { _id: "$schoolId", count: { $sum: 1 } } },
    ]),
    Teacher.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      { $group: { _id: "$schoolId", count: { $sum: 1 } } },
    ]),
    Message.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      { $group: { _id: "$schoolId", count: { $sum: 1 } } },
    ]),
    MessageThread.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      { $group: { _id: "$schoolId", count: { $sum: 1 } } },
    ]),
    Homework.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      { $group: { _id: "$schoolId", count: { $sum: 1 } } },
    ]),
    Submission.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      { $group: { _id: "$schoolId", count: { $sum: 1 } } },
    ]),
    Notice.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      { $group: { _id: "$schoolId", count: { $sum: 1 } } },
    ]),
    TeacherDocument.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      { $group: { _id: "$schoolId", count: { $sum: 1 } } },
    ]),
    Payment.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      { $group: { _id: "$schoolId", count: { $sum: 1 } } },
    ]),
    PaymentIntent.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      { $group: { _id: "$schoolId", count: { $sum: 1 } } },
    ]),
    AIFeatureUsageEvent.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      { $group: { _id: "$schoolId", count: { $sum: 1 } } },
    ]),
  ]);

  const bySchool = new Map<
    string,
    { schoolId: mongoose.Types.ObjectId; documentCount: number }
  >();

  for (const collection of [
    studentRows,
    teacherRows,
    messageRows,
    messageThreadRows,
    homeworkRows,
    submissionRows,
    noticeRows,
    teacherDocumentRows,
    paymentRows,
    paymentIntentRows,
    aiUsageRows,
  ]) {
    for (const row of collection) {
      const key = String(row._id);
      const existing = bySchool.get(key) || {
        schoolId: row._id,
        documentCount: 0,
      };
      existing.documentCount += Number(row.count || 0);
      bySchool.set(key, existing);
    }
  }

  let metricsUpserted = 0;
  const totalDocumentCount = Array.from(bySchool.values()).reduce(
    (sum, row) => sum + row.documentCount,
    0
  );
  const importedCostMinor = await getInvoiceImportedCostTotal({
    provider: "mongodb",
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
  });
  const unitCostMinor =
    totalDocumentCount > 0 ? importedCostMinor / totalDocumentCount : 0;

  for (const row of bySchool.values()) {
    const estimatedCostMinor = allocateInvoiceBackedSharedCost({
      importedCostMinor,
      weight: row.documentCount,
      totalWeight: totalDocumentCount,
    });

    await upsertUsageMetric({
      schoolId: row.schoolId,
      provider: "mongodb",
      metricKey: "document_count_proxy",
      quantity: row.documentCount,
      unitLabel: "documents",
      unitCostMinor,
      estimatedCostMinor,
      allocationMethod: "weighted",
      sourceType: "provider_sync",
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      notes:
        importedCostMinor > 0
          ? "Invoice-backed MongoDB cost allocated by school-scoped document footprint across tracked collections."
          : "MongoDB usage weights were captured, but no invoice-imported MongoDB cost exists for this period, so allocated cost remains zero.",
      actor: args.actor,
    });
    metricsUpserted += 1;
  }

  return {
    provider: "mongodb",
    metricsUpserted,
    costEntriesUpserted: 0,
    summary:
      bySchool.size > 0
        ? `Synced MongoDB footprint proxy for ${bySchool.size} schools across ${totalDocumentCount} documents.`
        : "No school-scoped MongoDB documents were found in the tracked collections.",
    metadata: {
      schoolsTouched: bySchool.size,
      totalDocumentCount,
      invoiceImportedCostMinor: importedCostMinor,
      invoiceBacked: importedCostMinor > 0,
    },
  };
}

async function syncVercelProvider(args: {
  periodStart: Date;
  periodEnd: Date;
  actor: ProviderSyncActor;
}): Promise<ProviderSyncResult> {
  const range = {
    $gte: args.periodStart,
    $lte: toInclusiveRangeEnd(args.periodEnd),
  };

  const [
    paymentIntentRows,
    paymentRows,
    messageRows,
    messageThreadRows,
    homeworkRows,
    submissionRows,
    noticeRows,
    teacherDocumentRows,
    aiUsageRows,
  ] = await Promise.all([
    PaymentIntent.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      { $match: { createdAt: range } },
      { $group: { _id: "$schoolId", count: { $sum: 1 } } },
    ]),
    Payment.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      { $match: { createdAt: range } },
      { $group: { _id: "$schoolId", count: { $sum: 1 } } },
    ]),
    Message.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      { $match: { createdAt: range } },
      { $group: { _id: "$schoolId", count: { $sum: 1 } } },
    ]),
    MessageThread.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      { $match: { createdAt: range } },
      { $group: { _id: "$schoolId", count: { $sum: 1 } } },
    ]),
    Homework.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      { $match: { createdAt: range } },
      { $group: { _id: "$schoolId", count: { $sum: 1 } } },
    ]),
    Submission.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      { $match: { createdAt: range } },
      { $group: { _id: "$schoolId", count: { $sum: 1 } } },
    ]),
    Notice.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      { $match: { createdAt: range } },
      { $group: { _id: "$schoolId", count: { $sum: 1 } } },
    ]),
    TeacherDocument.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      { $match: { createdAt: range } },
      { $group: { _id: "$schoolId", count: { $sum: 1 } } },
    ]),
    AIFeatureUsageEvent.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      { $match: { createdAt: range } },
      { $group: { _id: "$schoolId", count: { $sum: 1 } } },
    ]),
  ]);

  const bySchool = new Map<
    string,
    { schoolId: mongoose.Types.ObjectId; activityEvents: number }
  >();

  for (const collection of [
    paymentIntentRows,
    paymentRows,
    messageRows,
    messageThreadRows,
    homeworkRows,
    submissionRows,
    noticeRows,
    teacherDocumentRows,
    aiUsageRows,
  ]) {
    for (const row of collection) {
      const key = String(row._id);
      const existing = bySchool.get(key) || {
        schoolId: row._id,
        activityEvents: 0,
      };
      existing.activityEvents += Number(row.count || 0);
      bySchool.set(key, existing);
    }
  }

  let metricsUpserted = 0;
  const totalActivityEvents = Array.from(bySchool.values()).reduce(
    (sum, row) => sum + row.activityEvents,
    0
  );
  const importedCostMinor = await getInvoiceImportedCostTotal({
    provider: "vercel",
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
  });
  const unitCostMinor =
    totalActivityEvents > 0 ? importedCostMinor / totalActivityEvents : 0;

  for (const row of bySchool.values()) {
    const estimatedCostMinor = allocateInvoiceBackedSharedCost({
      importedCostMinor,
      weight: row.activityEvents,
      totalWeight: totalActivityEvents,
    });

    await upsertUsageMetric({
      schoolId: row.schoolId,
      provider: "vercel",
      metricKey: "activity_event_proxy",
      quantity: row.activityEvents,
      unitLabel: "events",
      unitCostMinor,
      estimatedCostMinor,
      allocationMethod: "weighted",
      sourceType: "provider_sync",
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      notes:
        importedCostMinor > 0
          ? "Invoice-backed Vercel cost allocated by school-scoped operational activity for the selected period."
          : "Vercel usage weights were captured, but no invoice-imported Vercel cost exists for this period, so allocated cost remains zero.",
      actor: args.actor,
    });
    metricsUpserted += 1;
  }

  return {
    provider: "vercel",
    metricsUpserted,
    costEntriesUpserted: 0,
    summary:
      bySchool.size > 0
        ? `Synced Vercel activity proxy for ${bySchool.size} schools across ${totalActivityEvents} events.`
        : "No school-scoped write activity was found for the selected period.",
    metadata: {
      schoolsTouched: bySchool.size,
      totalActivityEvents,
      invoiceImportedCostMinor: importedCostMinor,
      invoiceBacked: importedCostMinor > 0,
    },
  };
}

async function syncPaystackProvider(args: {
  periodStart: Date;
  periodEnd: Date;
  actor: ProviderSyncActor;
}): Promise<ProviderSyncResult> {
  const paymentRows = await Payment.aggregate<{
    _id: mongoose.Types.ObjectId;
    successfulPayments: number;
    paymentVolumeMinor: number;
    processorFeeMinor: number;
    platformFeeMinor: number;
  }>([
    {
      $match: {
        paymentMethod: "paystack",
        status: "completed",
        paymentDate: {
          $gte: args.periodStart,
          $lte: toInclusiveRangeEnd(args.periodEnd),
        },
      },
    },
    {
      $group: {
        _id: "$schoolId",
        successfulPayments: { $sum: 1 },
        paymentVolumeMinor: { $sum: { $ifNull: ["$amountMinor", 0] } },
        processorFeeMinor: { $sum: { $ifNull: ["$processorFeeMinor", 0] } },
        platformFeeMinor: { $sum: { $ifNull: ["$platformFeeMinor", 0] } },
      },
    },
  ]);

  let metricsUpserted = 0;
  for (const row of paymentRows) {
    await upsertUsageMetric({
      schoolId: row._id,
      provider: "paystack",
      metricKey: "successful_payments",
      quantity: Number(row.successfulPayments || 0),
      unitLabel: "payments",
      unitCostMinor: 0,
      estimatedCostMinor: 0,
      allocationMethod: "direct",
      sourceType: "provider_sync",
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      notes: "Derived from completed paystack payments recorded by the platform.",
      actor: args.actor,
    });
    metricsUpserted += 1;

    await upsertUsageMetric({
      schoolId: row._id,
      provider: "paystack",
      metricKey: "payment_volume_minor",
      quantity: Number(row.paymentVolumeMinor || 0),
      unitLabel: "minor_units",
      unitCostMinor: 0,
      estimatedCostMinor: 0,
      allocationMethod: "direct",
      sourceType: "provider_sync",
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      notes: "Total paystack-backed payment volume in minor units.",
      actor: args.actor,
    });
    metricsUpserted += 1;

    await upsertUsageMetric({
      schoolId: row._id,
      provider: "paystack",
      metricKey: "processor_fee_minor",
      quantity: Number(row.processorFeeMinor || 0),
      unitLabel: "minor_units",
      unitCostMinor: 1,
      estimatedCostMinor: Number(row.processorFeeMinor || 0),
      allocationMethod: "direct",
      sourceType: "provider_sync",
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      notes:
        "Direct processor fee cost derived from paystack-backed completed payments.",
      actor: args.actor,
    });
    metricsUpserted += 1;

    await upsertUsageMetric({
      schoolId: row._id,
      provider: "paystack",
      metricKey: "edusentrix_fee_revenue_minor",
      quantity: Number(row.platformFeeMinor || 0),
      unitLabel: "minor_units",
      unitCostMinor: 0,
      estimatedCostMinor: 0,
      allocationMethod: "direct",
      sourceType: "provider_sync",
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      notes:
        "EduSentrix transaction fee revenue volume from paystack-backed payments.",
      actor: args.actor,
    });
    metricsUpserted += 1;
  }

  const totalProcessorFees = paymentRows.reduce(
    (sum, row) => sum + Number(row.processorFeeMinor || 0),
    0
  );

  await upsertServiceCostEntry({
    provider: "paystack",
    category: "processor_fees",
    description: "Aggregated paystack processor fees from completed payments.",
    amountMinor: totalProcessorFees,
    allocationMethod: "direct",
    sourceType: "provider_sync",
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
    notes:
      "Generated from recorded paystack-backed payments. School-level attribution lives in UsageMetric records.",
    actor: args.actor,
  });

  const totalPayments = paymentRows.reduce(
    (sum, row) => sum + Number(row.successfulPayments || 0),
    0
  );

  return {
    provider: "paystack",
    metricsUpserted,
    costEntriesUpserted: 1,
    summary:
      paymentRows.length > 0
        ? `Synced paystack metrics for ${paymentRows.length} schools across ${totalPayments} completed payments.`
        : "No completed paystack payments found for the selected period.",
    metadata: {
      schoolsTouched: paymentRows.length,
      completedPayments: totalPayments,
      totalProcessorFees,
    },
  };
}

async function syncOpenAIProvider(args: {
  periodStart: Date;
  periodEnd: Date;
  actor: ProviderSyncActor;
}): Promise<ProviderSyncResult> {
  const usageRows = await UsageMetric.aggregate<{
    _id: mongoose.Types.ObjectId;
    requests: number;
    totalTokens: number;
  }>([
    {
      $match: {
        provider: "openai",
        periodStart: args.periodStart,
        periodEnd: args.periodEnd,
      },
    },
    {
      $group: {
        _id: "$schoolId",
        requests: {
          $sum: {
            $cond: [{ $eq: ["$metricKey", "ai_calls"] }, { $ifNull: ["$quantity", 0] }, 0],
          },
        },
        totalTokens: {
          $sum: {
            $cond: [
              { $eq: ["$metricKey", "total_tokens"] },
              { $ifNull: ["$quantity", 0] },
              0,
            ],
          },
        },
      },
    },
  ]);

  const costPerTokenMinor = OPENAI_COST_PER_1M_TOKENS_MINOR / 1_000_000;
  let metricsUpserted = 0;

  for (const row of usageRows) {
    const totalTokens = Number(row.totalTokens || 0);
    const estimatedCostMinor = Math.max(
      0,
      Math.round(totalTokens * costPerTokenMinor)
    );

    await upsertUsageMetric({
      schoolId: row._id,
      provider: "openai",
      metricKey: "ai_requests",
      quantity: Number(row.requests || 0),
      unitLabel: "requests",
      unitCostMinor: 0,
      estimatedCostMinor: 0,
      allocationMethod: "direct",
      sourceType: "provider_sync",
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      notes: "Derived from recorded OpenAI-backed AI generation events.",
      actor: args.actor,
    });
    metricsUpserted += 1;

    await upsertUsageMetric({
      schoolId: row._id,
      provider: "openai",
      metricKey: "prompt_tokens",
      quantity: 0,
      unitLabel: "tokens",
      unitCostMinor: 0,
      estimatedCostMinor: 0,
      allocationMethod: "direct",
      sourceType: "provider_sync",
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      notes: "Prompt-token detail is not yet separated in normalized usage metrics.",
      actor: args.actor,
    });
    metricsUpserted += 1;

    await upsertUsageMetric({
      schoolId: row._id,
      provider: "openai",
      metricKey: "total_tokens",
      quantity: totalTokens,
      unitLabel: "tokens",
      unitCostMinor: costPerTokenMinor,
      estimatedCostMinor,
      allocationMethod: "direct",
      sourceType: "provider_sync",
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      notes:
        OPENAI_COST_PER_1M_TOKENS_MINOR > 0
          ? "Estimated cost is derived from OPENAI_COST_PER_1M_TOKENS_MINOR."
          : "No OpenAI unit cost is configured; estimated cost remains zero until OPENAI_COST_PER_1M_TOKENS_MINOR is set.",
      actor: args.actor,
    });
    metricsUpserted += 1;
  }

  const totalRequests = usageRows.reduce(
    (sum, row) => sum + Number(row.requests || 0),
    0
  );
  const totalTokens = usageRows.reduce(
    (sum, row) => sum + Number(row.totalTokens || 0),
    0
  );
  const totalEstimatedCostMinor = Math.max(
    0,
    Math.round(totalTokens * costPerTokenMinor)
  );

  await upsertServiceCostEntry({
    provider: "openai",
    category: "token_usage_estimate",
    description: "Estimated OpenAI usage cost from recorded AI generation events.",
    amountMinor: totalEstimatedCostMinor,
    allocationMethod: "direct",
    sourceType: "provider_sync",
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
    notes:
      OPENAI_COST_PER_1M_TOKENS_MINOR > 0
        ? "Estimated from recorded token usage and OPENAI_COST_PER_1M_TOKENS_MINOR."
        : "Recorded token usage exists, but OPENAI_COST_PER_1M_TOKENS_MINOR is not configured, so cost is recorded as zero.",
    actor: args.actor,
  });

  return {
    provider: "openai",
    metricsUpserted,
    costEntriesUpserted: 1,
    summary:
      usageRows.length > 0
        ? `Synced OpenAI usage for ${usageRows.length} schools across ${totalRequests} AI requests.`
        : "No OpenAI usage events were found for the selected period.",
    metadata: {
      schoolsTouched: usageRows.length,
      requests: totalRequests,
      totalTokens,
      costRateConfigured: OPENAI_COST_PER_1M_TOKENS_MINOR > 0,
      totalEstimatedCostMinor,
    },
  };
}

type UploadStat = {
  schoolId: mongoose.Types.ObjectId;
  assetCount: number;
  totalBytes: number;
  assetsWithKnownSize: number;
  assetsWithoutKnownSize: number;
};

function appendUploadStat(
  target: Map<string, UploadStat>,
  schoolId: mongoose.Types.ObjectId,
  url?: string | null,
  size?: number | null
) {
  if (!url || !isUploadThingUrl(url)) return;

  const key = String(schoolId);
  const current =
    target.get(key) ||
    {
      schoolId,
      assetCount: 0,
      totalBytes: 0,
      assetsWithKnownSize: 0,
      assetsWithoutKnownSize: 0,
    };

  current.assetCount += 1;
  const numericSize = Number(size || 0);
  if (numericSize > 0) {
    current.totalBytes += numericSize;
    current.assetsWithKnownSize += 1;
  } else {
    current.assetsWithoutKnownSize += 1;
  }

  target.set(key, current);
}

async function syncUploadThingProvider(args: {
  periodStart: Date;
  periodEnd: Date;
  actor: ProviderSyncActor;
}): Promise<ProviderSyncResult> {
  type TeacherDocumentRow = {
    schoolId: mongoose.Types.ObjectId;
    fileUrl?: string;
    fileSize?: number | null;
  };
  type AttachmentLike = {
    url?: string;
    size?: number;
  };
  type AttachmentContainer = {
    schoolId: mongoose.Types.ObjectId;
    attachments?: AttachmentLike[];
  };

  const range = {
    $gte: args.periodStart,
    $lte: toInclusiveRangeEnd(args.periodEnd),
  };

  const [teacherDocuments, homeworks, submissions, messages, notices] =
    await Promise.all([
      TeacherDocument.find({ createdAt: range })
        .select("schoolId fileUrl fileSize")
        .lean<TeacherDocumentRow[]>(),
      Homework.find({ createdAt: range })
        .select("schoolId attachments")
        .lean<AttachmentContainer[]>(),
      Submission.find({ createdAt: range })
        .select("schoolId attachments")
        .lean<AttachmentContainer[]>(),
      Message.find({ createdAt: range })
        .select("schoolId attachments")
        .lean<AttachmentContainer[]>(),
      Notice.find({ createdAt: range })
        .select("schoolId attachments")
        .lean<AttachmentContainer[]>(),
    ]);

  const bySchool = new Map<string, UploadStat>();

  for (const doc of teacherDocuments) {
    appendUploadStat(bySchool, doc.schoolId, doc.fileUrl, doc.fileSize);
  }

  for (const collection of [homeworks, submissions, messages, notices]) {
    for (const item of collection) {
      for (const attachment of item.attachments || []) {
        appendUploadStat(bySchool, item.schoolId, attachment.url, attachment.size);
      }
    }
  }

  const costPerByteMinor = UPLOADTHING_COST_PER_GB_MINOR / BYTES_PER_GB;
  let metricsUpserted = 0;

  for (const row of bySchool.values()) {
    const estimatedCostMinor = Math.max(
      0,
      Math.round(row.totalBytes * costPerByteMinor)
    );

    await upsertUsageMetric({
      schoolId: row.schoolId,
      provider: "uploadthing",
      metricKey: "uploaded_assets",
      quantity: row.assetCount,
      unitLabel: "assets",
      unitCostMinor: 0,
      estimatedCostMinor: 0,
      allocationMethod: "direct",
      sourceType: "provider_sync",
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      notes:
        "UploadThing-backed asset count derived from persisted platform attachments in the selected period.",
      actor: args.actor,
    });
    metricsUpserted += 1;

    await upsertUsageMetric({
      schoolId: row.schoolId,
      provider: "uploadthing",
      metricKey: "uploaded_bytes",
      quantity: row.totalBytes,
      unitLabel: "bytes",
      unitCostMinor: costPerByteMinor,
      estimatedCostMinor,
      allocationMethod: "direct",
      sourceType: "provider_sync",
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      notes:
        UPLOADTHING_COST_PER_GB_MINOR > 0
          ? `Estimated from known attachment sizes and UPLOADTHING_COST_PER_GB_MINOR. ${row.assetsWithoutKnownSize} assets had no stored byte size.`
          : `Known upload volume captured from attachment metadata. ${row.assetsWithoutKnownSize} assets had no stored byte size, and cost remains zero until UPLOADTHING_COST_PER_GB_MINOR is set.`,
      actor: args.actor,
    });
    metricsUpserted += 1;
  }

  const totals = Array.from(bySchool.values()).reduce(
    (acc, row) => {
      acc.assets += row.assetCount;
      acc.bytes += row.totalBytes;
      acc.withKnownSize += row.assetsWithKnownSize;
      acc.withoutKnownSize += row.assetsWithoutKnownSize;
      return acc;
    },
    {
      assets: 0,
      bytes: 0,
      withKnownSize: 0,
      withoutKnownSize: 0,
    }
  );

  const totalEstimatedCostMinor = Math.max(
    0,
    Math.round(totals.bytes * costPerByteMinor)
  );

  await upsertServiceCostEntry({
    provider: "uploadthing",
    category: "upload_volume_estimate",
    description: "Estimated UploadThing cost from known UploadThing-backed asset volume.",
    amountMinor: totalEstimatedCostMinor,
    allocationMethod: "direct",
    sourceType: "provider_sync",
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
    notes:
      UPLOADTHING_COST_PER_GB_MINOR > 0
        ? "Estimated from UploadThing-backed asset sizes and UPLOADTHING_COST_PER_GB_MINOR."
        : "UploadThing asset usage was detected, but UPLOADTHING_COST_PER_GB_MINOR is not configured, so cost is recorded as zero.",
    actor: args.actor,
  });

  return {
    provider: "uploadthing",
    metricsUpserted,
    costEntriesUpserted: 1,
    summary:
      bySchool.size > 0
        ? `Synced UploadThing usage for ${bySchool.size} schools across ${totals.assets} uploaded assets.`
        : "No UploadThing-backed assets were found for the selected period.",
    metadata: {
      schoolsTouched: bySchool.size,
      uploadedAssets: totals.assets,
      uploadedBytes: totals.bytes,
      assetsWithKnownSize: totals.withKnownSize,
      assetsWithoutKnownSize: totals.withoutKnownSize,
      costRateConfigured: UPLOADTHING_COST_PER_GB_MINOR > 0,
      totalEstimatedCostMinor,
    },
  };
}

async function syncInternalProvider(args: {
  periodStart: Date;
  periodEnd: Date;
  actor: ProviderSyncActor;
}): Promise<ProviderSyncResult> {
  const [studentRows, teacherRows] = await Promise.all([
    Student.aggregate<{
      _id: mongoose.Types.ObjectId;
      activeStudents: number;
    }>([
      { $match: { status: "active" } },
      { $group: { _id: "$schoolId", activeStudents: { $sum: 1 } } },
    ]),
    Teacher.aggregate<{
      _id: mongoose.Types.ObjectId;
      activeTeachers: number;
    }>([
      { $match: { status: "active" } },
      { $group: { _id: "$schoolId", activeTeachers: { $sum: 1 } } },
    ]),
  ]);

  const bySchool = new Map<
    string,
    {
      schoolId: mongoose.Types.ObjectId;
      activeStudents: number;
      activeTeachers: number;
    }
  >();

  for (const row of studentRows) {
    bySchool.set(String(row._id), {
      schoolId: row._id,
      activeStudents: Number(row.activeStudents || 0),
      activeTeachers: 0,
    });
  }

  for (const row of teacherRows) {
    const existing = bySchool.get(String(row._id));
    if (existing) {
      existing.activeTeachers = Number(row.activeTeachers || 0);
      continue;
    }

    bySchool.set(String(row._id), {
      schoolId: row._id,
      activeStudents: 0,
      activeTeachers: Number(row.activeTeachers || 0),
    });
  }

  let metricsUpserted = 0;
  for (const row of bySchool.values()) {
    await upsertUsageMetric({
      schoolId: row.schoolId,
      provider: "internal",
      metricKey: "active_students",
      quantity: row.activeStudents,
      unitLabel: "students",
      unitCostMinor: 0,
      estimatedCostMinor: 0,
      allocationMethod: "manual",
      sourceType: "system_estimate",
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      notes:
        "Current active-student footprint snapshot derived from internal platform records.",
      actor: args.actor,
    });
    metricsUpserted += 1;

    await upsertUsageMetric({
      schoolId: row.schoolId,
      provider: "internal",
      metricKey: "active_teachers",
      quantity: row.activeTeachers,
      unitLabel: "teachers",
      unitCostMinor: 0,
      estimatedCostMinor: 0,
      allocationMethod: "manual",
      sourceType: "system_estimate",
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      notes:
        "Current active-teacher footprint snapshot derived from internal platform records.",
      actor: args.actor,
    });
    metricsUpserted += 1;
  }

  const totalStudents = Array.from(bySchool.values()).reduce(
    (sum, row) => sum + row.activeStudents,
    0
  );
  const totalTeachers = Array.from(bySchool.values()).reduce(
    (sum, row) => sum + row.activeTeachers,
    0
  );

  return {
    provider: "internal",
    metricsUpserted,
    costEntriesUpserted: 0,
    summary:
      bySchool.size > 0
        ? `Captured current internal footprint for ${bySchool.size} schools.`
        : "No active internal footprint records were found.",
    metadata: {
      schoolsTouched: bySchool.size,
      activeStudents: totalStudents,
      activeTeachers: totalTeachers,
      snapshotBased: true,
    },
  };
}

export async function executePlatformBillingProviderSyncRun(args: {
  provider: PlatformBillingProvider;
  periodStart: Date;
  periodEnd: Date;
  triggerMode: ProviderSyncTriggerMode;
  actor: ProviderSyncActor;
}): Promise<ProviderSyncExecutionResult> {
  const run = await ProviderSyncRun.create({
    provider: args.provider,
    status: "running",
    triggerMode: args.triggerMode,
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
    metricsUpserted: 0,
    costEntriesUpserted: 0,
    triggeredBy: args.actor.userId || null,
    triggeredByEmail: args.actor.email || null,
    startedAt: new Date(),
  });

  try {
    const result = await runPlatformBillingProviderSync({
      provider: args.provider,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      actor: args.actor,
    });

    await ProviderSyncRun.findByIdAndUpdate(run._id, {
      $set: {
        status: "completed",
        metricsUpserted: result.metricsUpserted,
        costEntriesUpserted: result.costEntriesUpserted,
        summary: result.summary,
        metadata: result.metadata || null,
        completedAt: new Date(),
      },
    });

    return {
      runId: String(run._id),
      ...result,
    };
  } catch (error) {
    await ProviderSyncRun.findByIdAndUpdate(run._id, {
      $set: {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Provider sync failed",
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

export async function runPlatformBillingProviderSync(args: {
  provider: PlatformBillingProvider;
  periodStart: Date;
  periodEnd: Date;
  actor: ProviderSyncActor;
}): Promise<ProviderSyncResult> {
  switch (args.provider) {
    case "clerk":
      return syncClerkProvider(args);
    case "mongodb":
      return syncMongoDbProvider(args);
    case "vercel":
      return syncVercelProvider(args);
    case "openai":
      return syncOpenAIProvider(args);
    case "uploadthing":
      return syncUploadThingProvider(args);
    case "paystack":
      return syncPaystackProvider(args);
    case "internal":
      return syncInternalProvider(args);
    default:
      throw new Error(
        `${PLATFORM_BILLING_PROVIDER_LABELS[args.provider]} automatic sync is not implemented yet. Use the manual usage and cost surfaces for now.`
      );
  }
}
