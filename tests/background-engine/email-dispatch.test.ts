import assert from "node:assert/strict";
import { after, before, beforeEach, describe, mock, test } from "node:test";
import { readFileSync } from "node:fs";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { NonRetriableError } from "inngest";
import { stubServerOnly } from "../regression/helpers/stub-server-only";

stubServerOnly();

const DB_NAME = "background_email_dispatch";
let mongod: MongoMemoryServer;
let resendCalls = 0;
let resendImpl: () => Promise<Response>;
let sendCalls: Array<{ id?: string; name: string; data: Record<string, unknown> }>;

function queuedMessageInput(overrides?: Record<string, unknown>) {
  return {
    provider: "resend",
    direction: "outbound",
    mailboxScope: "platform",
    mailboxKey: "platform_hello",
    from: "hello@example.com",
    to: "admin@example.com",
    subject: "Queued",
    htmlBody: "<p>Hello</p>",
    status: "queued",
    messageClass: "invitation",
    trafficClass: "transactional",
    priority: "high",
    sensitivity: "low",
    secureContentMode: "none",
    templateKey: "SCHOOL_INVITE",
    ...overrides,
  };
}

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGO_DB_NAME = DB_NAME;
  process.env.RESEND_API_KEY = "re_test_not_real";
  resendImpl = async () => new Response(JSON.stringify({ id: "re_ok" }), { status: 200 });
  mock.method(globalThis, "fetch", async (input: unknown) => {
    const url = String((input as { url?: string })?.url ?? input);
    if (url.includes("api.resend.com")) {
      resendCalls += 1;
      return resendImpl();
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  const { connectToDatabase } = await import("../../src/db/connectToDatabase");
  await connectToDatabase();
  const { BackgroundJob } = await import("../../src/models/BackgroundJob");
  await BackgroundJob.syncIndexes();
}, { timeout: 180_000 });

after(async () => {
  await mongoose.disconnect().catch(() => undefined);
  await mongod?.stop();
});

beforeEach(async () => {
  resendCalls = 0;
  resendImpl = async () => new Response(JSON.stringify({ id: "re_ok" }), { status: 200 });
  sendCalls = [];
  const { inngestEventPort } = await import("../../src/lib/background/inngest-port");
  inngestEventPort.send = async (event) => {
    sendCalls.push(event);
    return { ids: ["evt_ok"] };
  };
  const db = mongoose.connection.db;
  if (!db) return;
  for (const collection of await db.collections()) {
    await collection.deleteMany({});
  }
});

describe("EMAIL_DISPATCH worker", () => {
  test("sends once and a duplicate run does not resend", async () => {
    const { EmailMessage } = await import("../../src/models/EmailMessage");
    const { enqueueEmailMessageForRetry } = await import(
      "../../src/lib/email/enqueue-dispatch-job"
    );
    const { dispatchOutboundEmailMessage } = await import(
      "../../src/lib/email/dispatch-outbound-message"
    );

    const message = await EmailMessage.create(queuedMessageInput());
    await enqueueEmailMessageForRetry(message._id);
    const first = await dispatchOutboundEmailMessage({
      emailMessageId: String(message._id),
    });
    const second = await dispatchOutboundEmailMessage({
      emailMessageId: String(message._id),
    });

    assert.equal(first.outcome, "sent");
    assert.equal(second.outcome, "already_sent");
    assert.equal(resendCalls, 1);
    const fresh = await EmailMessage.findById(message._id);
    assert.equal(fresh?.status, "sent");
    assert.equal(fresh?.providerMessageId, "re_ok");
  });

  test("transient provider error stays retryable and does not mark the message failed", async () => {
    resendImpl = async () =>
      new Response(JSON.stringify({ message: "try later" }), { status: 503 });
    const { EmailMessage } = await import("../../src/models/EmailMessage");
    const { enqueueBackgroundJob } = await import("../../src/lib/background/enqueue-job");
    const { runTrackedBackgroundJob } = await import("../../src/lib/background/worker-wrapper");
    const { dispatchOutboundEmailMessage } = await import(
      "../../src/lib/email/dispatch-outbound-message"
    );
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");

    const message = await EmailMessage.create(queuedMessageInput());
    const created = await enqueueBackgroundJob({
      kind: "EMAIL_DISPATCH",
      input: { emailMessageId: String(message._id) },
      idempotencyKey: `email-dispatch:${String(message._id)}`,
    });

    await assert.rejects(
      () =>
        runTrackedBackgroundJob({
          jobId: created.jobId,
          expectedKind: "EMAIL_DISPATCH",
          handler: async () =>
            dispatchOutboundEmailMessage({ emailMessageId: String(message._id) }),
        }),
      /try later|503/
    );

    const job = await BackgroundJob.findById(created.jobId);
    assert.notEqual(job?.status, "failed");
    assert.notEqual(job?.status, "succeeded");
    assert.equal((await EmailMessage.findById(message._id))?.status, "queued");
  });

  test("permanent provider error is NonRetriable and marks both records", async () => {
    resendImpl = async () =>
      new Response(JSON.stringify({ message: "invalid recipient" }), { status: 400 });
    const { EmailMessage } = await import("../../src/models/EmailMessage");
    const { enqueueBackgroundJob } = await import("../../src/lib/background/enqueue-job");
    const { runTrackedBackgroundJob } = await import("../../src/lib/background/worker-wrapper");
    const { dispatchOutboundEmailMessage } = await import(
      "../../src/lib/email/dispatch-outbound-message"
    );
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");

    const message = await EmailMessage.create(queuedMessageInput());
    const created = await enqueueBackgroundJob({
      kind: "EMAIL_DISPATCH",
      input: { emailMessageId: String(message._id) },
      idempotencyKey: `email-dispatch:${String(message._id)}`,
    });

    await assert.rejects(
      () =>
        runTrackedBackgroundJob({
          jobId: created.jobId,
          expectedKind: "EMAIL_DISPATCH",
          handler: async () =>
            dispatchOutboundEmailMessage({ emailMessageId: String(message._id) }),
        }),
      (error: unknown) => error instanceof NonRetriableError
    );

    assert.equal((await BackgroundJob.findById(created.jobId))?.status, "failed");
    assert.equal((await EmailMessage.findById(message._id))?.status, "failed");
  });

  test("final Inngest onFailure marks the EmailMessage failed", async () => {
    const { EmailMessage } = await import("../../src/models/EmailMessage");
    const { enqueueBackgroundJob } = await import("../../src/lib/background/enqueue-job");
    const { finalizeFailedBackgroundJob } = await import(
      "../../src/lib/background/worker-wrapper"
    );
    const { markEmailMessageDispatchFailed } = await import(
      "../../src/lib/email/dispatch-outbound-message"
    );
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");

    const message = await EmailMessage.create(queuedMessageInput());
    const created = await enqueueBackgroundJob({
      kind: "EMAIL_DISPATCH",
      input: { emailMessageId: String(message._id) },
      idempotencyKey: `email-dispatch:${String(message._id)}`,
    });
    await finalizeFailedBackgroundJob(created.jobId, new Error("retries exhausted"));
    await markEmailMessageDispatchFailed({
      emailMessageId: message._id,
      error: new Error("retries exhausted"),
    });
    assert.equal((await BackgroundJob.findById(created.jobId))?.status, "failed");
    assert.equal((await EmailMessage.findById(message._id))?.status, "failed");
  });

  test("concurrent enqueueEmailMessageForRetry creates one job", async () => {
    const { EmailMessage } = await import("../../src/models/EmailMessage");
    const { enqueueEmailMessageForRetry } = await import(
      "../../src/lib/email/enqueue-dispatch-job"
    );
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");

    const message = await EmailMessage.create(queuedMessageInput());
    const [a, b] = await Promise.all([
      enqueueEmailMessageForRetry(message._id),
      enqueueEmailMessageForRetry(message._id),
    ]);
    assert.equal(a.enqueued, true);
    assert.equal(b.enqueued, true);
    assert.equal(await BackgroundJob.countDocuments({ kind: "EMAIL_DISPATCH" }), 1);
  });

  test("rejects a tenant mismatch between the job and the EmailMessage", async () => {
    const { EmailMessage } = await import("../../src/models/EmailMessage");
    const { dispatchOutboundEmailMessage } = await import(
      "../../src/lib/email/dispatch-outbound-message"
    );
    const schoolId = new mongoose.Types.ObjectId();
    const message = await EmailMessage.create(
      queuedMessageInput({ schoolId, mailboxScope: "school", mailboxKey: `school:${schoolId}:general` })
    );
    await assert.rejects(
      () =>
        dispatchOutboundEmailMessage({
          emailMessageId: String(message._id),
          expectedSchoolId: String(new mongoose.Types.ObjectId()),
        }),
      /tenant/i
    );
    assert.equal(resendCalls, 0);
  });

  test("dead_letter messages are no-ops", async () => {
    const { EmailMessage } = await import("../../src/models/EmailMessage");
    const { dispatchOutboundEmailMessage } = await import(
      "../../src/lib/email/dispatch-outbound-message"
    );
    const message = await EmailMessage.create(queuedMessageInput({ status: "dead_letter" }));
    const result = await dispatchOutboundEmailMessage({
      emailMessageId: String(message._id),
    });
    assert.equal(result.outcome, "noop");
    assert.equal(resendCalls, 0);
  });

  test("job input and Inngest event contain IDs only", async () => {
    const { EmailMessage } = await import("../../src/models/EmailMessage");
    const { enqueueEmailMessageForRetry } = await import(
      "../../src/lib/email/enqueue-dispatch-job"
    );
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const paymentId = new mongoose.Types.ObjectId();
    const message = await EmailMessage.create(
      queuedMessageInput({
        relatedEntityType: "Payment",
        relatedEntityId: String(paymentId),
        attachments: [
          {
            name: "receipt.pdf",
            mimeType: "application/pdf",
            generated: true,
          },
        ],
      })
    );
    await enqueueEmailMessageForRetry(message._id);
    const job = await BackgroundJob.findOne({ kind: "EMAIL_DISPATCH" }).lean();
    const serialized = JSON.stringify({ input: job?.input, event: sendCalls[0] });
    assert.equal(job?.input?.emailMessageId, String(message._id));
    assert.doesNotMatch(serialized, /contentBase64/);
    assert.doesNotMatch(serialized, /Hello/);
    assert.doesNotMatch(serialized, /JVBERi/);
  });
});

describe("Paystack receipt reuse", () => {
  test("redelivery reuses the same EmailMessage", async () => {
    const { EmailMessage } = await import("../../src/models/EmailMessage");
    const { findReusableOutboundEmailMessage } = await import(
      "../../src/lib/email/reconstruct-dispatch-attachments"
    );
    const { enqueueEmailMessageForRetry } = await import(
      "../../src/lib/email/enqueue-dispatch-job"
    );
    const paymentId = String(new mongoose.Types.ObjectId());
    const first = await EmailMessage.create(
      queuedMessageInput({
        relatedEntityType: "Payment",
        relatedEntityId: paymentId,
        to: "parent@example.com",
      })
    );
    const existing = await findReusableOutboundEmailMessage({
      relatedEntityType: "Payment",
      relatedEntityId: paymentId,
      to: "parent@example.com",
    });
    assert.equal(String(existing?._id), String(first._id));
    await enqueueEmailMessageForRetry(existing!._id);
    await enqueueEmailMessageForRetry(existing!._id);
    assert.equal(
      await EmailMessage.countDocuments({
        relatedEntityType: "Payment",
        relatedEntityId: paymentId,
      }),
      1
    );
  });

  test("follow-up mail failure does not throw after posting", async () => {
    const { User } = await import("../../src/models/User");
    const parent = await User.create({
      email: "parent@example.com",
      firstName: "Pat",
      lastName: "Parent",
      role: "parent",
    });
    const { sendFeePaymentFollowUps } = await import(
      "../../src/app/api/webhooks/paystack/route"
    );
    const source = readFileSync("src/app/api/webhooks/paystack/route.ts", "utf8");
    assert.match(source, /Paystack webhook: Fee payment follow-up failed/);
    assert.match(source, /findReusableOutboundEmailMessage/);
    await assert.doesNotReject(() =>
      sendFeePaymentFollowUps({
        schoolId: new mongoose.Types.ObjectId(),
        studentId: new mongoose.Types.ObjectId(),
        invoiceId: new mongoose.Types.ObjectId(),
        paymentId: new mongoose.Types.ObjectId(),
        parentUserId: parent._id,
        amountMinor: 1000,
        balanceMinor: 0,
        receiptNumber: "RCP-1",
        reference: "ref-1",
        paymentDate: new Date(),
      })
    );
  });
});

describe("legacy EmailDispatchJob migration", () => {
  test("dry-run reports would_enqueue without creating BackgroundJobs", async () => {
    const { EmailMessage } = await import("../../src/models/EmailMessage");
    const { EmailDispatchJob } = await import("../../src/models/EmailDispatchJob");
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const { migrateEmailDispatchJobsToBackgroundEngine } = await import(
      "../../scripts/migrate-email-dispatch-jobs-to-background-engine"
    );
    const message = await EmailMessage.create(queuedMessageInput());
    await EmailDispatchJob.create({
      kind: "outbound_single",
      emailMessageId: message._id,
      trafficClass: "transactional",
      priority: "high",
      status: "pending",
    });
    const report = await migrateEmailDispatchJobsToBackgroundEngine({ apply: false });
    assert.equal(report.wouldEnqueue, 1);
    assert.equal(report.enqueued, 0);
    assert.equal(await BackgroundJob.countDocuments(), 0);
  });

  test("apply enqueues one EMAIL_DISPATCH job and skips a missing message", async () => {
    const { EmailMessage } = await import("../../src/models/EmailMessage");
    const { EmailDispatchJob } = await import("../../src/models/EmailDispatchJob");
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const { migrateEmailDispatchJobsToBackgroundEngine } = await import(
      "../../scripts/migrate-email-dispatch-jobs-to-background-engine"
    );
    const message = await EmailMessage.create(queuedMessageInput());
    await EmailDispatchJob.create({
      kind: "outbound_single",
      emailMessageId: message._id,
      trafficClass: "transactional",
      priority: "high",
      status: "pending",
    });
    await EmailDispatchJob.create({
      kind: "outbound_single",
      emailMessageId: new mongoose.Types.ObjectId(),
      trafficClass: "transactional",
      priority: "high",
      status: "pending",
    });
    const report = await migrateEmailDispatchJobsToBackgroundEngine({ apply: true });
    assert.equal(report.enqueued, 1);
    assert.equal(report.skippedMissingMessage, 1);
    assert.equal(await BackgroundJob.countDocuments({ kind: "EMAIL_DISPATCH" }), 1);
  });
});

describe("email dispatch health and source gates", () => {
  test("health counts contain no recipient PII", async () => {
    const { EmailMessage } = await import("../../src/models/EmailMessage");
    const { enqueueEmailMessageForRetry } = await import(
      "../../src/lib/email/enqueue-dispatch-job"
    );
    const { getEmailDispatchHealth } = await import("../../src/lib/email/dispatch-health");
    const message = await EmailMessage.create(
      queuedMessageInput({ to: "secret-parent@school.example" })
    );
    await enqueueEmailMessageForRetry(message._id);
    const health = await getEmailDispatchHealth();
    const serialized = JSON.stringify(health);
    assert.equal(health.backgroundJobs.queued, 1);
    assert.equal(health.emailMessages.queued, 1);
    assert.equal(typeof health.inngestConfigured, "boolean");
    assert.doesNotMatch(serialized, /secret-parent@school\.example/);
    assert.doesNotMatch(serialized, /Hello/);
  });

  test("send/retry/batch paths no longer write EmailDispatchJob", () => {
    const send = readFileSync("src/lib/email/services/send-brevo-email.ts", "utf8");
    const retry = readFileSync("src/lib/email/enqueue-dispatch-job.ts", "utf8");
    const batch = readFileSync("src/lib/email/batch-scheduler.ts", "utf8");
    const inbound = readFileSync("src/lib/email/services/process-inbound-email.ts", "utf8");
    const vercel = readFileSync("vercel.json", "utf8");
    const invitation = readFileSync("src/lib/invitations/issue-invitation.ts", "utf8");
    assert.doesNotMatch(send, /EmailDispatchJob\.create/);
    assert.doesNotMatch(retry, /EmailDispatchJob\.create/);
    assert.doesNotMatch(batch, /EmailDispatchJob\.create/);
    assert.doesNotMatch(inbound, /EmailDispatchJob\.create/);
    assert.doesNotMatch(vercel, /\/api\/cron\/email-dispatch/);
    assert.match(invitation, /enqueueOnFailure:\s*true/);
    assert.doesNotMatch(invitation, /EmailDispatchJob/);
    assert.match(
      readFileSync("src/lib/email/enqueue-dispatch-job.ts", "utf8"),
      /enqueueBackgroundJob/
    );
  });

  test("cron email-dispatch route is retired", async () => {
    const { GET } = await import("../../src/app/api/cron/email-dispatch/route");
    const res = await GET();
    assert.equal(res.status, 410);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(String(body.error), /Inngest/);
  });

  test("applications confirmation uses enqueueOnFailure instead of a second EmailMessage", () => {
    const source = readFileSync("src/app/api/platform/applications/route.ts", "utf8");
    assert.match(source, /enqueueOnFailure:\s*true/);
    assert.doesNotMatch(source, /async:\s*true/);
  });
});
