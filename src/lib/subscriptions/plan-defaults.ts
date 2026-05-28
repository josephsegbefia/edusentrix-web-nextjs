import { PLAN_ENTITLEMENTS } from "./plan-entitlements";
import { isKnownPlanCode, type PlanCode } from "./plan-codes";

export function getDefaultFeaturesForPlan(code: string | null | undefined): string[] {
  if (!code || !isKnownPlanCode(code)) return [];
  const entries = PLAN_ENTITLEMENTS[code as PlanCode];
  return Object.entries(entries)
    .filter(([, level]) => level === "YES" || level === "LIMITED")
    .map(([key]) => key)
    .sort();
}

export function getFeaturePlanDiff(input: {
  code: string | null | undefined;
  features: string[] | null | undefined;
}) {
  const defaults = getDefaultFeaturesForPlan(input.code);
  const configured = Array.from(new Set(input.features ?? [])).sort();
  const defaultSet = new Set(defaults);
  const configuredSet = new Set(configured);

  return {
    defaults,
    configured,
    added: configured.filter((key) => !defaultSet.has(key)),
    removed: defaults.filter((key) => !configuredSet.has(key)),
    matchesDefault:
      configured.length === defaults.length &&
      configured.every((key, index) => key === defaults[index]),
  };
}
