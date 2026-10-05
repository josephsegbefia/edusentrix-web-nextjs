import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { stubServerOnly } from "../regression/helpers/stub-server-only";

stubServerOnly();

const DB_NAME = "background_task_center";
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
  const db = mongoose.connection.db;
  if (!db) return;
  for (const collection of await db.collections()) {
    await collection.deleteMany({});
  }
  const { inngestEventPort } = await import("../../src/lib/background/inngest-port");
  inngestEventPort.send = async (event) => ({ ids: [String(event.id ?? "evt")] });
});

describe("Task Center visibility", () => {
  test("user sees own visible jobs; unrelated same-school user does not", async () => {
    const { enqueueBackgroundJob } = await import("../../src/lib/background/enqueue-job");
    const { listCurrentUserBackgroundJobs } = await import("../../src/lib/background/list-jobs");
    const schoolId = new mongoose.Types.ObjectId();
    const userA = new mongoose.Types.ObjectId();
    const userB = new mongoose.Types.ObjectId();

    await enqueueBackgroundJob({
      kind: "LIBRARY_IMPORT",
      schoolId,
      initiatedByUserId: userA,
      notificationTargetUserId: userA,
    });
    await enqueueBackgroundJob({
      kind: "EMAIL_DISPATCH",
      schoolId,
      initiatedByUserId: userA,
      input: { emailMessageId: String(new mongoose.Types.ObjectId()) },
    });

    const mine = await listCurrentUserBackgroundJobs({
      actor: { userId: userA, schoolId },
      limit: 20,
      offset: 0,
    });
    assert.equal(mine.total, 1);
    assert.equal(mine.jobs[0]?.kind, "LIBRARY_IMPORT");

    const other = await listCurrentUserBackgroundJobs({
      actor: { userId: userB, schoolId },
      limit: 20,
      offset: 0,
    });
    assert.equal(other.total, 0);
  });

  test("school admin school scope sees user-visible jobs only", async () => {
    const { enqueueBackgroundJob } = await import("../../src/lib/background/enqueue-job");
    const { listCurrentUserBackgroundJobs } = await import("../../src/lib/background/list-jobs");
    const schoolId = new mongoose.Types.ObjectId();
    const teacher = new mongoose.Types.ObjectId();
    const admin = new mongoose.Types.ObjectId();
    await enqueueBackgroundJob({
      kind: "SCHEME_IMPORT",
      schoolId,
      initiatedByUserId: teacher,
      notificationTargetUserId: teacher,
    });
    await enqueueBackgroundJob({
      kind: "EMAIL_DISPATCH",
      schoolId,
      initiatedByUserId: teacher,
      input: { emailMessageId: String(new mongoose.Types.ObjectId()) },
    });

    const schoolView = await listCurrentUserBackgroundJobs({
      actor: { userId: admin, schoolId, isSchoolAdmin: true },
      scope: "school",
      limit: 20,
      offset: 0,
    });
    assert.equal(schoolView.total, 1);
    assert.equal(schoolView.jobs[0]?.kind, "SCHEME_IMPORT");
  });

  test("safe DTO omits payloads and exposes retry/cancel/actionUrl", async () => {
    const { toSafeBackgroundJobDTO } = await import("../../src/lib/background/serializers");
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const schoolId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const job = await BackgroundJob.create({
      kind: "LIBRARY_IMPORT",
      tenantKey: `school:${String(schoolId)}`,
      schoolId,
      initiatedByUserId: userId,
      status: "failed",
      queuedAt: new Date(),
      recoveryAttempts: 0,
      lastErrorCode: "IMPORT_FAILED",
      lastErrorMessage: "The file could not be imported",
      input: { csv: "name,email\nAma,ama@example.test" },
      result: {
        notification: { actionUrl: "/admin/library/imports" },
        rows: ["secret-row"],
      },
    });
    const dto = toSafeBackgroundJobDTO(job, { userId, schoolId });
    const serialized = JSON.stringify(dto);
    assert.equal(dto.retryAllowed, true);
    assert.equal(dto.actionUrl, "/admin/library/imports");
    assert.equal(dto.cancelRequested, false);
    assert.doesNotMatch(serialized, /ama@example.test/);
    assert.doesNotMatch(serialized, /secret-row/);
    assert.equal("input" in dto, false);
  });

  test("platform jobs do not leak to school users", async () => {
    const { enqueueBackgroundJob } = await import("../../src/lib/background/enqueue-job");
    const { decideBackgroundJobAccess } = await import("../../src/lib/background/authorization");
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const queued = await enqueueBackgroundJob({
      kind: "SYSTEM_BACKGROUND_SMOKE",
      initiatedByUserId: new mongoose.Types.ObjectId(),
    });
    const job = await BackgroundJob.findById(queued.jobId);
    const access = decideBackgroundJobAccess(
      { userId: new mongoose.Types.ObjectId(), schoolId: new mongoose.Types.ObjectId() },
      job!
    );
    assert.equal(access.ok, false);
    assert.equal(access.reason, "not_found");
  });
});
