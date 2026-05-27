/**
 * Server-side page-level feature gate.
 *
 * Usage in a Next.js server component (page.tsx):
 *
 *   import { requirePageFeature } from "@/lib/subscriptions/require-page-feature";
 *   import { FEATURE_KEYS } from "@/lib/subscriptions/feature-keys";
 *
 *   export default async function SchemesPage() {
 *     const gate = await requirePageFeature(FEATURE_KEYS.ACADEMICS_SCHEMES);
 *     if (gate) return gate;
 *     // ... rest of page
 *   }
 *
 * While SUBSCRIPTION_FRONTEND_GATES_ENABLED=false → always returns null (no gate).
 * While SUBSCRIPTION_ENFORCEMENT_ENABLED=false → resolver returns all features enabled.
 */

import "server-only";
import * as React from "react";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { resolveSchoolEntitlements } from "@/lib/subscriptions/resolve-school-entitlements";
import { LockedModulePage } from "@/components/subscriptions/LockedModulePage";
import type { FeatureKey } from "@/lib/subscriptions/feature-keys";

const FRONTEND_GATES_ENABLED =
  process.env.SUBSCRIPTION_FRONTEND_GATES_ENABLED === "true";

/**
 * Returns a React element (locked page) if the feature is not available,
 * or null if the school has access.
 *
 * Handles enforcement flags, no-subscription state, and missing school gracefully.
 */
export async function requirePageFeature(
  featureKey: FeatureKey
): Promise<React.ReactElement | null> {
  if (!FRONTEND_GATES_ENABLED) return null;

  const user = await getCurrentUser();
  if (!user?.schoolId) return null; // can't check without schoolId

  const snapshot = await resolveSchoolEntitlements(user.schoolId);
  if (!snapshot) return null;

  if (snapshot.hasFeature(featureKey)) return null;

  return React.createElement(LockedModulePage, {
    featureKey,
    currentPlanName: snapshot.subscription.planName,
    enforcementEnabled: FRONTEND_GATES_ENABLED,
  });
}
