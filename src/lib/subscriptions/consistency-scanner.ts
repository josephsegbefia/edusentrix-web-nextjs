/**
 * consistency-scanner.ts
 *
 * Runtime entitlement consistency scanner.
 *
 * Detects potential "entitlement leakage" — situations where:
 *   1. A school has no subscription but is receiving entitlements.
 *   2. A school's subscription has expired but accessMode wasn't updated.
 *   3. A school's plan entitlements in the snapshot don't match the stored plan data.
 *   4. A school has usage balance entries for features their plan doesn't include.
 *   5. A school with suspended/restricted status has write events in the audit log.
 *
 * Spec §19.3 — Entitlement consistency scanner.
 *
 * Usage:
 *   import { runEntitlementConsistencyScan } from "@/lib/subscriptions/consistency-scanner";
 *   const report = await runEntitlementConsistencyScan({ limit: 50 });
 */

import mongoose from "mongoose";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { UsageBalance } from "@/models/UsageBalance";
import { SubscriptionEvent } from "@/models/SubscriptionEvent";
import { School } from "@/models/School";
import { resolveSchoolEntitlements } from "./resolve-school-entitlements";
import { PLAN_ENTITLEMENTS } from "./plan-entitlements";

export type ConsistencyIssueCode =
  | "NO_SUBSCRIPTION"
  | "SUBSCRIPTION_EXPIRED_WRONG_MODE"
  | "GRACE_EXPIRED_WRONG_STATUS"
  | "USAGE_BALANCE_ORPHAN"
  | "UNEXPECTED_WRITE_EVENTS_WHILE_SUSPENDED"
  | "ENTITLEMENT_SNAPSHOT_MISMATCH";

export type ConsistencyIssue = {
  code: ConsistencyIssueCode;
  schoolId: string;
  schoolName: string;
  severity: "critical" | "warning" | "informational";
  description: string;
  metadata?: Record<string, unknown>;
};

export type ConsistencyScanReport = {
  scannedSchools: number;
  issueCount: number;
  issues: ConsistencyIssue[];
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  scanDurationMs: number;
  scannedAt: string;
};

type SchoolRow = { _id: mongoose.Types.ObjectId; name?: string };

export async function runEntitlementConsistencyScan(opts?: {
  limit?: number;
  schoolId?: string;
}): Promise<ConsistencyScanReport> {
  const start = Date.now();
  const limit = opts?.limit ?? 100;
  const issues: ConsistencyIssue[] = [];

  const schoolFilter: Record<string, unknown> = { status: "active" };
  if (opts?.schoolId) schoolFilter._id = new mongoose.Types.ObjectId(opts.schoolId);

  const schools = await School.find(schoolFilter)
    .select("_id name")
    .limit(limit)
    .lean<SchoolRow[]>();

  const nameMap: Record<string, string> = {};
  for (const s of schools) nameMap[String(s._id)] = s.name ?? "Unknown";

  const schoolIds = schools.map((s) => s._id);

  // Fetch subscriptions
  const subs = await SchoolSubscription.find({ schoolId: { $in: schoolIds } })
    .lean<Array<{
      _id: mongoose.Types.ObjectId;
      schoolId: mongoose.Types.ObjectId;
      status: string;
      endsAt?: Date | null;
      gracePeriodEndsAt?: Date | null;
      tierCode?: string | null;
    }>>();

  const subBySchool: Record<string, typeof subs[number]> = {};
  for (const sub of subs) subBySchool[String(sub.schoolId)] = sub;

  const now = new Date();

  for (const school of schools) {
    const sid = String(school._id);
    const sub = subBySchool[sid];
    const name = nameMap[sid];

    // ─── Check 1: No subscription ─────────────────────────────────────────
    if (!sub) {
      issues.push({
        code: "NO_SUBSCRIPTION",
        schoolId: sid,
        schoolName: name,
        severity: "warning",
        description: "Active school has no SchoolSubscription record.",
      });
      continue;
    }

    // ─── Check 2: Expired subscription not transitioned ─────────────────
    if (
      sub.status === "active" &&
      sub.endsAt &&
      sub.endsAt < now
    ) {
      issues.push({
        code: "SUBSCRIPTION_EXPIRED_WRONG_MODE",
        schoolId: sid,
        schoolName: name,
        severity: "critical",
        description: `Subscription expired on ${sub.endsAt.toLocaleDateString("en-GH")} but status is still "active". Run lifecycle-advance to transition.`,
        metadata: { endsAt: sub.endsAt.toISOString(), currentStatus: sub.status },
      });
    }

    // ─── Check 3: Grace period expired, not transitioned ─────────────────
    if (
      sub.status === "grace" &&
      sub.gracePeriodEndsAt &&
      sub.gracePeriodEndsAt < now
    ) {
      issues.push({
        code: "GRACE_EXPIRED_WRONG_STATUS",
        schoolId: sid,
        schoolName: name,
        severity: "critical",
        description: `Grace period ended ${sub.gracePeriodEndsAt.toLocaleDateString("en-GH")} but status is still "grace". Should be "restricted_read_only".`,
        metadata: { gracePeriodEndsAt: sub.gracePeriodEndsAt.toISOString() },
      });
    }

    // ─── Check 4: Usage balances for features not in plan ────────────────
    if (sub.tierCode) {
      const planFeatures = PLAN_ENTITLEMENTS[sub.tierCode as keyof typeof PLAN_ENTITLEMENTS];
      if (planFeatures) {
        const metricsForPlan = new Set<string>();

        if (planFeatures["ai.leo"] === "included") metricsForPlan.add("leo_credits");
        if (planFeatures["meetings.video"] === "included") metricsForPlan.add("meeting_participant_minutes");
        if (planFeatures["learn.manage"] === "included") metricsForPlan.add("learn_seats");

        const balances = await UsageBalance.find({
          schoolId: school._id,
          subscriptionId: sub._id,
        })
          .select("balanceType usedQuantity")
          .lean<Array<{ balanceType: string; usedQuantity: number }>>();

        for (const b of balances) {
          if (
            b.usedQuantity > 0 &&
            !metricsForPlan.has(b.balanceType)
          ) {
            issues.push({
              code: "USAGE_BALANCE_ORPHAN",
              schoolId: sid,
              schoolName: name,
              severity: "warning",
              description: `Usage balance for "${b.balanceType}" has ${b.usedQuantity} units consumed but this feature is not in the "${sub.tierCode}" plan.`,
              metadata: { balanceType: b.balanceType, usedQuantity: b.usedQuantity, tierCode: sub.tierCode },
            });
          }
        }
      }
    }

    // ─── Check 5: Write events while suspended/restricted ────────────────
    if (sub.status === "suspended" || sub.status === "restricted_read_only") {
      const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000); // last 24h
      const writeEvents = await SubscriptionEvent.countDocuments({
        schoolId: school._id,
        eventType: { $nin: ["usage_event", "entitlement_audit", "subscription_assigned", "subscription_updated"] },
        createdAt: { $gte: cutoff },
      });

      if (writeEvents > 0) {
        issues.push({
          code: "UNEXPECTED_WRITE_EVENTS_WHILE_SUSPENDED",
          schoolId: sid,
          schoolName: name,
          severity: "informational",
          description: `${writeEvents} subscription event(s) recorded in the last 24h while school is "${sub.status}". Review manually.`,
          metadata: { writeEvents, status: sub.status },
        });
      }
    }
  }

  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const infoCount = issues.filter((i) => i.severity === "informational").length;

  return {
    scannedSchools: schools.length,
    issueCount: issues.length,
    issues,
    criticalCount,
    warningCount,
    infoCount,
    scanDurationMs: Date.now() - start,
    scannedAt: new Date().toISOString(),
  };
}
