import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

describe("inngest middleware allowlist", () => {
  test("only /api/inngest is added as a public Inngest endpoint", () => {
    const source = readFileSync(path.resolve("src/middleware.ts"), "utf8");
    assert.match(source, /\/api\/inngest\(\.\*\)/);
    assert.doesNotMatch(source, /x-inngest-bypass|INNGEST_BYPASS|x-background-job-execute/i);
  });
});
