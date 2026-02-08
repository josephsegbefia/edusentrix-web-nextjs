import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyDownlink,
  classifyProbeRtt,
  classifyRtt,
  computeQuality,
} from "../src/hooks/useNetworkHealth";

test("computeQuality returns good for consistently strong signals", () => {
  const quality = computeQuality("4g", 20, 80, 120);
  assert.equal(quality, "good");
});

test("computeQuality ignores a single noisy poor signal when most signals are good", () => {
  const quality = computeQuality("4g", 0.3, 80, 120);
  assert.equal(quality, "good");
});

test("computeQuality returns degraded when multiple signals indicate slowdown", () => {
  const quality = computeQuality("4g", 0.8, 1100, 1500);
  assert.equal(quality, "degraded");
});

test("computeQuality returns poor only when poor signals are consistent", () => {
  const quality = computeQuality("2g", 0.3, 2600, 2800);
  assert.equal(quality, "poor");
});

test("classifiers ignore invalid or zero metrics instead of marking slow", () => {
  assert.equal(classifyDownlink(0), null);
  assert.equal(classifyRtt(0), null);
  assert.equal(classifyProbeRtt(0), null);
});

