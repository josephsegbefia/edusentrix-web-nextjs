import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { NonRetriableError } from "inngest";
import { stubServerOnly } from "../regression/helpers/stub-server-only";

stubServerOnly();

const DB_NAME = "background_work_engine";
let mongod: MongoMemoryServer;
let sendCalls: Array<{ id?: string; name: string; data: Record<string, unknown> }>;
let sendImpl: () => Promise<{ ids: string[] }>;

function ids() {
  return {
    schoolA: new mongoose.Types.ObjectId(),
    schoolB: new mongoose.Types.ObjectId(),
    userA: new mongoose.Types.ObjectId(),
    userB: new mongoose.Types.ObjectId(),
    userC: new mongoose.Types.ObjectId(),
  };
}

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGO_DB_NAME = DB_NAME;
  const { connectToDatabase } = await import("../../src/db/connectToDatabase");
  await connectToDatabase();
}, { timeout: 180_000 });

after(async () => {
  await mongoose.disconnect().catch(() => undefined);
  await mongod?.stop();
});

beforeEach(async () => {
  sendCalls = [];
  sendImpl = async () => ({ ids: ["evt_ok"] });
  const { inngestEventPort } = await import("../../src/lib/background/inngest-port");
  inngestEventPort.send = async (event) => {
    sendCalls.push(event);
    return sendImpl();
  };
  const db = mongoose.connection.db;
  if (!db) return;
  for (const collection of await db.collections()) {
    await collection.deleteMany({});
  }
});

describe("background job dispatch", () => {
  test("persists the job then records the Inngest event id", async () => {
    const { enqueueBackgroundJob } = await import("../../src/lib/background/enqueue-job");
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const pair = ids();

    const result = await enqueueBackgroundJob({
      kind: "LIBRARY_IMPORT",
      schoolId: pair.schoolA,
      initiatedByUserId: pair.userA,
      input: { importJobId: "lib-1" },
    });

    assert.equal(result.created, true);
    assert.equal(result.dispatched, true);
    assert.equal(result.inngestEventId, "evt_ok");
    const job = await BackgroundJob.findById(result.jobId);
    assert.equal(job?.status, "queued");
    assert.equal(job?.inngestEventId, "evt_ok");
    assert.equal(sendCalls.length, 1);
    assert.equal(sendCalls[0]?.id, result.jobId);
    assert.equal(sendCalls[0]?.data.kind, "LIBRARY_IMPORT");
    assert.equal(sendCalls[0]?.data.schoolId, String(pair.schoolA));
  });

  test("keeps a recoverable job when Inngest send fails", async () => {
    sendImpl = async () => {
      throw new Error("inngest unavailable https://inn.gs/secret");
    };
    const { enqueueBackgroundJob } = await import("../../src/lib/background/enqueue-job");
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const pair = ids();

    const result = await enqueueBackgroundJob({
      kind: "LIBRARY_IMPORT",
      schoolId: pair.schoolA,
      initiatedByUserId: pair.userA,
    });

    assert.equal(result.dispatched, false);
    assert.equal(result.job.status, "dispatch_failed");
    assert.match(result.job.lastErrorMessage ?? "", /inngest unavailable/);
    assert.doesNotMatch(result.job.lastErrorMessage ?? "", /inn\.gs/);
    assert.equal(await BackgroundJob.countDocuments(), 1);
  });

  test("redispatch recovers a dispatch_failed job without creating another", async () => {
    sendImpl = async () => {
      throw new Error("temporary");
    };
    const { enqueueBackgroundJob, redispatchBackgroundJob } = await import(
      "../../src/lib/background/enqueue-job"
    );
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const pair = ids();

    const first = await enqueueBackgroundJob({
      kind: "LIBRARY_IMPORT",
      schoolId: pair.schoolA,
      initiatedByUserId: pair.userA,
    });
    assert.equal(first.dispatched, false);

    sendImpl = async () => ({ ids: ["evt_retry"] });
    const again = await redispatchBackgroundJob(first.jobId);
    assert.equal(again.created, false);
    assert.equal(again.dispatched, true);
    assert.equal(again.inngestEventId, "evt_retry");
    assert.equal(await BackgroundJob.countDocuments(), 1);
    assert.equal((await BackgroundJob.findById(first.jobId))?.status, "queued");
  });

  test("already dispatched jobs are not sent again", async () => {
    const { enqueueBackgroundJob, redispatchBackgroundJob } = await import(
      "../../src/lib/background/enqueue-job"
    );
    const pair = ids();
    const first = await enqueueBackgroundJob({
      kind: "LIBRARY_IMPORT",
      schoolId: pair.schoolA,
      initiatedByUserId: pair.userA,
    });
    assert.equal(sendCalls.length, 1);
    const again = await redispatchBackgroundJob(first.jobId);
    assert.equal(again.dispatched, true);
    assert.equal(sendCalls.length, 1);
  });
});

describe("background job idempotency", () => {
  test("same tenant + kind + key reuses one job", async () => {
    const { enqueueBackgroundJob } = await import("../../src/lib/background/enqueue-job");
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const pair = ids();

    const first = await enqueueBackgroundJob({
      kind: "LIBRARY_IMPORT",
      schoolId: pair.schoolA,
      initiatedByUserId: pair.userA,
      idempotencyKey: "import:books:v1",
    });
    const second = await enqueueBackgroundJob({
      kind: "LIBRARY_IMPORT",
      schoolId: pair.schoolA,
      initiatedByUserId: pair.userB,
      idempotencyKey: "import:books:v1",
    });

    assert.equal(first.jobId, second.jobId);
    assert.equal(second.created, false);
    assert.equal(await BackgroundJob.countDocuments(), 1);
  });

  test("the same key in another school is a different job", async () => {
    const { enqueueBackgroundJob } = await import("../../src/lib/background/enqueue-job");
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const pair = ids();

    const a = await enqueueBackgroundJob({
      kind: "LIBRARY_IMPORT",
      schoolId: pair.schoolA,
      initiatedByUserId: pair.userA,
      idempotencyKey: "import:books:v1",
    });
    const b = await enqueueBackgroundJob({
      kind: "LIBRARY_IMPORT",
      schoolId: pair.schoolB,
      initiatedByUserId: pair.userB,
      idempotencyKey: "import:books:v1",
    });

    assert.notEqual(a.jobId, b.jobId);
    assert.equal(await BackgroundJob.countDocuments(), 2);
  });

  test("10 parallel creates with the same key produce one job and one send", async () => {
    const { enqueueBackgroundJob } = await import("../../src/lib/background/enqueue-job");
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const pair = ids();

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        enqueueBackgroundJob({
          kind: "LIBRARY_IMPORT",
          schoolId: pair.schoolA,
          initiatedByUserId: pair.userA,
          idempotencyKey: "parallel-key",
        })
      )
    );

    assert.equal(new Set(results.map((r) => r.jobId)).size, 1);
    assert.equal(await BackgroundJob.countDocuments(), 1);
    assert.equal(sendCalls.length, 1);
  });
});

describe("background job tenant isolation", () => {
  test("school A cannot see or cancel school B jobs", async () => {
    const { enqueueBackgroundJob } = await import("../../src/lib/background/enqueue-job");
    const { decideBackgroundJobAccess, canCancelBackgroundJob } = await import(
      "../../src/lib/background/authorization"
    );
    const { listCurrentUserBackgroundJobs } = await import("../../src/lib/background/list-jobs");
    const pair = ids();

    const jobB = await enqueueBackgroundJob({
      kind: "LIBRARY_IMPORT",
      schoolId: pair.schoolB,
      initiatedByUserId: pair.userB,
    });
    const actorA = { userId: pair.userA, schoolId: pair.schoolA, isSchoolAdmin: true };

    const access = decideBackgroundJobAccess(actorA, jobB.job);
    assert.equal(access.ok, false);
    if (!access.ok) assert.equal(access.reason, "not_found");
    const cancel = canCancelBackgroundJob(actorA, jobB.job);
    assert.equal(cancel.ok, false);
    const listed = await listCurrentUserBackgroundJobs({ actor: actorA, limit: 20, offset: 0 });
    assert.equal(listed.total, 0);
  });

  test("same-school users cannot see another user's private job", async () => {
    const { enqueueBackgroundJob } = await import("../../src/lib/background/enqueue-job");
    const { decideBackgroundJobAccess } = await import("../../src/lib/background/authorization");
    const { listCurrentUserBackgroundJobs } = await import("../../src/lib/background/list-jobs");
    const pair = ids();

    const job = await enqueueBackgroundJob({
      kind: "AI_LESSON_GENERATION",
      schoolId: pair.schoolA,
      initiatedByUserId: pair.userA,
    });
    const peer = { userId: pair.userC, schoolId: pair.schoolA, isSchoolAdmin: false };
    const access = decideBackgroundJobAccess(peer, job.job);
    assert.equal(access.ok, false);
    if (!access.ok) assert.equal(access.reason, "forbidden");
    const listed = await listCurrentUserBackgroundJobs({ actor: peer, limit: 20, offset: 0 });
    assert.equal(listed.total, 0);
  });

  test("platform jobs require platform access", async () => {
    const { enqueueBackgroundJob } = await import("../../src/lib/background/enqueue-job");
    const { decideBackgroundJobAccess } = await import("../../src/lib/background/authorization");
    const pair = ids();

    const job = await enqueueBackgroundJob({
      kind: "SYSTEM_BACKGROUND_SMOKE",
      initiatedByUserId: pair.userA,
    });
    assert.equal(job.job.platformScope, true);
    assert.equal(
      decideBackgroundJobAccess(
        { userId: pair.userA, schoolId: pair.schoolA, isSchoolAdmin: true },
        job.job
      ).ok,
      false
    );
    assert.equal(
      decideBackgroundJobAccess({ userId: pair.userA, isPlatformOperator: true }, job.job).ok,
      true
    );
  });

  test("worker rejects an event schoolId that does not match the job", async () => {
    const { enqueueBackgroundJob } = await import("../../src/lib/background/enqueue-job");
    const { runTrackedBackgroundJob } = await import("../../src/lib/background/worker-wrapper");
    const pair = ids();
    const job = await enqueueBackgroundJob({
      kind: "LIBRARY_IMPORT",
      schoolId: pair.schoolA,
      initiatedByUserId: pair.userA,
    });

    await assert.rejects(
      () =>
        runTrackedBackgroundJob({
          jobId: job.jobId,
          expectedKind: "LIBRARY_IMPORT",
          eventSchoolId: String(pair.schoolB),
          handler: async () => ({ ok: true }),
        }),
      /does not match BackgroundJob/
    );
  });
});

describe("background worker wrapper", () => {
  test("a transient error does not mark the job terminal FAILED", async () => {
    const { enqueueBackgroundJob } = await import("../../src/lib/background/enqueue-job");
    const { runTrackedBackgroundJob } = await import("../../src/lib/background/worker-wrapper");
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const pair = ids();
    const created = await enqueueBackgroundJob({
      kind: "SYSTEM_BACKGROUND_SMOKE",
      initiatedByUserId: pair.userA,
    });

    await assert.rejects(
      () =>
        runTrackedBackgroundJob({
          jobId: created.jobId,
          expectedKind: "SYSTEM_BACKGROUND_SMOKE",
          handler: async () => {
            throw new Error("temporary provider timeout");
          },
        }),
      /temporary provider timeout/
    );
    const job = await BackgroundJob.findById(created.jobId);
    assert.equal(job?.status, "running");
  });

  test("success after retry marks SUCCEEDED and keeps progress", async () => {
    const { enqueueBackgroundJob } = await import("../../src/lib/background/enqueue-job");
    const { runTrackedBackgroundJob } = await import("../../src/lib/background/worker-wrapper");
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const pair = ids();
    const created = await enqueueBackgroundJob({
      kind: "SYSTEM_BACKGROUND_SMOKE",
      initiatedByUserId: pair.userA,
    });

    let attempts = 0;
    const handler = async ({
      updateProgress,
    }: {
      updateProgress: (input: { progressPercent: number; progressStage?: string }) => Promise<void>;
    }) => {
      attempts += 1;
      await updateProgress({ progressPercent: 40, progressStage: "working" });
      if (attempts === 1) throw new Error("flaky");
      await updateProgress({ progressPercent: 100, progressStage: "done" });
      return { ok: true };
    };

    await assert.rejects(
      () =>
        runTrackedBackgroundJob({
          jobId: created.jobId,
          expectedKind: "SYSTEM_BACKGROUND_SMOKE",
          handler,
        }),
      /flaky/
    );
    assert.equal((await BackgroundJob.findById(created.jobId))?.progressPercent, 40);

    const result = await runTrackedBackgroundJob({
      jobId: created.jobId,
      expectedKind: "SYSTEM_BACKGROUND_SMOKE",
      handler,
    });
    assert.equal(result.outcome, "succeeded");
    const job = await BackgroundJob.findById(created.jobId);
    assert.equal(job?.status, "succeeded");
    assert.equal(job?.progressPercent, 100);
    assert.equal(job?.currentAttempt, 2);
  });

  test("final failure path sanitizes the error and marks FAILED", async () => {
    const { enqueueBackgroundJob } = await import("../../src/lib/background/enqueue-job");
    const { finalizeFailedBackgroundJob } = await import("../../src/lib/background/worker-wrapper");
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const pair = ids();
    const created = await enqueueBackgroundJob({
      kind: "SYSTEM_BACKGROUND_SMOKE",
      initiatedByUserId: pair.userA,
    });

    await finalizeFailedBackgroundJob(
      created.jobId,
      new Error("provider exploded token=sk_live_abcdefgh url=https://api.openai.com/v1")
    );
    const job = await BackgroundJob.findById(created.jobId);
    assert.equal(job?.status, "failed");
    assert.doesNotMatch(job?.lastErrorMessage ?? "", /sk_live/);
    assert.doesNotMatch(job?.lastErrorMessage ?? "", /openai.com/);
  });

  test("a permanent error marks FAILED and throws NonRetriableError", async () => {
    const { enqueueBackgroundJob } = await import("../../src/lib/background/enqueue-job");
    const { runTrackedBackgroundJob } = await import("../../src/lib/background/worker-wrapper");
    const { BackgroundJobError } = await import("../../src/lib/background/errors");
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const pair = ids();
    const created = await enqueueBackgroundJob({
      kind: "SYSTEM_BACKGROUND_SMOKE",
      initiatedByUserId: pair.userA,
    });

    await assert.rejects(
      () =>
        runTrackedBackgroundJob({
          jobId: created.jobId,
          expectedKind: "SYSTEM_BACKGROUND_SMOKE",
          handler: async () => {
            throw new BackgroundJobError({
              message: "malformed input",
              category: "PERMANENT",
              code: "BAD_INPUT",
            });
          },
        }),
      (error: unknown) => error instanceof NonRetriableError
    );
    assert.equal((await BackgroundJob.findById(created.jobId))?.status, "failed");
  });

  test("a terminal job is not rerun", async () => {
    const { enqueueBackgroundJob } = await import("../../src/lib/background/enqueue-job");
    const { runTrackedBackgroundJob } = await import("../../src/lib/background/worker-wrapper");
    const pair = ids();
    const created = await enqueueBackgroundJob({
      kind: "SYSTEM_BACKGROUND_SMOKE",
      initiatedByUserId: pair.userA,
    });
    await runTrackedBackgroundJob({
      jobId: created.jobId,
      expectedKind: "SYSTEM_BACKGROUND_SMOKE",
      handler: async () => ({ ok: true }),
    });
    let handlerCalls = 0;
    const second = await runTrackedBackgroundJob({
      jobId: created.jobId,
      expectedKind: "SYSTEM_BACKGROUND_SMOKE",
      handler: async () => {
        handlerCalls += 1;
        return { ok: true };
      },
    });
    assert.equal(second.outcome, "skipped_terminal");
    assert.equal(handlerCalls, 0);
  });
});

describe("background job notifications", () => {
  test("a user-visible success creates one completion notification", async () => {
    const { enqueueBackgroundJob } = await import("../../src/lib/background/enqueue-job");
    const { runTrackedBackgroundJob } = await import("../../src/lib/background/worker-wrapper");
    const { Notification } = await import("../../src/models/Notification");
    const pair = ids();
    const created = await enqueueBackgroundJob({
      kind: "LIBRARY_IMPORT",
      schoolId: pair.schoolA,
      initiatedByUserId: pair.userA,
      notifyOnSuccess: true,
      input: { secret: "should-not-appear", csvRef: "asset-1" },
    });

    await runTrackedBackgroundJob({
      jobId: created.jobId,
      expectedKind: "LIBRARY_IMPORT",
      eventSchoolId: String(pair.schoolA),
      handler: async () => ({ imported: 3 }),
    });

    const notes = await Notification.find({ schoolId: pair.schoolA, userId: pair.userA }).lean();
    assert.equal(notes.length, 1);
    assert.match(notes[0]?.title ?? "", /completed/i);
    assert.doesNotMatch(JSON.stringify(notes[0]), /should-not-appear/);
  });

  test("a user-visible terminal failure creates one failure notification", async () => {
    const { enqueueBackgroundJob } = await import("../../src/lib/background/enqueue-job");
    const { finalizeFailedBackgroundJob } = await import("../../src/lib/background/worker-wrapper");
    const { Notification } = await import("../../src/models/Notification");
    const pair = ids();
    const created = await enqueueBackgroundJob({
      kind: "LIBRARY_IMPORT",
      schoolId: pair.schoolA,
      initiatedByUserId: pair.userA,
      notifyOnFailure: true,
    });
    await finalizeFailedBackgroundJob(created.jobId, new Error("import failed"));
    await finalizeFailedBackgroundJob(created.jobId, new Error("import failed again"));
    assert.equal(await Notification.countDocuments({ schoolId: pair.schoolA, userId: pair.userA }), 1);
  });

  test("retry attempts do not notify", async () => {
    const { enqueueBackgroundJob } = await import("../../src/lib/background/enqueue-job");
    const { runTrackedBackgroundJob } = await import("../../src/lib/background/worker-wrapper");
    const { Notification } = await import("../../src/models/Notification");
    const pair = ids();
    const created = await enqueueBackgroundJob({
      kind: "LIBRARY_IMPORT",
      schoolId: pair.schoolA,
      initiatedByUserId: pair.userA,
      notifyOnSuccess: true,
      notifyOnFailure: true,
    });
    await assert.rejects(
      () =>
        runTrackedBackgroundJob({
          jobId: created.jobId,
          expectedKind: "LIBRARY_IMPORT",
          eventSchoolId: String(pair.schoolA),
          handler: async () => {
            throw new Error("retry me");
          },
        }),
      /retry me/
    );
    assert.equal(await Notification.countDocuments(), 0);
  });

  test("internal smoke jobs do not notify by default", async () => {
    const { enqueueBackgroundJob } = await import("../../src/lib/background/enqueue-job");
    const { runTrackedBackgroundJob } = await import("../../src/lib/background/worker-wrapper");
    const { Notification } = await import("../../src/models/Notification");
    const pair = ids();
    const created = await enqueueBackgroundJob({
      kind: "SYSTEM_BACKGROUND_SMOKE",
      schoolId: pair.schoolA,
      initiatedByUserId: pair.userA,
    });
    await runTrackedBackgroundJob({
      jobId: created.jobId,
      expectedKind: "SYSTEM_BACKGROUND_SMOKE",
      eventSchoolId: String(pair.schoolA),
      handler: async ({ updateProgress }) => {
        await updateProgress({ progressPercent: 10 });
        await updateProgress({ progressPercent: 50 });
        await updateProgress({ progressPercent: 100 });
        return { ok: true };
      },
    });
    assert.equal(await Notification.countDocuments(), 0);
  });
});
