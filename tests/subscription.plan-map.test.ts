/**
 * Tests for the plan entitlement map.
 *
 * P0.9 — verifies:
 * - Every plan has a decision for every feature key.
 * - Starter does not include Growth/Enterprise-only features.
 * - Growth does not include Enterprise-only advanced analytics.
 * - Pilot is OPTIONAL-only (no YES).
 * - getPlanAccess returns "NO" for unknown plan or null plan.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { FEATURE_KEYS } from "../src/lib/subscriptions/feature-keys";
import { PLAN_ENTITLEMENTS, getPlanAccess } from "../src/lib/subscriptions/plan-entitlements";
import { PLAN_CODES } from "../src/lib/subscriptions/plan-codes";

const ALL_PLAN_CODES = Object.values(PLAN_CODES);
const ALL_FEATURE_KEYS = Object.values(FEATURE_KEYS);

describe("plan-entitlements map", () => {
  it("every plan code has an entry in PLAN_ENTITLEMENTS", () => {
    for (const plan of ALL_PLAN_CODES) {
      assert.ok(
        PLAN_ENTITLEMENTS[plan],
        `PLAN_ENTITLEMENTS missing entry for plan "${plan}"`
      );
    }
  });

  it("every feature key has a decision in every plan", () => {
    const missing: string[] = [];
    for (const plan of ALL_PLAN_CODES) {
      for (const key of ALL_FEATURE_KEYS) {
        if (PLAN_ENTITLEMENTS[plan]?.[key] === undefined) {
          missing.push(`${plan}.${key}`);
        }
      }
    }
    assert.deepEqual(missing, [], `Missing plan decisions: ${missing.join(", ")}`);
  });

  it("all access level values are valid strings", () => {
    const valid = new Set(["YES", "LIMITED", "OPTIONAL", "NO"]);
    for (const plan of ALL_PLAN_CODES) {
      for (const [key, level] of Object.entries(PLAN_ENTITLEMENTS[plan])) {
        assert.ok(
          valid.has(level as string),
          `Invalid access level "${level}" for ${plan}.${key}`
        );
      }
    }
  });

  it("Pilot plan has no YES access levels", () => {
    const pilotYes = Object.entries(PLAN_ENTITLEMENTS.pilot)
      .filter(([, v]) => v === "YES")
      .map(([k]) => k);
    assert.deepEqual(
      pilotYes,
      [],
      `Pilot plan should not have YES features: ${pilotYes.join(", ")}`
    );
  });

  it("Starter does not include schemes of learning", () => {
    const level = PLAN_ENTITLEMENTS.starter[FEATURE_KEYS.ACADEMICS_SCHEMES];
    assert.equal(level, "NO", "Starter should not include schemes of learning");
  });

  it("Starter does not include lesson notes", () => {
    const level = PLAN_ENTITLEMENTS.starter[FEATURE_KEYS.ACADEMICS_LESSON_NOTES];
    assert.equal(level, "NO", "Starter should not include lesson notes");
  });

  it("Starter does not include Leo AI", () => {
    const level = PLAN_ENTITLEMENTS.starter[FEATURE_KEYS.AI_LEO];
    assert.equal(level, "NO", "Starter should not include Leo AI");
  });

  it("Starter does not include examinations", () => {
    const level = PLAN_ENTITLEMENTS.starter[FEATURE_KEYS.ASSESSMENT_EXAMINATIONS];
    assert.equal(level, "NO", "Starter should not include examinations");
  });

  it("Starter does not include Learn management", () => {
    const level = PLAN_ENTITLEMENTS.starter[FEATURE_KEYS.LEARN_MANAGE];
    assert.equal(level, "NO", "Starter should not include Learn manage");
  });

  it("Growth includes lesson notes", () => {
    const level = PLAN_ENTITLEMENTS.growth[FEATURE_KEYS.ACADEMICS_LESSON_NOTES];
    assert.ok(level === "YES" || level === "LIMITED", "Growth should include lesson notes");
  });

  it("Growth includes schemes of learning", () => {
    const level = PLAN_ENTITLEMENTS.growth[FEATURE_KEYS.ACADEMICS_SCHEMES];
    assert.ok(level === "YES" || level === "LIMITED", "Growth should include schemes");
  });

  it("Growth does not give unlimited advanced analytics (must be LIMITED or NO)", () => {
    const level = PLAN_ENTITLEMENTS.growth[FEATURE_KEYS.ANALYTICS_ADVANCED];
    assert.notEqual(level, "YES", "Growth should not have full YES advanced analytics");
  });

  it("Enterprise includes advanced analytics YES", () => {
    const level = PLAN_ENTITLEMENTS.enterprise[FEATURE_KEYS.ANALYTICS_ADVANCED];
    assert.equal(level, "YES", "Enterprise must have YES advanced analytics");
  });

  it("Enterprise includes meetings video (LIMITED — has allowance)", () => {
    const level = PLAN_ENTITLEMENTS.enterprise[FEATURE_KEYS.MEETINGS_VIDEO];
    assert.ok(level === "YES" || level === "LIMITED", "Enterprise should include meetings");
  });

  it("Enterprise includes priority support", () => {
    const level = PLAN_ENTITLEMENTS.enterprise[FEATURE_KEYS.SUPPORT_PRIORITY];
    assert.equal(level, "YES", "Enterprise must have priority support");
  });

  it("Growth includes priority support", () => {
    const level = PLAN_ENTITLEMENTS.growth[FEATURE_KEYS.SUPPORT_PRIORITY];
    assert.equal(level, "YES", "Growth must have priority support");
  });

  it("Starter does not have priority support", () => {
    const level = PLAN_ENTITLEMENTS.starter[FEATURE_KEYS.SUPPORT_PRIORITY];
    assert.equal(level, "NO", "Starter should not have priority support");
  });

  it("getPlanAccess returns NO for null plan", () => {
    const level = getPlanAccess(null, FEATURE_KEYS.AI_LEO);
    assert.equal(level, "NO");
  });

  it("getPlanAccess returns NO for undefined plan", () => {
    const level = getPlanAccess(undefined, FEATURE_KEYS.AI_LEO);
    assert.equal(level, "NO");
  });

  it("getPlanAccess returns correct level for known plan+feature", () => {
    assert.equal(getPlanAccess("growth", FEATURE_KEYS.ACADEMICS_LESSON_NOTES), "YES");
    assert.equal(getPlanAccess("starter", FEATURE_KEYS.ACADEMICS_LESSON_NOTES), "NO");
    assert.equal(getPlanAccess("enterprise", FEATURE_KEYS.ANALYTICS_ADVANCED), "YES");
  });
});
