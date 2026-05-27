/**
 * useSchoolSubscription
 *
 * Fetches the school's current entitlement snapshot from /api/admin/subscription.
 * Provides:
 *  - subscription details (plan, status, access mode)
 *  - hasFeature(key) — true while enforcement is off
 *  - isLocked(key) — always false while enforcement is off
 *  - accessMode
 *
 * Components that need to conditionally show locked states should use this hook.
 * Backend enforcement still lives in API route guards (P1.6).
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import type { SchoolEntitlementSnapshot } from "@/lib/subscriptions/resolve-school-entitlements";
import { assertKnownFeatureKey } from "@/lib/subscriptions/feature-keys";

export type SubscriptionSnapshot = Omit<SchoolEntitlementSnapshot, "hasFeature" | "getLimit"> & {
  features: string[];
  limits: Record<string, number | null>;
};

const FRONTEND_GATES_ENABLED =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_SUBSCRIPTION_FRONTEND_GATES_ENABLED === "true";

async function fetchSubscription(): Promise<SubscriptionSnapshot> {
  const res = await fetch("/api/admin/subscription", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch subscription");
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? "Subscription fetch failed");
  return json.data;
}

export function useSchoolSubscription() {
  const query = useQuery<SubscriptionSnapshot>({
    queryKey: ["school-subscription"],
    queryFn: fetchSubscription,
    staleTime: 60_000,     // 1 minute
    refetchOnWindowFocus: false,
  });

  const snapshot = query.data ?? null;
  const featureSet = new Set(snapshot?.features ?? []);

  /**
   * Returns true if the school has access to the given feature.
   * While NEXT_PUBLIC_SUBSCRIPTION_FRONTEND_GATES_ENABLED=false → always true.
   */
  function hasFeature(featureKey: string): boolean {
    if (!FRONTEND_GATES_ENABLED) return true;
    if (!assertKnownFeatureKey(featureKey)) return false;
    return featureSet.has(featureKey);
  }

  /**
   * Returns true if the feature is locked (not in the school's plan).
   * While gates are off → always false.
   */
  function isLocked(featureKey: string): boolean {
    return !hasFeature(featureKey);
  }

  /**
   * Returns the numeric limit for a key, or null if unlimited.
   * While gates are off → always null.
   */
  function getLimit(limitKey: string): number | null {
    if (!FRONTEND_GATES_ENABLED) return null;
    return snapshot?.limits?.[limitKey] ?? null;
  }

  return {
    snapshot,
    isLoading: query.isLoading,
    isError: query.isError,
    hasFeature,
    isLocked,
    getLimit,
    accessMode: snapshot?.subscription.accessMode ?? "full",
    planName: snapshot?.subscription.planName ?? null,
    status: snapshot?.subscription.status ?? "draft",
  };
}
