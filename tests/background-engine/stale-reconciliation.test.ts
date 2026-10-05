import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { stubServerOnly } from "../regression/helpers/stub-server-only";

stubServerOnly();

const DB_NAME = "background_stale_reconciliation";
let mongod: MongoMemoryServer;

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
  const { inngestEventPort } = await import("../../src/lib/background/inngest-port");
  inngestEventPort.send = async () => ({ ids: ["evt"] });
  const db = mongoose.connection.db;
  if (!db) return;
  for (const collection of await db.collections()) {
    await collection.deleteMany({});
  }
});

describe("stale reconciliation", () => {
  test("fresh running jobs are not stale; thresholds differ by workload", async () => {
    const { staleHeartbeatMsForKind, queryStaleBackgroundJobs } = await import(
      "../../src/lib/background/stale-jobs"
    );
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    assert.ok(staleHeartbeatMsForKind("EMAIL_DISPATCH") < staleHeartbeatMsForKind("AI_LESSON_GENERATION"));
    await BackgroundJob.create({
      kind: "LIBRARY_IMPORT",
      tenantKey: "platform",
      status: "running",
      queuedAt: new Date(),
      startedAt: new Date(),
      lastHeartbeatAt: new Date(),
      recoveryAttempts: 0,
    });
    const stale = await queryStaleBackgroundJobs();
    assert.equal(stale.runningWithOldHeartbeat, 0);
  });

  test("domain-completed stale job reconciles to succeeded; dispatch_failed redispatches", async () => {
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const { LibraryImportJob } = await import("../../src/models/LibraryImportJob");
    const { reconcileStaleAndDispatchFailedJobs } = await import(
      "../../src/lib/background/reconciliation"
    );
    const schoolId = new mongoose.Types.ObjectId();
    const domain = await LibraryImportJob.create({
      schoolId,
      createdBy: new mongoose.Types.ObjectId(),
      type: "books",
      status: "completed",
      fileName: "books.csv",
      totalRows: 1,
      successfulRows: 1,
      failedRows: 0,
    });
    const running = await BackgroundJob.create({
      kind: "LIBRARY_IMPORT",
      tenantKey: `school:${String(schoolId)}`,
      schoolId,
      subjectType: "LibraryImportJob",
      subjectId: domain._id,
      status: "running",
      queuedAt: new Date(Date.now() - 60 * 60 * 1000),
      startedAt: new Date(Date.now() - 60 * 60 * 1000),
      lastHeartbeatAt: new Date(Date.now() - 60 * 60 * 1000),
      recoveryAttempts: 0,
    });
    await BackgroundJob.create({
      kind: "LIBRARY_IMPORT",
      tenantKey: `school:${String(schoolId)}`,
      schoolId,
      status: "dispatch_failed",
      queuedAt: new Date(),
      recoveryAttempts: 0,
    });

    const summary = await reconcileStaleAndDispatchFailedJobs();
    assert.equal(summary.markedSucceeded, 1);
    assert.equal(summary.redispatched, 1);
    const recovered = await BackgroundJob.findById(running._id);
    assert.equal(recovered?.status, "succeeded");
  });

  test("exhausted recovery is counted and not blindly replayed", async () => {
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const { queryStaleBackgroundJobs } = await import("../../src/lib/background/stale-jobs");
    const { reconcileStaleAndDispatchFailedJobs } = await import(
      "../../src/lib/background/reconciliation"
    );
    await BackgroundJob.create({
      kind: "LIBRARY_IMPORT",
      tenantKey: "platform",
      status: "dispatch_failed",
      queuedAt: new Date(),
      recoveryAttempts: 5,
    });
    const stale = await queryStaleBackgroundJobs();
    assert.equal(stale.exhaustedRecovery, 1);
    const summary = await reconcileStaleAndDispatchFailedJobs();
    assert.equal(summary.exhausted, 1);
    assert.equal(summary.redispatched, 0);
  });
});
