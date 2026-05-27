/**
 * Extended tests for the access mode resolver — Slice 21 §19.
 *
 * Tests enforced behavior when SUBSCRIPTION_ENFORCEMENT_ENABLED=true.
 * Uses process.env mock pattern to activate enforcement.
 *
 * Run: npx tsx --test tests/subscription.access-mode-extended.test.ts
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

// Activate enforcement for all tests in this file
before(() => {
  process.env.SUBSCRIPTION_ENFORCEMENT_ENABLED = "true";
});

after(() => {
  delete process.env.SUBSCRIPTION_ENFORCEMENT_ENABLED;
});

import { resolveAccessMode, canCreateInAccessMode } from "../src/lib/subscriptions/access-mode";

const FUTURE = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 days from now
const PAST = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();  // 60 days ago
const NOW = new Date();

describe("resolveAccessMode — active subscription", () => {
  it("active status → full", () => {
    assert.equal(
      resolveAccessMode({ status: "active", planCode: "starter", gracePeriodEndsAt: null, pilotEndsAt: null, endsAt: FUTURE, now: NOW }),
      "full"
    );
  });
});

describe("resolveAccessMode — pilot subscription", () => {
  it("pilot with pilot plan code and future pilotEndsAt → pilot_limited", () => {
    assert.equal(
      resolveAccessMode({ status: "pilot", planCode: "pilot", gracePeriodEndsAt: null, pilotEndsAt: FUTURE, endsAt: null, now: NOW }),
      "pilot_limited"
    );
  });

  it("pilot with non-pilot plan code → full", () => {
    assert.equal(
      resolveAccessMode({ status: "pilot", planCode: "starter", gracePeriodEndsAt: null, pilotEndsAt: FUTURE, endsAt: null, now: NOW }),
      "full"
    );
  });

  it("pilot with expired pilotEndsAt → grace", () => {
    assert.equal(
      resolveAccessMode({ status: "pilot", planCode: "pilot", gracePeriodEndsAt: null, pilotEndsAt: PAST, endsAt: null, now: NOW }),
      "grace"
    );
  });
});

describe("resolveAccessMode — grace period", () => {
  it("grace with future gracePeriodEndsAt → grace", () => {
    assert.equal(
      resolveAccessMode({ status: "grace", planCode: "starter", gracePeriodEndsAt: FUTURE, pilotEndsAt: null, endsAt: null, now: NOW }),
      "grace"
    );
  });

  it("grace with expired gracePeriodEndsAt → restricted_read_only", () => {
    assert.equal(
      resolveAccessMode({ status: "grace", planCode: "starter", gracePeriodEndsAt: PAST, pilotEndsAt: null, endsAt: null, now: NOW }),
      "restricted_read_only"
    );
  });

  it("grace with no gracePeriodEndsAt → grace (still in grace)", () => {
    assert.equal(
      resolveAccessMode({ status: "grace", planCode: "starter", gracePeriodEndsAt: null, pilotEndsAt: null, endsAt: null, now: NOW }),
      "grace"
    );
  });
});

describe("resolveAccessMode — suspended", () => {
  it("suspended → suspended", () => {
    assert.equal(
      resolveAccessMode({ status: "suspended", planCode: "starter", gracePeriodEndsAt: null, pilotEndsAt: null, endsAt: null, now: NOW }),
      "suspended"
    );
  });
});

describe("resolveAccessMode — past_due", () => {
  it("past_due → grace (billing settling)", () => {
    assert.equal(
      resolveAccessMode({ status: "past_due", planCode: "starter", gracePeriodEndsAt: FUTURE, pilotEndsAt: null, endsAt: null, now: NOW }),
      "grace"
    );
  });
});

describe("resolveAccessMode — expired / cancelled / archived", () => {
  it("expired → restricted_read_only", () => {
    assert.equal(
      resolveAccessMode({ status: "expired", planCode: null, gracePeriodEndsAt: null, pilotEndsAt: null, endsAt: null, now: NOW }),
      "restricted_read_only"
    );
  });

  it("cancelled → restricted_read_only", () => {
    assert.equal(
      resolveAccessMode({ status: "cancelled", planCode: null, gracePeriodEndsAt: null, pilotEndsAt: null, endsAt: null, now: NOW }),
      "restricted_read_only"
    );
  });
});

describe("canCreateInAccessMode", () => {
  it("full → can create", () => {
    assert.equal(canCreateInAccessMode("full"), true);
  });

  it("pilot_limited → can create (limited set)", () => {
    assert.equal(canCreateInAccessMode("pilot_limited"), true);
  });

  it("grace → can create", () => {
    assert.equal(canCreateInAccessMode("grace"), true);
  });

  it("restricted_read_only → cannot create", () => {
    assert.equal(canCreateInAccessMode("restricted_read_only"), false);
  });

  it("suspended → cannot create", () => {
    assert.equal(canCreateInAccessMode("suspended"), false);
  });
});
