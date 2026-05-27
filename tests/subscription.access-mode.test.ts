/**
 * Tests for the subscription status normalizer and access-mode resolver.
 *
 * P0.9.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import {
  normaliseSubscriptionStatus,
  isKnownSubscriptionStatus,
  LEGACY_STATUS_MAP,
} from "../src/lib/subscriptions/plan-codes";
import {
  resolveAccessMode,
  canCreateInAccessMode,
  canReadInAccessMode,
  canCollectPaymentsInAccessMode,
  canUseAiInAccessMode,
  getAccessModeBannerMessage,
} from "../src/lib/subscriptions/access-mode";

// Force enforcement on for these tests so resolveAccessMode actually resolves
let originalEnforcement: string | undefined;

before(() => {
  originalEnforcement = process.env.SUBSCRIPTION_ENFORCEMENT_ENABLED;
  (process.env as Record<string, string>).SUBSCRIPTION_ENFORCEMENT_ENABLED = "true";
});

after(() => {
  if (originalEnforcement === undefined) {
    delete process.env.SUBSCRIPTION_ENFORCEMENT_ENABLED;
  } else {
    (process.env as Record<string, string>).SUBSCRIPTION_ENFORCEMENT_ENABLED = originalEnforcement;
  }
});

describe("subscription status normaliser", () => {
  it("returns 'draft' for null/undefined", () => {
    assert.equal(normaliseSubscriptionStatus(null), "draft");
    assert.equal(normaliseSubscriptionStatus(undefined), "draft");
  });

  it("passes through known statuses unchanged", () => {
    const known = ["draft", "pilot", "active", "past_due", "grace", "restricted_read_only", "suspended", "cancelled", "expired"];
    for (const s of known) {
      assert.equal(normaliseSubscriptionStatus(s), s);
    }
  });

  it("maps legacy 'trial' to 'pilot'", () => {
    assert.equal(normaliseSubscriptionStatus("trial"), "pilot");
  });

  it("maps legacy 'trialing' to 'pilot'", () => {
    assert.equal(normaliseSubscriptionStatus("trialing"), "pilot");
  });

  it("maps legacy 'archived' to 'expired'", () => {
    assert.equal(normaliseSubscriptionStatus("archived"), "expired");
  });

  it("maps unknown values to 'draft'", () => {
    assert.equal(normaliseSubscriptionStatus("unknown_status"), "draft");
  });

  it("isKnownSubscriptionStatus returns true for valid statuses", () => {
    assert.ok(isKnownSubscriptionStatus("active"));
    assert.ok(isKnownSubscriptionStatus("grace"));
    assert.ok(isKnownSubscriptionStatus("suspended"));
  });

  it("isKnownSubscriptionStatus returns false for legacy/unknown", () => {
    assert.equal(isKnownSubscriptionStatus("trial"), false);
    assert.equal(isKnownSubscriptionStatus("trialing"), false);
    assert.equal(isKnownSubscriptionStatus("archived"), false);
    assert.equal(isKnownSubscriptionStatus("random"), false);
  });

  it("LEGACY_STATUS_MAP contains expected entries", () => {
    assert.equal(LEGACY_STATUS_MAP["trial"], "pilot");
    assert.equal(LEGACY_STATUS_MAP["trialing"], "pilot");
    assert.equal(LEGACY_STATUS_MAP["archived"], "expired");
  });
});

describe("access mode resolver (enforcement on)", () => {
  it("active subscription → full", () => {
    const mode = resolveAccessMode({ status: "active", planCode: "growth", gracePeriodEndsAt: null, pilotEndsAt: null, endsAt: null });
    assert.equal(mode, "full");
  });

  it("pilot subscription with future pilotEndsAt → pilot_limited", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const mode = resolveAccessMode({
      status: "pilot",
      planCode: "pilot",
      gracePeriodEndsAt: null,
      pilotEndsAt: future,
      endsAt: null,
    });
    assert.equal(mode, "pilot_limited");
  });

  it("pilot subscription with expired pilotEndsAt → grace", () => {
    const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const mode = resolveAccessMode({
      status: "pilot",
      planCode: "pilot",
      gracePeriodEndsAt: null,
      pilotEndsAt: past,
      endsAt: null,
    });
    assert.equal(mode, "grace");
  });

  it("past_due → grace", () => {
    const mode = resolveAccessMode({ status: "past_due", planCode: "starter", gracePeriodEndsAt: null, pilotEndsAt: null, endsAt: null });
    assert.equal(mode, "grace");
  });

  it("grace status with future gracePeriodEndsAt → grace", () => {
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const mode = resolveAccessMode({
      status: "grace",
      planCode: "growth",
      gracePeriodEndsAt: future,
      pilotEndsAt: null,
      endsAt: null,
    });
    assert.equal(mode, "grace");
  });

  it("grace status with past gracePeriodEndsAt → restricted_read_only", () => {
    const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const mode = resolveAccessMode({
      status: "grace",
      planCode: "growth",
      gracePeriodEndsAt: past,
      pilotEndsAt: null,
      endsAt: null,
    });
    assert.equal(mode, "restricted_read_only");
  });

  it("suspended → suspended", () => {
    const mode = resolveAccessMode({ status: "suspended", planCode: "starter", gracePeriodEndsAt: null, pilotEndsAt: null, endsAt: null });
    assert.equal(mode, "suspended");
  });

  it("cancelled with active grace → grace", () => {
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const mode = resolveAccessMode({
      status: "cancelled",
      planCode: "growth",
      gracePeriodEndsAt: future,
      pilotEndsAt: null,
      endsAt: null,
    });
    assert.equal(mode, "grace");
  });

  it("cancelled without grace → restricted_read_only", () => {
    const mode = resolveAccessMode({
      status: "cancelled",
      planCode: "growth",
      gracePeriodEndsAt: null,
      pilotEndsAt: null,
      endsAt: null,
    });
    assert.equal(mode, "restricted_read_only");
  });

  it("draft → restricted_read_only", () => {
    const mode = resolveAccessMode({ status: "draft", planCode: null, gracePeriodEndsAt: null, pilotEndsAt: null, endsAt: null });
    assert.equal(mode, "restricted_read_only");
  });
});

describe("access mode capability helpers", () => {
  it("canCreateInAccessMode: full and grace allow creation", () => {
    assert.ok(canCreateInAccessMode("full"));
    assert.ok(canCreateInAccessMode("pilot_limited"));
    assert.ok(canCreateInAccessMode("grace"));
  });

  it("canCreateInAccessMode: restricted_read_only and suspended block creation", () => {
    assert.equal(canCreateInAccessMode("restricted_read_only"), false);
    assert.equal(canCreateInAccessMode("suspended"), false);
  });

  it("canReadInAccessMode: all modes except suspended allow reads", () => {
    assert.ok(canReadInAccessMode("full"));
    assert.ok(canReadInAccessMode("grace"));
    assert.ok(canReadInAccessMode("restricted_read_only"));
    assert.ok(canReadInAccessMode("pilot_limited"));
    assert.equal(canReadInAccessMode("suspended"), false);
  });

  it("canCollectPaymentsInAccessMode: not suspended can collect", () => {
    assert.ok(canCollectPaymentsInAccessMode("full"));
    assert.ok(canCollectPaymentsInAccessMode("grace"));
    assert.ok(canCollectPaymentsInAccessMode("restricted_read_only"));
    assert.equal(canCollectPaymentsInAccessMode("suspended"), false);
  });

  it("canUseAiInAccessMode: only full and pilot_limited", () => {
    assert.ok(canUseAiInAccessMode("full"));
    assert.ok(canUseAiInAccessMode("pilot_limited"));
    assert.equal(canUseAiInAccessMode("grace"), false);
    assert.equal(canUseAiInAccessMode("restricted_read_only"), false);
    assert.equal(canUseAiInAccessMode("suspended"), false);
  });
});

describe("access mode banner messages", () => {
  it("returns null for full access", () => {
    assert.equal(getAccessModeBannerMessage("full"), null);
  });

  it("returns a message for grace", () => {
    const msg = getAccessModeBannerMessage("grace");
    assert.ok(typeof msg === "string" && msg.length > 0);
    assert.ok(msg.includes("grace"));
  });

  it("includes grace end date when provided", () => {
    const msg = getAccessModeBannerMessage("grace", "2026-07-15T00:00:00.000Z");
    assert.ok(msg?.includes("2026") || msg?.includes("Jul") || msg?.includes("15"));
  });

  it("returns a message for restricted_read_only", () => {
    const msg = getAccessModeBannerMessage("restricted_read_only");
    assert.ok(typeof msg === "string" && msg.length > 0);
  });

  it("returns a message for suspended", () => {
    const msg = getAccessModeBannerMessage("suspended");
    assert.ok(typeof msg === "string" && msg.length > 0);
  });

  it("returns a message for pilot_limited", () => {
    const msg = getAccessModeBannerMessage("pilot_limited");
    assert.ok(typeof msg === "string" && msg.length > 0);
  });
});
