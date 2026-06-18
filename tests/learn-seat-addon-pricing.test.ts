import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isLearnSeatPerSeatPricing,
  learnSeatReferenceTotalMinor,
} from "../src/lib/subscriptions/learn-seat-addon-pricing";

describe("learn-seat-addon-pricing", () => {
  it("treats learn_seats as per-seat pricing", () => {
    assert.equal(isLearnSeatPerSeatPricing("learn_seats"), true);
    assert.equal(isLearnSeatPerSeatPricing("leo_credits"), false);
  });

  it("computes reference total from per-seat price", () => {
    assert.equal(learnSeatReferenceTotalMinor(30_000, 5), 150_000);
  });
});
