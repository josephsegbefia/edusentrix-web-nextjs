import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { stubServerOnly } from "../regression/helpers/stub-server-only";

stubServerOnly();

const DB_NAME = "background_explore";
let mongod: MongoMemoryServer;
let sendCalls: Array<{ id?: string; name: string; data: Record<string, unknown> }>;

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGO_DB_NAME = DB_NAME;
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

describe("EXPLORE_GENERATION enqueue", () => {
  test("creates a BackgroundJob with routing IDs only and does not notify students", async () => {
    const schoolId = new mongoose.Types.ObjectId();
    const classGroupId = new mongoose.Types.ObjectId();
    const subjectOfferingId = new mongoose.Types.ObjectId();
    const lessonId = new mongoose.Types.ObjectId();
    const studentId = new mongoose.Types.ObjectId();
    const { ExploreGenerationJob } = await import("../../src/models/ExploreGenerationJob");
    const job = await ExploreGenerationJob.create({
      generationKey: `${schoolId}:${classGroupId}:${subjectOfferingId}:${lessonId}:JHS 1:base_explore:1`,
      schoolId,
      classGroupId,
      subjectOfferingId,
      lessonId,
      gradeLevel: "JHS 1",
      mode: "go_deeper",
      status: "pending",
      requestedByStudentId: studentId,
    });

    const { enqueueExploreGenerationWork } = await import(
      "../../src/lib/learn/explore/enqueue-explore-generation"
    );
    const queued = await enqueueExploreGenerationWork({
      exploreJob: job.toObject(),
      trigger: "student",
    });

    assert.equal(queued.created, true);
    assert.equal(sendCalls.length, 1);
    assert.equal(sendCalls[0]?.data.kind, "EXPLORE_GENERATION");
    const payload = JSON.stringify(sendCalls[0]?.data);
    assert.doesNotMatch(payload, /prompt/i);
    assert.doesNotMatch(payload, /adventure/i);
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const bg = await BackgroundJob.findById(queued.jobId);
    assert.equal(bg?.notifyOnSuccess, false);
    assert.equal(bg?.notifyOnFailure, false);
    assert.equal(bg?.input?.exploreGenerationJobId, String(job._id));
  });

  test("teacher trigger enables terminal notifications", async () => {
    const schoolId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const { ExploreGenerationJob } = await import("../../src/models/ExploreGenerationJob");
    const job = await ExploreGenerationJob.create({
      generationKey: `teacher:${schoolId}:1`,
      schoolId,
      classGroupId: new mongoose.Types.ObjectId(),
      subjectOfferingId: new mongoose.Types.ObjectId(),
      lessonId: new mongoose.Types.ObjectId(),
      gradeLevel: "JHS 2",
      requestedByStudentId: new mongoose.Types.ObjectId(),
    });
    const { enqueueExploreGenerationWork } = await import(
      "../../src/lib/learn/explore/enqueue-explore-generation"
    );
    const queued = await enqueueExploreGenerationWork({
      exploreJob: job.toObject(),
      trigger: "teacher",
      initiatedByUserId: userId,
      sessionId: job.lessonId,
    });
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const bg = await BackgroundJob.findById(queued.jobId);
    assert.equal(bg?.notifyOnSuccess, true);
    assert.equal(String(bg?.notificationTargetUserId), String(userId));
  });

  test("duplicate enqueue reuses the same BackgroundJob", async () => {
    const { ExploreGenerationJob } = await import("../../src/models/ExploreGenerationJob");
    const job = await ExploreGenerationJob.create({
      generationKey: "dup-key-1",
      schoolId: new mongoose.Types.ObjectId(),
      classGroupId: new mongoose.Types.ObjectId(),
      subjectOfferingId: new mongoose.Types.ObjectId(),
      lessonId: new mongoose.Types.ObjectId(),
      gradeLevel: "P6",
      requestedByStudentId: new mongoose.Types.ObjectId(),
    });
    const { enqueueExploreGenerationWork } = await import(
      "../../src/lib/learn/explore/enqueue-explore-generation"
    );
    const first = await enqueueExploreGenerationWork({
      exploreJob: job.toObject(),
      trigger: "system",
    });
    const fresh = await ExploreGenerationJob.findById(job._id);
    const second = await enqueueExploreGenerationWork({
      exploreJob: fresh!.toObject(),
      trigger: "system",
    });
    assert.equal(first.jobId, second.jobId);
    assert.equal(second.created, false);
  });
});
