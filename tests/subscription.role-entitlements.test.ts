/**
 * Tests for role entitlement rules and subscription error classes — Slice 21 §19.
 *
 * Covers:
 *  - getRoleEntitlementRules: role exists, canRead/canWrite sets correct
 *  - roleCanReadFeature / roleCanWriteFeature helper functions
 *  - roleAndPlanCanRead / roleAndPlanCanWrite combined checks
 *  - SubscriptionError class hierarchy
 *
 * Run: npx tsx --test tests/subscription.role-entitlements.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  getRoleEntitlementRules,
  roleCanReadFeature,
  roleCanWriteFeature,
  roleAndPlanCanRead,
  roleAndPlanCanWrite,
  ROLE_ENTITLEMENT_RULES,
} from "../src/lib/subscriptions/role-entitlement-rules";

import {
  SubscriptionError,
  FeatureGatedError,
  LimitExceededError,
  AccessModeError,
  UsageExhaustedError,
  isSubscriptionError,
} from "../src/lib/subscriptions/subscription-errors";

import { FEATURE_KEYS } from "../src/lib/subscriptions/feature-keys";

describe("ROLE_ENTITLEMENT_RULES — completeness", () => {
  const roles = ["school_admin", "bursar", "teacher", "parent", "student"] as const;

  it("every expected role has an entry", () => {
    for (const role of roles) {
      assert.ok(ROLE_ENTITLEMENT_RULES[role], `Missing rule entry for role "${role}"`);
    }
  });

  it("every role has canRead and canWrite sets", () => {
    for (const role of roles) {
      const rules = getRoleEntitlementRules(role);
      assert.ok(rules.canRead instanceof Set, `${role}.canRead must be a Set`);
      assert.ok(rules.canWrite instanceof Set, `${role}.canWrite must be a Set`);
    }
  });

  it("canWrite is a subset of canRead for every role", () => {
    for (const role of roles) {
      const rules = getRoleEntitlementRules(role);
      for (const feature of rules.canWrite) {
        assert.ok(
          rules.canRead.has(feature),
          `${role}.canWrite contains "${feature}" which is not in canRead`
        );
      }
    }
  });
});

describe("roleCanReadFeature", () => {
  it("school_admin can read finance fees", () => {
    assert.equal(roleCanReadFeature("school_admin", FEATURE_KEYS.FINANCE_FEES), true);
  });

  it("student cannot read finance fees", () => {
    assert.equal(roleCanReadFeature("student", FEATURE_KEYS.FINANCE_FEES), false);
  });

  it("teacher can read academics lesson notes", () => {
    assert.equal(roleCanReadFeature("teacher", FEATURE_KEYS.ACADEMICS_LESSON_NOTES), true);
  });

  it("parent cannot read academics schemes", () => {
    assert.equal(roleCanReadFeature("parent", FEATURE_KEYS.ACADEMICS_SCHEMES), false);
  });

  it("bursar can read finance payments", () => {
    assert.equal(roleCanReadFeature("bursar", FEATURE_KEYS.FINANCE_PAYMENTS), true);
  });

  it("bursar cannot read AI Leo", () => {
    assert.equal(roleCanReadFeature("bursar", FEATURE_KEYS.AI_LEO), false);
  });
});

describe("roleCanWriteFeature", () => {
  it("teacher can write lesson notes", () => {
    assert.equal(roleCanWriteFeature("teacher", FEATURE_KEYS.ACADEMICS_LESSON_NOTES), true);
  });

  it("parent cannot write lesson notes", () => {
    assert.equal(roleCanWriteFeature("parent", FEATURE_KEYS.ACADEMICS_LESSON_NOTES), false);
  });

  it("school_admin can write finance fees", () => {
    assert.equal(roleCanWriteFeature("school_admin", FEATURE_KEYS.FINANCE_FEES), true);
  });
});

describe("roleAndPlanCanRead / roleAndPlanCanWrite", () => {
  const planFeatures = new Set([
    FEATURE_KEYS.FINANCE_FEES,
    FEATURE_KEYS.ACADEMICS_LESSON_NOTES,
    FEATURE_KEYS.ACADEMICS_SCHEMES,
  ]);

  it("school_admin + plan includes finance fees → can read", () => {
    assert.equal(roleAndPlanCanRead("school_admin", FEATURE_KEYS.FINANCE_FEES, planFeatures), true);
  });

  it("teacher + plan includes lesson notes → can read", () => {
    assert.equal(roleAndPlanCanRead("teacher", FEATURE_KEYS.ACADEMICS_LESSON_NOTES, planFeatures), true);
  });

  it("teacher + plan does NOT include AI Leo → cannot read", () => {
    assert.equal(roleAndPlanCanRead("teacher", FEATURE_KEYS.AI_LEO, planFeatures), false);
  });

  it("student + plan includes finance fees → but student role blocks read", () => {
    assert.equal(roleAndPlanCanRead("student", FEATURE_KEYS.FINANCE_FEES, planFeatures), false);
  });

  it("teacher + plan includes schemes → can READ schemes (cannot write — only admin)", () => {
    assert.equal(roleAndPlanCanRead("teacher", FEATURE_KEYS.ACADEMICS_SCHEMES, planFeatures), true);
    assert.equal(roleAndPlanCanWrite("teacher", FEATURE_KEYS.ACADEMICS_SCHEMES, planFeatures), false);
  });
});

describe("canViewBilling", () => {
  it("school_admin can view billing", () => {
    assert.equal(getRoleEntitlementRules("school_admin").canViewBilling, true);
  });

  it("bursar can view billing", () => {
    assert.equal(getRoleEntitlementRules("bursar").canViewBilling, true);
  });

  it("teacher cannot view billing", () => {
    assert.equal(getRoleEntitlementRules("teacher").canViewBilling, false);
  });

  it("parent cannot view billing", () => {
    assert.equal(getRoleEntitlementRules("parent").canViewBilling, false);
  });

  it("student cannot view billing", () => {
    assert.equal(getRoleEntitlementRules("student").canViewBilling, false);
  });
});

describe("SubscriptionError class hierarchy", () => {
  it("SubscriptionError is an Error subclass", () => {
    const err = new SubscriptionError("base error", "TEST_CODE");
    assert.ok(err instanceof Error);
    assert.ok(err instanceof SubscriptionError);
    assert.equal(err.message, "base error");
    assert.equal(err.code, "TEST_CODE");
  });

  it("FeatureGatedError has correct properties", () => {
    const err = new FeatureGatedError(FEATURE_KEYS.AI_LEO, "growth");
    assert.ok(err instanceof SubscriptionError);
    assert.ok(err instanceof FeatureGatedError);
    assert.equal(err.featureKey, FEATURE_KEYS.AI_LEO);
    assert.equal(err.requiredPlan, "growth");
    assert.equal(err.code, "FEATURE_NOT_INCLUDED");
    assert.equal(err.httpStatus, 403);
  });

  it("FeatureGatedError message includes feature and plan", () => {
    const err = new FeatureGatedError(FEATURE_KEYS.AI_LEO, "enterprise");
    assert.ok(err.message.includes(FEATURE_KEYS.AI_LEO));
    assert.ok(err.message.includes("enterprise"));
  });

  it("FeatureGatedError without requiredPlan still works", () => {
    const err = new FeatureGatedError(FEATURE_KEYS.ACADEMICS_SCHEMES);
    assert.equal(err.requiredPlan, undefined);
    assert.ok(err.message.includes(FEATURE_KEYS.ACADEMICS_SCHEMES));
  });

  it("LimitExceededError carries limitKey and values", () => {
    const err = new LimitExceededError("maxStudents", 500, 500);
    assert.ok(err instanceof SubscriptionError);
    assert.ok(err instanceof LimitExceededError);
    assert.equal(err.limitKey, "maxStudents");
    assert.equal(err.limit, 500);
    assert.equal(err.current, 500);
    assert.equal(err.code, "LIMIT_EXCEEDED");
  });

  it("AccessModeError carries mode and known message for restricted_read_only", () => {
    const err = new AccessModeError("restricted_read_only");
    assert.ok(err instanceof SubscriptionError);
    assert.ok(err instanceof AccessModeError);
    assert.equal(err.accessMode, "restricted_read_only");
    assert.equal(err.code, "ACCESS_MODE_RESTRICTED");
    assert.ok(err.message.includes("read-only"));
  });

  it("AccessModeError for suspended has appropriate message", () => {
    const err = new AccessModeError("suspended");
    assert.ok(err.message.toLowerCase().includes("suspend"));
  });

  it("UsageExhaustedError carries usageType and values", () => {
    const err = new UsageExhaustedError("leo_credits", 0, 100);
    assert.ok(err instanceof SubscriptionError);
    assert.ok(err instanceof UsageExhaustedError);
    assert.equal(err.usageType, "leo_credits");
    assert.equal(err.remaining, 0);
    assert.equal(err.limit, 100);
    assert.equal(err.code, "USAGE_EXHAUSTED");
    assert.equal(err.httpStatus, 429);
  });

  it("isSubscriptionError returns true for SubscriptionError subclasses", () => {
    assert.equal(isSubscriptionError(new FeatureGatedError(FEATURE_KEYS.AI_LEO)), true);
    assert.equal(isSubscriptionError(new AccessModeError("suspended")), true);
    assert.equal(isSubscriptionError(new Error("plain error")), false);
    assert.equal(isSubscriptionError("not an error"), false);
    assert.equal(isSubscriptionError(null), false);
  });

  it("toApiResponse returns consistent shape", () => {
    const err = new FeatureGatedError(FEATURE_KEYS.AI_LEO, "enterprise");
    const resp = err.toApiResponse();
    assert.equal(resp.success, false);
    assert.equal(typeof resp.error, "string");
    assert.equal(resp.code, "FEATURE_NOT_INCLUDED");
    assert.equal(resp.featureKey, FEATURE_KEYS.AI_LEO);
  });
});
