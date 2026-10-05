import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

describe("Prompt 5 scheduled functions", () => {
  test("registry registers UTC cron schedules", () => {
    const schedules = readFileSync("src/lib/background/functions/schedules.ts", "utf8");
    const registry = readFileSync("src/lib/background/functions/registry.ts", "utf8");
    const ids = [
      "admissions-weekly-digest",
      "background-job-reconciliation",
      "delegations-expiry",
      "finance-reconciliation",
      "imap-recovery",
      "library-loans-due-soon",
      "library-loans-overdue",
      "library-reservation-expiry",
      "subscription-plan-changes",
      "subscription-renewal-notices",
    ];
    for (const id of ids) {
      assert.match(schedules, new RegExp(`"${id}"`));
    }
    assert.match(schedules, /TZ=UTC/);
    assert.match(schedules, /concurrency:\s*SCHEDULE_CONCURRENCY/);
    assert.match(schedules, /limit:\s*1/);
    assert.match(schedules, /triggers:\s*\[\{\s*cron/);
    assert.match(registry, /getRegisteredScheduleFunctions\(\)/);
  });

  test("vercel.json has no required business crons", () => {
    const vercel = readFileSync("vercel.json", "utf8");
    assert.doesNotMatch(vercel, /\/api\/cron\//);
  });

  test("migrated HTTP cron routes return 410", async () => {
    const { GET } = await import("../../src/app/api/cron/imap-recovery/route");
    const res = await GET();
    assert.equal(res.status, 410);
  });

  test("admissions digest uses async email dispatch", () => {
    const src = readFileSync("src/lib/admissions/weekly-digest.ts", "utf8");
    assert.match(src, /async:\s*true/);
    assert.doesNotMatch(src, /resendSend\(/);
  });
});
