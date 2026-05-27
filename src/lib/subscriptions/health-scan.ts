/**
 * health-scan.ts
 *
 * Subscription health scan — finds schools that need platform attention:
 *   - Expiring in N days
 *   - Currently in grace period (and grace period ending soon)
 *   - Suspended
 *   - Past due
 *   - No subscription assigned
 *   - Pilot ending soon
 *
 * Used by:
 *   - /api/platform/subscription-notifications (daily scan API)
 *   - Platform billing dashboard
 *   - Background cron (future)
 *
 * Spec §14.
 */

import mongoose from "mongoose";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { School } from "@/models/School";

export type HealthAlertSeverity = "critical" | "warning" | "info";

export type SubscriptionHealthAlert = {
  schoolId: string;
  schoolName: string;
  alertType:
    | "expiring_soon"
    | "grace_period_active"
    | "grace_period_ending_soon"
    | "suspended"
    | "past_due"
    | "no_subscription"
    | "pilot_ending_soon";
  severity: HealthAlertSeverity;
  message: string;
  daysRemaining: number | null;
  subscriptionId: string | null;
  planCode: string | null;
  planName: string | null;
  actionUrl: string;
};

export type HealthScanResult = {
  alerts: SubscriptionHealthAlert[];
  summary: {
    critical: number;
    warning: number;
    info: number;
    total: number;
  };
  scannedAt: string;
};

export async function runSubscriptionHealthScan(options?: {
  /** Days ahead to warn about expiry. Default 30. */
  expiringSoonDays?: number;
  /** Days ahead to warn about pilot ending. Default 14. */
  pilotEndingSoonDays?: number;
  /** Days ahead to warn about grace period ending. Default 7. */
  graceEndingSoonDays?: number;
}): Promise<HealthScanResult> {
  const {
    expiringSoonDays = 30,
    pilotEndingSoonDays = 14,
    graceEndingSoonDays = 7,
  } = options ?? {};

  const now = new Date();
  const inExpiry = new Date(now.getTime() + expiringSoonDays * 24 * 60 * 60 * 1000);
  const inPilot = new Date(now.getTime() + pilotEndingSoonDays * 24 * 60 * 60 * 1000);
  const inGrace = new Date(now.getTime() + graceEndingSoonDays * 24 * 60 * 60 * 1000);

  // Fetch schools with issues
  const [
    expiringSubs,
    graceSubs,
    graceEndingSubs,
    suspendedSubs,
    pastDueSubs,
    pilotEndingSubs,
    activeSchoolCount,
    subscribedSchoolIds,
  ] = await Promise.all([
    // Active subscriptions expiring soon
    SchoolSubscription.find({
      status: "active",
      endsAt: { $gte: now, $lte: inExpiry },
    })
      .select("schoolId tierId tierCode tierName endsAt")
      .lean<Array<{
        schoolId: mongoose.Types.ObjectId;
        tierId?: mongoose.Types.ObjectId | null;
        tierCode?: string | null;
        tierName?: string | null;
        endsAt?: Date | null;
        _id: mongoose.Types.ObjectId;
      }>>(),

    // Currently in grace period
    SchoolSubscription.find({ status: "grace" })
      .select("schoolId tierId tierCode tierName gracePeriodEndsAt")
      .lean<Array<{
        schoolId: mongoose.Types.ObjectId;
        tierId?: mongoose.Types.ObjectId | null;
        tierCode?: string | null;
        tierName?: string | null;
        gracePeriodEndsAt?: Date | null;
        _id: mongoose.Types.ObjectId;
      }>>(),

    // Grace period ending very soon
    SchoolSubscription.find({
      status: "grace",
      gracePeriodEndsAt: { $gte: now, $lte: inGrace },
    })
      .select("schoolId tierId tierCode tierName gracePeriodEndsAt")
      .lean<Array<{
        schoolId: mongoose.Types.ObjectId;
        tierId?: mongoose.Types.ObjectId | null;
        tierCode?: string | null;
        tierName?: string | null;
        gracePeriodEndsAt?: Date | null;
        _id: mongoose.Types.ObjectId;
      }>>(),

    // Suspended
    SchoolSubscription.find({ status: "suspended" })
      .select("schoolId tierId tierCode tierName")
      .lean<Array<{
        schoolId: mongoose.Types.ObjectId;
        tierId?: mongoose.Types.ObjectId | null;
        tierCode?: string | null;
        tierName?: string | null;
        _id: mongoose.Types.ObjectId;
      }>>(),

    // Past due
    SchoolSubscription.find({ status: "past_due" })
      .select("schoolId tierId tierCode tierName endsAt")
      .lean<Array<{
        schoolId: mongoose.Types.ObjectId;
        tierId?: mongoose.Types.ObjectId | null;
        tierCode?: string | null;
        tierName?: string | null;
        endsAt?: Date | null;
        _id: mongoose.Types.ObjectId;
      }>>(),

    // Pilot ending soon
    SchoolSubscription.find({
      status: "pilot",
      pilotEndsAt: { $gte: now, $lte: inPilot },
    })
      .select("schoolId tierId tierCode tierName pilotEndsAt")
      .lean<Array<{
        schoolId: mongoose.Types.ObjectId;
        tierId?: mongoose.Types.ObjectId | null;
        tierCode?: string | null;
        tierName?: string | null;
        pilotEndsAt?: Date | null;
        _id: mongoose.Types.ObjectId;
      }>>(),

    // Total active schools
    School.countDocuments({ status: "active" }),

    // School IDs that have any subscription
    SchoolSubscription.distinct("schoolId"),
  ]);

  // Find schools with no subscription
  const subscribedSet = new Set(subscribedSchoolIds.map(String));
  const allActiveSchools = await School.find({ status: "active" })
    .select("_id name")
    .lean<Array<{ _id: mongoose.Types.ObjectId; name?: string }>>()
    .then((arr) => arr.filter((s) => !subscribedSet.has(String(s._id))));

  // Collect all school IDs to fetch names
  const allSchoolIds = [
    ...expiringSubs.map((s) => s.schoolId),
    ...graceSubs.map((s) => s.schoolId),
    ...suspendedSubs.map((s) => s.schoolId),
    ...pastDueSubs.map((s) => s.schoolId),
    ...pilotEndingSubs.map((s) => s.schoolId),
  ];

  const schoolNames: Record<string, string> = {};
  if (allSchoolIds.length > 0) {
    const schools = await School.find({ _id: { $in: allSchoolIds } })
      .select("name")
      .lean<Array<{ _id: mongoose.Types.ObjectId; name?: string }>>()
      .then((arr) => arr);
    for (const s of schools) {
      schoolNames[String(s._id)] = s.name ?? "Unknown";
    }
  }

  const alerts: SubscriptionHealthAlert[] = [];

  function daysUntil(date: Date | null | undefined): number | null {
    if (!date) return null;
    return Math.round((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  }

  // Suspended — critical
  for (const s of suspendedSubs) {
    alerts.push({
      schoolId: String(s.schoolId),
      schoolName: schoolNames[String(s.schoolId)] ?? "Unknown",
      alertType: "suspended",
      severity: "critical",
      message: `School is suspended. No access to app features.`,
      daysRemaining: null,
      subscriptionId: String(s._id),
      planCode: s.tierCode ?? null,
      planName: s.tierName ?? null,
      actionUrl: `/platform/schools/${s.schoolId}/subscription`,
    });
  }

  // Past due — critical
  for (const s of pastDueSubs) {
    alerts.push({
      schoolId: String(s.schoolId),
      schoolName: schoolNames[String(s.schoolId)] ?? "Unknown",
      alertType: "past_due",
      severity: "critical",
      message: `Subscription payment is past due.`,
      daysRemaining: daysUntil(s.endsAt ?? null),
      subscriptionId: String(s._id),
      planCode: s.tierCode ?? null,
      planName: s.tierName ?? null,
      actionUrl: `/platform/schools/${s.schoolId}/subscription`,
    });
  }

  // Grace period ending soon — critical
  const graceEndingIds = new Set(graceEndingSubs.map((s) => String(s._id)));
  for (const s of graceEndingSubs) {
    const days = daysUntil(s.gracePeriodEndsAt ?? null);
    alerts.push({
      schoolId: String(s.schoolId),
      schoolName: schoolNames[String(s.schoolId)] ?? "Unknown",
      alertType: "grace_period_ending_soon",
      severity: "critical",
      message: `Grace period ending in ${days ?? "?"} day${days === 1 ? "" : "s"}.`,
      daysRemaining: days,
      subscriptionId: String(s._id),
      planCode: s.tierCode ?? null,
      planName: s.tierName ?? null,
      actionUrl: `/platform/schools/${s.schoolId}/subscription`,
    });
  }

  // Grace period active (not already captured above) — warning
  for (const s of graceSubs) {
    if (graceEndingIds.has(String(s._id))) continue;
    const days = daysUntil(s.gracePeriodEndsAt ?? null);
    alerts.push({
      schoolId: String(s.schoolId),
      schoolName: schoolNames[String(s.schoolId)] ?? "Unknown",
      alertType: "grace_period_active",
      severity: "warning",
      message: `In grace period.${days !== null ? ` Ends in ${days} day${days === 1 ? "" : "s"}.` : ""}`,
      daysRemaining: days,
      subscriptionId: String(s._id),
      planCode: s.tierCode ?? null,
      planName: s.tierName ?? null,
      actionUrl: `/platform/schools/${s.schoolId}/subscription`,
    });
  }

  // Expiring soon — warning
  for (const s of expiringSubs) {
    const days = daysUntil(s.endsAt ?? null);
    alerts.push({
      schoolId: String(s.schoolId),
      schoolName: schoolNames[String(s.schoolId)] ?? "Unknown",
      alertType: "expiring_soon",
      severity: "warning",
      message: `Subscription expiring in ${days ?? "?"} day${days === 1 ? "" : "s"}.`,
      daysRemaining: days,
      subscriptionId: String(s._id),
      planCode: s.tierCode ?? null,
      planName: s.tierName ?? null,
      actionUrl: `/platform/schools/${s.schoolId}/subscription`,
    });
  }

  // Pilot ending soon — info/warning
  for (const s of pilotEndingSubs) {
    const days = daysUntil(s.pilotEndsAt ?? null);
    alerts.push({
      schoolId: String(s.schoolId),
      schoolName: schoolNames[String(s.schoolId)] ?? "Unknown",
      alertType: "pilot_ending_soon",
      severity: days !== null && days <= 7 ? "warning" : "info",
      message: `Pilot ending in ${days ?? "?"} day${days === 1 ? "" : "s"}. Convert to paid plan.`,
      daysRemaining: days,
      subscriptionId: String(s._id),
      planCode: s.tierCode ?? null,
      planName: s.tierName ?? null,
      actionUrl: `/platform/schools/${s.schoolId}/subscription`,
    });
  }

  // No subscription — info
  for (const s of allActiveSchools.slice(0, 20)) {
    alerts.push({
      schoolId: String(s._id),
      schoolName: s.name ?? "Unknown",
      alertType: "no_subscription",
      severity: "info",
      message: "No subscription assigned.",
      daysRemaining: null,
      subscriptionId: null,
      planCode: null,
      planName: null,
      actionUrl: `/platform/schools/${s._id}/subscription`,
    });
  }

  const summary = {
    critical: alerts.filter((a) => a.severity === "critical").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    info: alerts.filter((a) => a.severity === "info").length,
    total: alerts.length,
  };

  return { alerts, summary, scannedAt: now.toISOString() };
}
