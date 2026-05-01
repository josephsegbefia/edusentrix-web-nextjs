import test from "node:test";
import assert from "node:assert/strict";
import { completionRatioPercent } from "../src/lib/lessons/completion-percent";

test("completionRatioPercent returns null when total <= 0", () => {
  assert.equal(completionRatioPercent(5, 0), null);
  assert.equal(completionRatioPercent(5, -1), null);
});

test("completionRatioPercent returns 0 when completed is 0", () => {
  assert.equal(completionRatioPercent(0, 10), 0);
});

test("completionRatioPercent rounds half-up style and caps at 100", () => {
  assert.equal(completionRatioPercent(1, 3), 33);
  assert.equal(completionRatioPercent(2, 3), 67);
  assert.equal(completionRatioPercent(3, 3), 100);
  assert.equal(completionRatioPercent(10, 10), 100);
  assert.equal(completionRatioPercent(15, 10), 100);
});
