import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  computeSubscriptionPricing,
  normalizeSubscriptionStatus,
} from "@/lib/platform-billing/subscription-pricing";
import {
  resolveAccessModeFromSubscription,
} from "@/lib/billing/resolve-school-access-mode";
import { inferUsageCategory } from "@/lib/billing/entitlements";
import { buildUsageEventDocument } from "@/lib/billing/record-usage-event";

test("legacy trial status normalizes to trialing", () => {
  assert.equal(normalizeSubscriptionStatus("trial"), "trialing");
  assert.equal(normalizeSubscriptionStatus("active"), "active");
  assert.equal(normalizeSubscriptionStatus("unknown"), "draft");
});

test("access mode moves ended subscription through grace then read-only", () => {
  const now = new Date("2026-05-11T00:00:00.000Z");
  assert.equal(
    resolveAccessModeFromSubscription(
      {
        status: "active",
        endsAt: new Date("2026-05-10T00:00:00.000Z"),
        gracePeriodEndsAt: new Date("2026-05-20T00:00:00.000Z"),
      },
      now
    ),
    "grace"
  );
  assert.equal(
    resolveAccessModeFromSubscription(
      {
        status: "active",
        endsAt: new Date("2026-05-01T00:00:00.000Z"),
        gracePeriodEndsAt: new Date("2026-05-05T00:00:00.000Z"),
      },
      now
    ),
    "restricted_read_only"
  );
});

test("pricing applies manual override before discount", () => {
  const pricing = computeSubscriptionPricing({
    basePriceMinor: 300000,
    manualPriceOverrideMinor: 250000,
    discountMode: "percent",
    discountValue: 10,
  });
  assert.equal(pricing.effectiveBasePriceMinor, 250000);
  assert.equal(pricing.discountAmountMinor, 25000);
  assert.equal(pricing.finalPriceMinor, 225000);
});

test("usage categories are inferred for common costly metrics", () => {
  assert.equal(inferUsageCategory({ provider: "openai", metricKey: "total_tokens" }), "ai");
  assert.equal(
    inferUsageCategory({ provider: "uploadthing", metricKey: "uploaded_bytes" }),
    "storage"
  );
  assert.equal(
    inferUsageCategory({ provider: "paystack", metricKey: "payment_volume" }),
    "payment"
  );
});

test("usage event document normalizes quantity and estimated cost", () => {
  const doc = buildUsageEventDocument({
    schoolId: "691e2b19e7028b7503607059",
    provider: "openai",
    category: "ai",
    metricKey: "total_tokens",
    quantity: 2000,
    unitLabel: "tokens",
    unitCostMinor: 2,
  });
  assert.equal(doc.quantity, 2000);
  assert.equal(doc.estimatedCostMinor, 4000);
  assert.equal(doc.unitLabel, "tokens");
});
