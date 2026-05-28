/**
 * Tests for the limit key registry and plan limit defaults.
 *
 * P0.9.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  LIMIT_KEYS,
  DEFAULT_PLAN_LIMITS,
  isKnownLimitKey,
  ONE_GB,
} from "../src/lib/subscriptions/limit-keys";
import { PLAN_CODES } from "../src/lib/subscriptions/plan-codes";

describe("limit-keys registry", () => {
  it("exports a non-empty LIMIT_KEYS object", () => {
    assert.ok(Object.keys(LIMIT_KEYS).length > 0);
  });

  it("no duplicate LIMIT_KEYS values", () => {
    const values = Object.values(LIMIT_KEYS);
    const unique = new Set(values);
    assert.equal(unique.size, values.length, "LIMIT_KEYS must not have duplicate values");
  });

  it("isKnownLimitKey returns true for all registered keys", () => {
    for (const key of Object.values(LIMIT_KEYS)) {
      assert.ok(isKnownLimitKey(key), `isKnownLimitKey should return true for "${key}"`);
    }
  });

  it("isKnownLimitKey returns false for unknown keys", () => {
    assert.equal(isKnownLimitKey("maxUsers"), false);
    assert.equal(isKnownLimitKey(""), false);
    assert.equal(isKnownLimitKey("studentLimit"), false);
  });
});

describe("DEFAULT_PLAN_LIMITS", () => {
  const allPlanCodes = Object.values(PLAN_CODES);
  const allLimitKeys = Object.values(LIMIT_KEYS);

  it("every plan has a limit entry for every limit key", () => {
    const missing: string[] = [];
    for (const plan of allPlanCodes) {
      for (const key of allLimitKeys) {
        const val = DEFAULT_PLAN_LIMITS[plan]?.[key];
        if (val === undefined) {
          missing.push(`${plan}.${key}`);
        }
      }
    }
    assert.deepEqual(missing, [], `Missing plan limit defaults: ${missing.join(", ")}`);
  });

  it("Starter maxStudents is 500", () => {
    assert.equal(DEFAULT_PLAN_LIMITS.starter.maxStudents, 500);
  });

  it("Growth maxStudents is 1500", () => {
    assert.equal(DEFAULT_PLAN_LIMITS.growth.maxStudents, 1500);
  });

  it("Enterprise maxStudents is null (unlimited)", () => {
    assert.equal(DEFAULT_PLAN_LIMITS.enterprise.maxStudents, null);
  });

  it("Starter has no Leo credits (0)", () => {
    assert.equal(DEFAULT_PLAN_LIMITS.starter.leoCreditsPerTerm, 0);
  });

  it("Growth has 500 Leo credits per term", () => {
    assert.equal(DEFAULT_PLAN_LIMITS.growth.leoCreditsPerTerm, 500);
  });

  it("Enterprise has 2500 Leo credits per term", () => {
    assert.equal(DEFAULT_PLAN_LIMITS.enterprise.leoCreditsPerTerm, 2500);
  });

  it("Pilot maxStudents is 0 (must be set explicitly)", () => {
    assert.equal(DEFAULT_PLAN_LIMITS.pilot.maxStudents, 0);
  });

  it("Starter storage is 5GB", () => {
    assert.equal(DEFAULT_PLAN_LIMITS.starter.maxStorageBytes, 5 * ONE_GB);
  });

  it("Growth storage is 25GB", () => {
    assert.equal(DEFAULT_PLAN_LIMITS.growth.maxStorageBytes, 25 * ONE_GB);
  });

  it("Enterprise storage is 100GB", () => {
    assert.equal(DEFAULT_PLAN_LIMITS.enterprise.maxStorageBytes, 100 * ONE_GB);
  });

  it("all limit values are number | null (no strings)", () => {
    for (const plan of allPlanCodes) {
      for (const [key, val] of Object.entries(DEFAULT_PLAN_LIMITS[plan])) {
        assert.ok(
          val === null || typeof val === "number",
          `DEFAULT_PLAN_LIMITS.${plan}.${key} must be number or null, got ${typeof val}`
        );
      }
    }
  });
});
