#!/usr/bin/env tsx
/**
 * audit-entitlements.ts
 *
 * Runs a plan matrix consistency check:
 * 1. Starter cannot access Growth/Enterprise-only features.
 * 2. Growth cannot access Enterprise-only features unless explicitly included.
 * 3. Pilot cannot access anything not explicitly enabled.
 * 4. Unknown feature keys are denied.
 * 5. Every FEATURE_KEYS value is present in PLAN_ENTITLEMENTS.
 *
 * Run:   npx tsx scripts/audit-entitlements.ts
 */

import { FEATURE_KEYS, isKnownFeatureKey } from "../src/lib/subscriptions/feature-keys";
import { PLAN_ENTITLEMENTS, PlanAccessLevel } from "../src/lib/subscriptions/plan-entitlements";
import { PLAN_CODES } from "../src/lib/subscriptions/plan-codes";

type Issue = { kind: string; feature: string; detail: string };
const issues: Issue[] = [];

const allKeys = Object.values(FEATURE_KEYS);

// ---------------------------------------------------------------------------
// 1. Every canonical key is in the plan matrix
// ---------------------------------------------------------------------------
for (const key of allKeys) {
  for (const plan of Object.values(PLAN_CODES)) {
    const entry = PLAN_ENTITLEMENTS[plan]?.[key];
    if (entry === undefined) {
      issues.push({
        kind: "MISSING_PLAN_DECISION",
        feature: key,
        detail: `Feature "${key}" has no access decision for plan "${plan}".`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Pilot is deny-by-default
// ---------------------------------------------------------------------------
const pilotEntitlements = PLAN_ENTITLEMENTS.pilot;
for (const [key, access] of Object.entries(pilotEntitlements)) {
  if (access === "YES") {
    issues.push({
      kind: "PILOT_AUTO_YES",
      feature: key,
      detail: `Pilot grants "${key}" as YES. Pilot must be OPTIONAL or NO unless explicitly designed.`,
    });
  }
}

// ---------------------------------------------------------------------------
// 3. Starter must not include Growth/Enterprise-only academic/AI features
// ---------------------------------------------------------------------------
const STARTER_FORBIDDEN = [
  FEATURE_KEYS.ACADEMICS_SCHEMES,
  FEATURE_KEYS.ACADEMICS_LESSON_NOTES,
  FEATURE_KEYS.ACADEMICS_LESSONS,
  FEATURE_KEYS.ACADEMICS_CURRICULUM,
  FEATURE_KEYS.ASSESSMENT_EXAMINATIONS,
  FEATURE_KEYS.ASSESSMENT_QUESTION_BANK,
  FEATURE_KEYS.AI_LEO,
  FEATURE_KEYS.AI_LESSON_GENERATION,
  FEATURE_KEYS.AI_EXAM_GENERATION,
  FEATURE_KEYS.LEARN_MANAGE,
  FEATURE_KEYS.MEETINGS_VIDEO,
  FEATURE_KEYS.ANALYTICS_ADVANCED,
];

for (const key of STARTER_FORBIDDEN) {
  const access = PLAN_ENTITLEMENTS.starter?.[key];
  if (access === "YES" || access === "LIMITED") {
    issues.push({
      kind: "STARTER_LEAKAGE",
      feature: key,
      detail: `Starter grants "${key}" as "${access}" but this should be NO for Starter.`,
    });
  }
}

// ---------------------------------------------------------------------------
// 4. Growth must not include Enterprise-only full features
// ---------------------------------------------------------------------------
const GROWTH_FORBIDDEN_AS_YES = [
  FEATURE_KEYS.ANALYTICS_ADVANCED,
];

for (const key of GROWTH_FORBIDDEN_AS_YES) {
  const access = PLAN_ENTITLEMENTS.growth?.[key];
  if (access === "YES") {
    issues.push({
      kind: "GROWTH_ENTERPRISE_LEAKAGE",
      feature: key,
      detail: `Growth grants "${key}" as YES but this is Enterprise-only. Use LIMITED or NO.`,
    });
  }
}

// ---------------------------------------------------------------------------
// 5. No unknown keys in plan matrix
// ---------------------------------------------------------------------------
for (const plan of Object.values(PLAN_CODES)) {
  const entries = PLAN_ENTITLEMENTS[plan] ?? {};
  for (const key of Object.keys(entries)) {
    if (!isKnownFeatureKey(key)) {
      issues.push({
        kind: "UNKNOWN_KEY_IN_MATRIX",
        feature: key,
        detail: `Plan matrix for "${plan}" contains unknown key "${key}".`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
if (issues.length === 0) {
  console.log("✅  audit:entitlements — plan matrix is consistent.");
  process.exit(0);
}

console.error(`\n❌  audit:entitlements — found ${issues.length} issue(s):\n`);
for (const issue of issues) {
  console.error(`  [${issue.kind}] ${issue.feature}`);
  console.error(`    ${issue.detail}`);
}
console.error();
process.exit(1);
