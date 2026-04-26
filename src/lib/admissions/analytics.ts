// src/lib/admissions/analytics.ts
// Aggregations powering the Admissions analytics tab and the weekly digest.
// All aggregations are keyed by (schoolId, cycleId) so they can be safely run
// for any cycle the caller has access to.
//
// The shapes here are JSON-safe so they can be returned directly from API
// routes and consumed by client components.

import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AdmissionApplication } from "@/models/AdmissionApplication";
import { AdmissionCycle } from "@/models/AdmissionCycle";
import { AdmissionEvent } from "@/models/AdmissionEvent";
import { Grade } from "@/models/Grade";
import type {
  AdmissionApplicationStatus,
  AdmissionChannel,
} from "./types";

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

export type FunnelStageId =
  | "submitted"
  | "under_review"
  | "decided"
  | "accepted"
  | "provisioned";

export type FunnelStage = {
  id: FunnelStageId;
  label: string;
  count: number;
  /** Conversion from the previous stage (null for the first stage). */
  conversionFromPrev: number | null;
};

export type ChannelBreakdown = Array<{
  channel: AdmissionChannel;
  total: number;
  decided: number;
  accepted: number;
  acceptanceRate: number; // 0..1
}>;

export type StatusBreakdown = Array<{
  status: AdmissionApplicationStatus;
  count: number;
}>;

export type GradeRow = {
  gradeId: string | null;
  gradeName: string;
  capacity: number | null;
  inProgress: number; // submitted + under_review + interview_scheduled
  waitlisted: number;
  accepted: number;
  provisioned: number;
  rejected: number;
  fillRate: number | null; // accepted / capacity (null if no capacity)
  /** True when accepted >= capacity. */
  atCapacity: boolean;
};

export type DecisionVelocity = {
  /** Median time (in hours) from `submittedAt` to a recorded decision. */
  medianHours: number | null;
  /** Average time (in hours) from `submittedAt` to a recorded decision. */
  meanHours: number | null;
  /** Number of decided applications used in the calculation. */
  sampleSize: number;
  /** Decisions still outstanding (status submitted/under_review/interview_scheduled). */
  pendingDecisions: number;
};

export type FeeSummary = {
  enabled: boolean;
  amountMinor: number;
  currency: string;
  mode: "manual_record" | "online_paystack";
  pending: number;
  paid: number;
  waived: number;
  notRequired: number;
};

export type CycleAnalyticsSnapshot = {
  cycleId: string;
  cycleName: string;
  cycleStatus: string;
  generatedAt: string;
  funnel: FunnelStage[];
  byChannel: ChannelBreakdown;
  byStatus: StatusBreakdown;
  byGrade: GradeRow[];
  decisionVelocity: DecisionVelocity;
  fee: FeeSummary;
  totals: {
    applications: number;
    submittedThisWeek: number;
    decidedThisWeek: number;
    provisionedThisWeek: number;
  };
};

// -------------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------------

const ALL_STATUSES: AdmissionApplicationStatus[] = [
  "submitted",
  "under_review",
  "interview_scheduled",
  "accepted",
  "rejected",
  "waitlisted",
  "withdrawn",
  "expired",
];

const ALL_CHANNELS: AdmissionChannel[] = [
  "public_link",
  "embed",
  "qr",
  "direct_invite",
  "whatsapp",
  "internal",
];

const IN_PROGRESS_STATUSES: AdmissionApplicationStatus[] = [
  "submitted",
  "under_review",
  "interview_scheduled",
];

const DECIDED_STATUSES: AdmissionApplicationStatus[] = [
  "accepted",
  "rejected",
  "waitlisted",
];

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function median(numbers: number[]): number | null {
  if (numbers.length === 0) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function mean(numbers: number[]): number | null {
  if (numbers.length === 0) return null;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

function safeRate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

// -------------------------------------------------------------------------
// Snapshot builder
// -------------------------------------------------------------------------

/**
 * Compute a full analytics snapshot for a single cycle.
 *
 * This is intentionally one round-trip per logical concern (funnel by status,
 * by channel, by grade, fee, velocity) instead of a single mega aggregation —
 * Mongo aggregations against a few thousand documents are well under 50ms in
 * practice and the readability is worth it.
 */
export async function buildCycleAnalyticsSnapshot(input: {
  schoolId: Types.ObjectId;
  cycleId: Types.ObjectId;
}): Promise<CycleAnalyticsSnapshot> {
  await connectToDatabase();

  const cycle = await AdmissionCycle.findOne({
    _id: input.cycleId,
    schoolId: input.schoolId,
  }).lean();

  if (!cycle) {
    throw new Error("Cycle not found for analytics snapshot");
  }

  const baseMatch = { schoolId: input.schoolId, cycleId: input.cycleId };

  // ------------------------- by status -------------------------
  const statusAgg = await AdmissionApplication.aggregate<{
    _id: AdmissionApplicationStatus;
    count: number;
  }>([{ $match: baseMatch }, { $group: { _id: "$status", count: { $sum: 1 } } }]);

  const statusCounts = new Map<AdmissionApplicationStatus, number>();
  for (const row of statusAgg) statusCounts.set(row._id, row.count);
  const byStatus: StatusBreakdown = ALL_STATUSES.map((status) => ({
    status,
    count: statusCounts.get(status) ?? 0,
  }));

  const totalApplications = statusAgg.reduce((sum, r) => sum + r.count, 0);
  const acceptedCount = statusCounts.get("accepted") ?? 0;
  const rejectedCount = statusCounts.get("rejected") ?? 0;
  const waitlistedCount = statusCounts.get("waitlisted") ?? 0;
  const decidedCount = acceptedCount + rejectedCount + waitlistedCount;

  // ------------------------- provisioned -------------------------
  const provisionedCount = await AdmissionApplication.countDocuments({
    ...baseMatch,
    "provisioned.studentId": { $ne: null },
  });

  // ------------------------- in review (submitted + under_review + interview) -------------------------
  const inProgressCount =
    (statusCounts.get("submitted") ?? 0) +
    (statusCounts.get("under_review") ?? 0) +
    (statusCounts.get("interview_scheduled") ?? 0);

  // Funnel definition: submitted (everyone) → reviewed (under_review or beyond)
  // → decided (accepted/rejected/waitlisted) → accepted → provisioned.
  const reviewedCount =
    (statusCounts.get("under_review") ?? 0) +
    (statusCounts.get("interview_scheduled") ?? 0) +
    decidedCount; // anyone who has moved past submitted

  const funnel: FunnelStage[] = [
    {
      id: "submitted",
      label: "Submitted",
      count: totalApplications,
      conversionFromPrev: null,
    },
    {
      id: "under_review",
      label: "Reviewed",
      count: reviewedCount,
      conversionFromPrev: safeRate(reviewedCount, totalApplications),
    },
    {
      id: "decided",
      label: "Decisioned",
      count: decidedCount,
      conversionFromPrev: safeRate(decidedCount, reviewedCount),
    },
    {
      id: "accepted",
      label: "Accepted",
      count: acceptedCount,
      conversionFromPrev: safeRate(acceptedCount, decidedCount),
    },
    {
      id: "provisioned",
      label: "Enrolled",
      count: provisionedCount,
      conversionFromPrev: safeRate(provisionedCount, acceptedCount),
    },
  ];

  // ------------------------- by channel -------------------------
  const channelAgg = await AdmissionApplication.aggregate<{
    _id: AdmissionChannel;
    total: number;
    accepted: number;
    decided: number;
  }>([
    { $match: baseMatch },
    {
      $group: {
        _id: "$channel",
        total: { $sum: 1 },
        accepted: {
          $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] },
        },
        decided: {
          $sum: {
            $cond: [
              {
                $in: ["$status", ["accepted", "rejected", "waitlisted"]],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const channelMap = new Map<
    AdmissionChannel,
    { total: number; accepted: number; decided: number }
  >();
  for (const row of channelAgg) channelMap.set(row._id, row);

  const byChannel: ChannelBreakdown = ALL_CHANNELS.map((channel) => {
    const stats = channelMap.get(channel) ?? {
      total: 0,
      accepted: 0,
      decided: 0,
    };
    return {
      channel,
      total: stats.total,
      decided: stats.decided,
      accepted: stats.accepted,
      acceptanceRate: safeRate(stats.accepted, stats.total),
    };
  }).filter((row) => row.total > 0);

  // ------------------------- by grade -------------------------
  type GradeAgg = {
    _id: Types.ObjectId | null;
    inProgress: number;
    waitlisted: number;
    accepted: number;
    rejected: number;
    provisioned: number;
  };

  const gradeAgg = await AdmissionApplication.aggregate<GradeAgg>([
    { $match: baseMatch },
    {
      $group: {
        _id: {
          $ifNull: ["$decision.targetGradeId", "$applicant.intendedGradeId"],
        },
        inProgress: {
          $sum: {
            $cond: [
              {
                $in: ["$status", IN_PROGRESS_STATUSES],
              },
              1,
              0,
            ],
          },
        },
        waitlisted: {
          $sum: { $cond: [{ $eq: ["$status", "waitlisted"] }, 1, 0] },
        },
        accepted: {
          $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] },
        },
        rejected: {
          $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] },
        },
        provisioned: {
          $sum: {
            $cond: [{ $ifNull: ["$provisioned.studentId", false] }, 1, 0],
          },
        },
      },
    },
  ]);

  const gradeIdsToFetch = gradeAgg
    .map((g) => g._id)
    .filter((id): id is Types.ObjectId => Boolean(id));
  const grades = gradeIdsToFetch.length
    ? await Grade.find({ _id: { $in: gradeIdsToFetch } })
        .select({ _id: 1, name: 1, order: 1 })
        .lean()
    : [];
  const gradeMap = new Map<string, { name: string; order?: number | null }>();
  for (const g of grades) {
    gradeMap.set(String(g._id), {
      name: String(g.name),
      order: typeof g.order === "number" ? g.order : null,
    });
  }

  const capacityByGradeRaw = (cycle.capacityByGradeId ?? new Map()) as
    | Map<string, number>
    | Record<string, number>;
  const capacityMap =
    capacityByGradeRaw instanceof Map
      ? capacityByGradeRaw
      : new Map<string, number>(Object.entries(capacityByGradeRaw ?? {}));

  // Include grades with capacity but no applications yet.
  const gradeIdsWithApplications = new Set(
    gradeAgg.map((g) => (g._id ? String(g._id) : "_unassigned"))
  );
  const additionalCapacityIds = Array.from(capacityMap.keys()).filter(
    (id) => !gradeIdsWithApplications.has(id)
  );
  if (additionalCapacityIds.length > 0) {
    const extraGrades = await Grade.find({ _id: { $in: additionalCapacityIds } })
      .select({ _id: 1, name: 1, order: 1 })
      .lean();
    for (const g of extraGrades) {
      gradeMap.set(String(g._id), {
        name: String(g.name),
        order: typeof g.order === "number" ? g.order : null,
      });
    }
  }

  const byGrade: GradeRow[] = [
    ...gradeAgg.map((row): GradeRow => {
      const id = row._id ? String(row._id) : null;
      const gradeMeta = id ? gradeMap.get(id) : null;
      const capacity = id ? capacityMap.get(id) ?? null : null;
      return {
        gradeId: id,
        gradeName: gradeMeta?.name ?? (id ? "Unknown grade" : "Unassigned"),
        capacity: typeof capacity === "number" ? capacity : null,
        inProgress: row.inProgress,
        waitlisted: row.waitlisted,
        accepted: row.accepted,
        provisioned: row.provisioned,
        rejected: row.rejected,
        fillRate:
          typeof capacity === "number" && capacity > 0
            ? row.accepted / capacity
            : null,
        atCapacity: typeof capacity === "number" && row.accepted >= capacity,
      };
    }),
    ...additionalCapacityIds.map((id): GradeRow => {
      const meta = gradeMap.get(id);
      const capacity = capacityMap.get(id) ?? 0;
      return {
        gradeId: id,
        gradeName: meta?.name ?? "Unknown grade",
        capacity,
        inProgress: 0,
        waitlisted: 0,
        accepted: 0,
        provisioned: 0,
        rejected: 0,
        fillRate: 0,
        atCapacity: false,
      };
    }),
  ].sort((a, b) => {
    const orderA = a.gradeId ? gradeMap.get(a.gradeId)?.order ?? 999 : 999;
    const orderB = b.gradeId ? gradeMap.get(b.gradeId)?.order ?? 999 : 999;
    return orderA - orderB;
  });

  // ------------------------- decision velocity -------------------------
  const decidedSamples = await AdmissionApplication.find({
    ...baseMatch,
    status: { $in: DECIDED_STATUSES },
    submittedAt: { $ne: null },
    "decision.decidedAt": { $ne: null },
  })
    .select({ submittedAt: 1, "decision.decidedAt": 1 })
    .lean();

  const hourSamples: number[] = [];
  for (const app of decidedSamples) {
    const submitted = app.submittedAt ? new Date(app.submittedAt).getTime() : null;
    const decided = app.decision?.decidedAt
      ? new Date(app.decision.decidedAt).getTime()
      : null;
    if (submitted && decided && decided >= submitted) {
      hourSamples.push((decided - submitted) / (1000 * 60 * 60));
    }
  }

  const decisionVelocity: DecisionVelocity = {
    medianHours: median(hourSamples),
    meanHours: mean(hourSamples),
    sampleSize: hourSamples.length,
    pendingDecisions: inProgressCount,
  };

  // ------------------------- fee summary -------------------------
  const feeAgg = await AdmissionApplication.aggregate<{
    _id: "pending" | "paid" | "waived" | "not_required";
    count: number;
  }>([{ $match: baseMatch }, { $group: { _id: "$feeStatus", count: { $sum: 1 } } }]);

  const feeMap = new Map<string, number>();
  for (const row of feeAgg) feeMap.set(row._id, row.count);

  const feeConfig = cycle.applicationFee ?? null;
  const fee: FeeSummary = {
    enabled: Boolean(feeConfig?.enabled),
    amountMinor: feeConfig?.amountMinor ?? 0,
    currency: feeConfig?.currency ?? "GHS",
    mode: feeConfig?.mode ?? "manual_record",
    pending: feeMap.get("pending") ?? 0,
    paid: feeMap.get("paid") ?? 0,
    waived: feeMap.get("waived") ?? 0,
    notRequired: feeMap.get("not_required") ?? 0,
  };

  // ------------------------- weekly counters -------------------------
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [submittedThisWeek, decidedThisWeek, provisionedThisWeek] =
    await Promise.all([
      AdmissionApplication.countDocuments({
        ...baseMatch,
        submittedAt: { $gte: sevenDaysAgo },
      }),
      AdmissionApplication.countDocuments({
        ...baseMatch,
        "decision.decidedAt": { $gte: sevenDaysAgo },
      }),
      AdmissionApplication.countDocuments({
        ...baseMatch,
        "provisioned.provisionedAt": { $gte: sevenDaysAgo },
      }),
    ]);

  return {
    cycleId: String(input.cycleId),
    cycleName: cycle.name,
    cycleStatus: cycle.status,
    generatedAt: new Date().toISOString(),
    funnel,
    byChannel,
    byStatus,
    byGrade,
    decisionVelocity,
    fee,
    totals: {
      applications: totalApplications,
      submittedThisWeek,
      decidedThisWeek,
      provisionedThisWeek,
    },
  };
}

// -------------------------------------------------------------------------
// School-level helpers (used by the weekly digest)
// -------------------------------------------------------------------------

export type SchoolDigestPayload = {
  schoolId: string;
  generatedAt: string;
  cycles: Array<
    CycleAnalyticsSnapshot & {
      pendingActions: {
        decisionsOlderThan48h: number;
        unreviewedApplications: number;
        outstandingFees: number;
      };
    }
  >;
};

export async function buildSchoolDigestPayload(
  schoolId: Types.ObjectId
): Promise<SchoolDigestPayload> {
  await connectToDatabase();

  const cycles = await AdmissionCycle.find({
    schoolId,
    status: { $in: ["published", "paused"] },
  })
    .select({ _id: 1, name: 1 })
    .lean();

  const snapshots = await Promise.all(
    cycles.map(async (cycle) => {
      const snap = await buildCycleAnalyticsSnapshot({
        schoolId,
        cycleId: cycle._id as Types.ObjectId,
      });
      const stale = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const decisionsOlderThan48h = await AdmissionApplication.countDocuments({
        schoolId,
        cycleId: cycle._id,
        status: { $in: IN_PROGRESS_STATUSES },
        submittedAt: { $lt: stale },
      });
      return {
        ...snap,
        pendingActions: {
          decisionsOlderThan48h,
          unreviewedApplications:
            snap.byStatus.find((s) => s.status === "submitted")?.count ?? 0,
          outstandingFees: snap.fee.pending,
        },
      };
    })
  );

  return {
    schoolId: String(schoolId),
    generatedAt: new Date().toISOString(),
    cycles: snapshots,
  };
}

// -------------------------------------------------------------------------
// Optional: light event-funnel timing using AdmissionEvent (expansion hook)
// -------------------------------------------------------------------------

export async function countEventsByKind(input: {
  schoolId: Types.ObjectId;
  cycleId: Types.ObjectId;
  kinds: string[];
  since?: Date;
}): Promise<Record<string, number>> {
  await connectToDatabase();
  const filter: Record<string, unknown> = {
    schoolId: input.schoolId,
    cycleId: input.cycleId,
    kind: { $in: input.kinds },
  };
  if (input.since) filter.at = { $gte: input.since };

  const results = await AdmissionEvent.aggregate<{
    _id: string;
    count: number;
  }>([{ $match: filter }, { $group: { _id: "$kind", count: { $sum: 1 } } }]);

  const out: Record<string, number> = {};
  for (const r of results) out[r._id] = r.count;
  return out;
}

export const ANALYTICS_OBJECT_ID_VALIDATOR = mongoose.Types.ObjectId;
