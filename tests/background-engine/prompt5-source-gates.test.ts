import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("Prompt 5 source gates", () => {
  test("no required Vercel cron and no production after()", () => {
    assert.doesNotMatch(read("vercel.json"), /\/api\/cron\//);
    const afterHits = read("src/app/api/admin/library/imports/route.ts");
    assert.doesNotMatch(afterHits, /from "next\/server".*after\(/s);
  });

  test("legacy helpers are gone", () => {
    assert.throws(() => read("src/lib/communications/delivery/processOutboxJobs.ts"));
    assert.throws(() => read("src/lib/jobs/trigger-provisioning-runner.ts"));
    assert.throws(() => read("src/lib/jobs/emailDispatch.ts"));
  });

  test("outbound helper is Resend and exposes a provider-neutral alias", () => {
    const send = read("src/lib/email/services/send-brevo-email.ts");
    assert.match(send, /sends \(or queues\) via Resend/);
    assert.match(send, /export const sendTrackedEmail = sendTrackedBrevoEmail/);
    assert.match(send, /resendSend/);
    assert.doesNotMatch(send, /api\.brevo\.com/);
  });

  test("Task Center and operator serializers stay payload-safe", () => {
    const serializer = read("src/lib/background/serializers.ts");
    assert.match(serializer, /safeBackgroundJobActionUrl/);
    assert.doesNotMatch(serializer, /input:/);
    const taskCenter = read("src/components/background/BackgroundTaskCenter.tsx");
    assert.doesNotMatch(taskCenter, /job\.input|job\.result\b/);
  });
});
