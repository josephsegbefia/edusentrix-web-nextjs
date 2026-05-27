/**
 * Tests for subscription pricing helpers — Slice 21 §19.
 *
 * Covers:
 *  - computeSubscriptionPricing: per-student formula, manual override, discounts
 *  - normalizeSubscriptionStatus: trial alias, unknown → draft
 *  - Grace/read-only lifecycle rules
 *
 * Run: npx tsx --test tests/subscription.pricing.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  computeSubscriptionPricing,
  normalizeSubscriptionStatus,
  isActiveSubscriptionStatus,
} from "../src/lib/platform-billing/subscription-pricing";

describe("computeSubscriptionPricing — base pricing", () => {
  it("returns baseTierPriceMinor as finalPrice when no override or discount", () => {
    const result = computeSubscriptionPricing({ basePriceMinor: 100_000 });
    assert.equal(result.baseTierPriceMinor, 100_000);
    assert.equal(result.finalPriceMinor, 100_000);
    assert.equal(result.discountAmountMinor, 0);
  });

  it("clamps negative basePriceMinor to 0", () => {
    const result = computeSubscriptionPricing({ basePriceMinor: -500 });
    assert.equal(result.baseTierPriceMinor, 0);
    assert.equal(result.finalPriceMinor, 0);
  });

  it("rounds fractional basePriceMinor", () => {
    const result = computeSubscriptionPricing({ basePriceMinor: 100_050.7 });
    assert.equal(result.baseTierPriceMinor, 100_051);
  });
});

describe("computeSubscriptionPricing — manual price override", () => {
  it("uses manualPriceOverrideMinor instead of base when provided", () => {
    const result = computeSubscriptionPricing({
      basePriceMinor: 100_000,
      manualPriceOverrideMinor: 75_000,
    });
    assert.equal(result.effectiveBasePriceMinor, 75_000);
    assert.equal(result.finalPriceMinor, 75_000);
  });

  it("ignores null manual price — uses base", () => {
    const result = computeSubscriptionPricing({
      basePriceMinor: 100_000,
      manualPriceOverrideMinor: null,
    });
    assert.equal(result.effectiveBasePriceMinor, 100_000);
  });

  it("ignores non-finite manual price — uses base", () => {
    const result = computeSubscriptionPricing({
      basePriceMinor: 100_000,
      manualPriceOverrideMinor: NaN,
    });
    assert.equal(result.effectiveBasePriceMinor, 100_000);
  });

  it("clamps negative manual price to 0", () => {
    const result = computeSubscriptionPricing({
      basePriceMinor: 100_000,
      manualPriceOverrideMinor: -1,
    });
    assert.equal(result.effectiveBasePriceMinor, 0);
  });
});

describe("computeSubscriptionPricing — percent discount", () => {
  it("applies 10% discount correctly", () => {
    const result = computeSubscriptionPricing({
      basePriceMinor: 100_000,
      discountMode: "percent",
      discountValue: 10,
    });
    assert.equal(result.discountAmountMinor, 10_000);
    assert.equal(result.finalPriceMinor, 90_000);
  });

  it("caps percent discount at 100% — no negative price", () => {
    const result = computeSubscriptionPricing({
      basePriceMinor: 100_000,
      discountMode: "percent",
      discountValue: 150,
    });
    assert.equal(result.finalPriceMinor, 0);
    assert.ok(result.finalPriceMinor >= 0);
  });

  it("0% discount leaves price unchanged", () => {
    const result = computeSubscriptionPricing({
      basePriceMinor: 100_000,
      discountMode: "percent",
      discountValue: 0,
    });
    assert.equal(result.discountAmountMinor, 0);
    assert.equal(result.finalPriceMinor, 100_000);
  });
});

describe("computeSubscriptionPricing — fixed discount", () => {
  it("applies GHS 10,000 fixed discount correctly", () => {
    const result = computeSubscriptionPricing({
      basePriceMinor: 100_000,
      discountMode: "fixed",
      discountValue: 10_000,
    });
    assert.equal(result.discountAmountMinor, 10_000);
    assert.equal(result.finalPriceMinor, 90_000);
  });

  it("caps fixed discount at base price — no negative price", () => {
    const result = computeSubscriptionPricing({
      basePriceMinor: 100_000,
      discountMode: "fixed",
      discountValue: 999_999,
    });
    assert.equal(result.finalPriceMinor, 0);
  });

  it("ignores discount when mode is none", () => {
    const result = computeSubscriptionPricing({
      basePriceMinor: 100_000,
      discountMode: "none",
      discountValue: 50_000,
    });
    assert.equal(result.discountAmountMinor, 0);
    assert.equal(result.finalPriceMinor, 100_000);
  });
});

describe("computeSubscriptionPricing — discount applied on top of manual override", () => {
  it("applies percent discount to manual override, not base", () => {
    const result = computeSubscriptionPricing({
      basePriceMinor: 200_000,
      manualPriceOverrideMinor: 100_000,
      discountMode: "percent",
      discountValue: 25,
    });
    // 25% of 100_000 = 25_000; final = 75_000
    assert.equal(result.effectiveBasePriceMinor, 100_000);
    assert.equal(result.discountAmountMinor, 25_000);
    assert.equal(result.finalPriceMinor, 75_000);
  });
});

describe("normalizeSubscriptionStatus", () => {
  it("maps 'trial' to 'trialing'", () => {
    assert.equal(normalizeSubscriptionStatus("trial"), "trialing");
  });

  it("preserves known statuses unchanged", () => {
    const known = [
      "draft",
      "trialing",
      "pilot",
      "active",
      "past_due",
      "grace",
      "restricted_read_only",
      "suspended",
      "cancelled",
      "expired",
      "archived",
    ] as const;
    for (const s of known) {
      assert.equal(normalizeSubscriptionStatus(s), s, `"${s}" should remain unchanged`);
    }
  });

  it("maps unknown strings to 'draft'", () => {
    assert.equal(normalizeSubscriptionStatus("foobar"), "draft");
    assert.equal(normalizeSubscriptionStatus(""), "draft");
    assert.equal(normalizeSubscriptionStatus(undefined), "draft");
    assert.equal(normalizeSubscriptionStatus(null), "draft");
  });
});

describe("isActiveSubscriptionStatus", () => {
  it("returns true for active status", () => {
    assert.equal(isActiveSubscriptionStatus("active"), true);
  });

  it("returns true for pilot", () => {
    assert.equal(isActiveSubscriptionStatus("pilot"), true);
  });

  it("returns true for trialing", () => {
    assert.equal(isActiveSubscriptionStatus("trialing"), true);
  });

  it("returns false for grace (access limited)", () => {
    assert.equal(isActiveSubscriptionStatus("grace"), false);
  });

  it("returns false for restricted_read_only", () => {
    assert.equal(isActiveSubscriptionStatus("restricted_read_only"), false);
  });

  it("returns false for suspended", () => {
    assert.equal(isActiveSubscriptionStatus("suspended"), false);
  });

  it("returns false for expired", () => {
    assert.equal(isActiveSubscriptionStatus("expired"), false);
  });

  it("returns false for draft", () => {
    assert.equal(isActiveSubscriptionStatus("draft"), false);
  });
});
