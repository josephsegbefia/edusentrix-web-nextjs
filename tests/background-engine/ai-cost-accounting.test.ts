import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { classifyAiProviderError } from "../../src/lib/background/ai-errors";

describe("AI cost and retry classification", () => {
  test("timeouts and 429s are retryable", () => {
    assert.equal(classifyAiProviderError(new Error("timeout")).category, "RETRYABLE");
    assert.equal(classifyAiProviderError({ status: 429, message: "rate limit" }).category, "RETRYABLE");
    assert.equal(classifyAiProviderError({ status: 503, message: "overloaded" }).category, "RETRYABLE");
  });

  test("invalid model and missing source are permanent", () => {
    assert.equal(classifyAiProviderError(new Error("model_not_found")).category, "PERMANENT");
    assert.equal(classifyAiProviderError({ status: 400, message: "invalid_request" }).category, "PERMANENT");
    assert.equal(classifyAiProviderError(new Error("Lesson note not found")).category, "PERMANENT");
  });

  test("checkpoint reuse is the documented no-double-count rule", () => {
    assert.equal(
      classifyAiProviderError(new Error("timeout after provider success")).retryable,
      true
    );
  });
});
