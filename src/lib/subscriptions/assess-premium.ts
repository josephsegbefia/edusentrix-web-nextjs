import mongoose from "mongoose";
import { FEATURE_KEYS } from "./feature-keys";
import { resolveSchoolEntitlements } from "./resolve-school-entitlements";
import type { GuardResult } from "./guards";
import { evaluateAssessPremiumPublicationEntitlement } from "./assess-premium-policy";

/**
 * Premium Assess publication deliberately fails closed until the subscription
 * gate infrastructure is actively enforcing plan entitlements. This prevents
 * the existing global "gates off" compatibility mode from granting a new
 * Premium mutation to every school.
 */
export async function requireAssessPremiumPublication(
  schoolId: string | mongoose.Types.ObjectId
): Promise<GuardResult> {
  const enforcementEnabled = process.env.SUBSCRIPTION_ENFORCEMENT_ENABLED === "true";
  const apiGatesEnabled = process.env.SUBSCRIPTION_API_GATES_ENABLED === "true";
  if (!enforcementEnabled || !apiGatesEnabled) {
    return evaluateAssessPremiumPublicationEntitlement({
      enforcementEnabled,
      apiGatesEnabled,
      schoolStatus: "unknown",
      planCode: null,
      accessMode: "restricted_read_only",
      featureEnabled: false,
    });
  }

  const snapshot = await resolveSchoolEntitlements(schoolId);
	if (!snapshot) {
		return { allowed: false, reason: "School not found.", statusCode: 403 };
	}
  const decision = evaluateAssessPremiumPublicationEntitlement({
    enforcementEnabled,
    apiGatesEnabled,
		schoolStatus: snapshot.schoolStatus,
		planCode: snapshot.subscription.planCode,
		accessMode: snapshot.subscription.accessMode,
		featureEnabled: snapshot.hasFeature(FEATURE_KEYS.ASSESSMENT_PREMIUM_PUBLICATION),
	});
	return decision.allowed ? { ...decision, snapshot } : decision;
}
