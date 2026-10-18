import { canCreateInAccessMode, type SchoolAccessMode } from "./access-mode";
import type { GuardResult } from "./guards";

export type AssessPremiumPublicationDecisionInput = {
  enforcementEnabled: boolean;
  apiGatesEnabled: boolean;
  schoolStatus: string;
  planCode: string | null;
  accessMode: SchoolAccessMode;
  featureEnabled: boolean;
};

export function evaluateAssessPremiumPublicationEntitlement(
  input: AssessPremiumPublicationDecisionInput,
): GuardResult {
  if (!input.enforcementEnabled || !input.apiGatesEnabled) {
    return {
      allowed: false,
      reason: "Premium Assess publication entitlement enforcement is not enabled.",
      statusCode: 403,
    };
  }
  if (input.schoolStatus !== "active") {
    return {
      allowed: false,
      reason: "Premium Assess publication requires an active school.",
      statusCode: 403,
    };
  }
  if (input.planCode !== "enterprise") {
    return {
      allowed: false,
      reason: "Premium Assess publication requires an Enterprise entitlement.",
      statusCode: 403,
    };
  }
  if (!canCreateInAccessMode(input.accessMode)) {
    return {
      allowed: false,
      reason: "Premium Assess publication is unavailable in the current subscription access mode.",
      statusCode: 403,
    };
  }
  if (!input.featureEnabled) {
    return {
      allowed: false,
      reason: "Your current plan does not include Premium Assess publication.",
      statusCode: 403,
    };
  }
  return { allowed: true };
}
