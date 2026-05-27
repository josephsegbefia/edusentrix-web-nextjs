/**
 * Tests for the canonical feature key registry.
 *
 * P0.9 — spec §25.6: unknown keys must be rejected.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  FEATURE_KEYS,
  FEATURE_DEFINITIONS,
  assertKnownFeatureKey,
  isKnownFeatureKey,
} from "../src/lib/subscriptions/feature-keys";

describe("feature-keys registry", () => {
  it("exports a non-empty FEATURE_KEYS object", () => {
    const keys = Object.values(FEATURE_KEYS);
    assert.ok(keys.length > 0, "FEATURE_KEYS must not be empty");
  });

  it("all FEATURE_KEYS values use dotted namespace format", () => {
    for (const key of Object.values(FEATURE_KEYS)) {
      assert.match(
        key,
        /^[a-z_]+\.[a-z_]+$/,
        `Feature key "${key}" must be in "module.feature" format`
      );
    }
  });

  it("FEATURE_DEFINITIONS has an entry for every FEATURE_KEYS value", () => {
    const missing: string[] = [];
    for (const key of Object.values(FEATURE_KEYS)) {
      if (!FEATURE_DEFINITIONS[key as keyof typeof FEATURE_DEFINITIONS]) {
        missing.push(key);
      }
    }
    assert.deepEqual(missing, [], `Missing FEATURE_DEFINITIONS for: ${missing.join(", ")}`);
  });

  it("isKnownFeatureKey returns true for all registered keys", () => {
    for (const key of Object.values(FEATURE_KEYS)) {
      assert.ok(isKnownFeatureKey(key), `isKnownFeatureKey should return true for "${key}"`);
    }
  });

  it("isKnownFeatureKey returns false for unknown keys", () => {
    const unknownKeys = [
      "ai_leo_copilot",
      "lesson_notes",
      "core_school_ops",
      "random.unknown",
      "",
      "ai.leo.extra",
    ];
    for (const key of unknownKeys) {
      assert.equal(
        isKnownFeatureKey(key),
        false,
        `isKnownFeatureKey should return false for "${key}"`
      );
    }
  });

  it("assertKnownFeatureKey throws in non-production for unknown keys", () => {
    const original = process.env.NODE_ENV;
    // Force development context
    (process.env as Record<string, string>).NODE_ENV = "development";
    try {
      assert.throws(
        () => assertKnownFeatureKey("legacy_feature_key"),
        /Unknown feature key/,
        "assertKnownFeatureKey must throw in development for unknown keys"
      );
    } finally {
      (process.env as Record<string, string>).NODE_ENV = original;
    }
  });

  it("assertKnownFeatureKey returns true for known keys", () => {
    const result = assertKnownFeatureKey(FEATURE_KEYS.AI_LEO);
    assert.equal(result, true);
  });

  it("FEATURE_DEFINITIONS labels are non-empty strings", () => {
    for (const [key, def] of Object.entries(FEATURE_DEFINITIONS)) {
      assert.ok(typeof def.label === "string" && def.label.length > 0, `Missing label for "${key}"`);
    }
  });

  it("FEATURE_DEFINITIONS module fields are non-empty strings", () => {
    for (const [key, def] of Object.entries(FEATURE_DEFINITIONS)) {
      assert.ok(typeof def.module === "string" && def.module.length > 0, `Missing module for "${key}"`);
    }
  });

  it("no duplicate FEATURE_KEYS values", () => {
    const values = Object.values(FEATURE_KEYS);
    const unique = new Set(values);
    assert.equal(unique.size, values.length, "FEATURE_KEYS must not have duplicate values");
  });
});
