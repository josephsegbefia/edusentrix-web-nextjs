import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { stubServerOnly } from "../regression/helpers/stub-server-only";

stubServerOnly();

const DB_NAME = "background_operator_recovery";
let mongod: MongoMemoryServer;
let sendImpl: () => Promise<{ ids: string[] }>;
let sendCalls: number;

before(
  async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.MONGO_DB_NAME = DB_NAME;
    const { connectToDatabase } = await import("../../src/db/connectToDatabase");
    await connectToDatabase();
  },
  { timeout: 180_000 }
);

after(async () => {
  await mongoose.disconnect().catch(() => undefined);
  await mongod?.stop();
});

beforeEach(async () => {
  sendCalls = 0;
  sendImpl = async () => ({ ids: ["evt"] });
  const { inngestEventPort } = await import("../../src/lib/background/inngest-port");
  inngestEventPort.send = async () => {
    sendCalls += 1;
    return sendImpl();
  };
  const db = mongoose.connection.db;
  if (!db) return;
  for (const collection of await db.collections()) {
    await collection.deleteMany({});
  }
});

describe("operator redispatch and retry", () => {
  test("redispatch recovers dispatch_failed once under concurrency", async () => {
    sendImpl = async () => {
      throw new Error("down");
    };
    const { enqueueBackgroundJob, redispatchBackgroundJob } = await import(
      "../../src/lib/background/enqueue-job"
    );
    const first = await enqueueBackgroundJob({
      kind: "LIBRARY_IMPORT",
      schoolId: new mongoose.Types.ObjectId(),
      initiatedByUserId: new mongoose.Types.ObjectId(),
    });
    assert.equal(first.job.status, "dispatch_failed");
    sendCalls = 0;
    sendImpl = async () => ({ ids: ["evt_ok"] });
    const [a, b] = await Promise.all([
      redispatchBackgroundJob(first.jobId),
      redispatchBackgroundJob(first.jobId),
    ]);
    assert.equal(a.dispatched || b.dispatched, true);
    assert.equal(sendCalls, 1);
  });

  test("retry failed import creates a new job linked to the source", async () => {
    const { LibraryImportJob } = await import("../../src/models/LibraryImportJob");
    const { enqueueBackgroundJob } = await import("../../src/lib/background/enqueue-job");
    const { retryBackgroundJob } = await import("../../src/lib/background/retry-job");
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const schoolId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const domain = await LibraryImportJob.create({
      schoolId,
      createdBy: userId,
      type: "books",
      status: "failed",
      fileName: "books.csv",
      csvText: "title,author\nOne,Two",
      totalRows: 1,
      successfulRows: 0,
      failedRows: 1,
    });
    const source = await enqueueBackgroundJob({
      kind: "LIBRARY_IMPORT",
      schoolId,
      initiatedByUserId: userId,
      subjectType: "LibraryImportJob",
      subjectId: domain._id,
    });
    await BackgroundJob.updateOne({ _id: source.jobId }, { $set: { status: "failed" } });

    const retried = await retryBackgroundJob({
      sourceJobId: source.jobId,
      actor: { userId, schoolId },
    });
    assert.equal(retried.ok, true);
    if (!retried.ok) return;
    assert.notEqual(retried.created.jobId, source.jobId);
    assert.equal(String(retried.created.job.retryOfJobId), source.jobId);
    assert.equal(await BackgroundJob.countDocuments(), 2);
  });

  test("provisioning cannot be retried; succeeded job cannot retry", async () => {
    const { enqueueBackgroundJob } = await import("../../src/lib/background/enqueue-job");
    const { retryBackgroundJob } = await import("../../src/lib/background/retry-job");
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const schoolId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const provisioning = await enqueueBackgroundJob({
      kind: "SCHOOL_PROVISIONING",
      schoolId,
      initiatedByUserId: userId,
    });
    await BackgroundJob.updateOne({ _id: provisioning.jobId }, { $set: { status: "failed" } });
    const unsafe = await retryBackgroundJob({
      sourceJobId: provisioning.jobId,
      actor: { userId, schoolId },
    });
    assert.equal(unsafe.ok, false);
    if (unsafe.ok) return;
    assert.equal(unsafe.reason, "not_retryable");

    const library = await enqueueBackgroundJob({
      kind: "LIBRARY_IMPORT",
      schoolId,
      initiatedByUserId: userId,
    });
    const succeeded = await retryBackgroundJob({
      sourceJobId: library.jobId,
      actor: { userId, schoolId },
    });
    assert.equal(succeeded.ok, false);
    if (succeeded.ok) return;
    assert.equal(succeeded.reason, "not_failed");
  });

  test("cross-school actor cannot retry", async () => {
    const { enqueueBackgroundJob } = await import("../../src/lib/background/enqueue-job");
    const { retryBackgroundJob } = await import("../../src/lib/background/retry-job");
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const schoolA = new mongoose.Types.ObjectId();
    const schoolB = new mongoose.Types.ObjectId();
    const userA = new mongoose.Types.ObjectId();
    const created = await enqueueBackgroundJob({
      kind: "LIBRARY_IMPORT",
      schoolId: schoolA,
      initiatedByUserId: userA,
    });
    await BackgroundJob.updateOne({ _id: created.jobId }, { $set: { status: "failed" } });
    const result = await retryBackgroundJob({
      sourceJobId: created.jobId,
      actor: { userId: new mongoose.Types.ObjectId(), schoolId: schoolB },
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "not_found");
  });
});
