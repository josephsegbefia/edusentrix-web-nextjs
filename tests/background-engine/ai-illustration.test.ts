import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { stubServerOnly } from "../regression/helpers/stub-server-only";

stubServerOnly();

const DB_NAME = "background_ai_illustration";
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

describe("AI_LESSON_ILLUSTRATION", () => {
  test("enqueue stores request refs and does not call image generation", async () => {
    const { enqueueLessonIllustration } = await import(
      "../../src/lib/lessons/enqueue-lesson-illustration"
    );
    const result = await enqueueLessonIllustration({
      context: {
        userId: new mongoose.Types.ObjectId(),
        teacherId: new mongoose.Types.ObjectId(),
        schoolId: new mongoose.Types.ObjectId(),
        roles: ["teacher"],
        subroles: [],
        permissions: ["lessonAi.use"],
        isAdmin: false,
      },
      fact: "Water boils at 100C in standard conditions.",
      detail: "This is a classroom-safe science fact used for illustration planning.",
      sessionTitle: "Boiling point",
    });
    assert.ok(result.jobId);
    assert.equal(sendCalls[0]?.data.kind, "AI_LESSON_ILLUSTRATION");
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const job = await BackgroundJob.findById(result.jobId);
    assert.equal(job?.input?.illustrationRequestId, result.illustrationRequestId);
    assert.doesNotMatch(JSON.stringify(job?.input), /Water boils/);
  });

  test("worker reuses a persisted image instead of regenerating", async () => {
    const schoolId = new mongoose.Types.ObjectId();
    const { LessonIllustrationRequest } = await import("../../src/models/LessonIllustrationRequest");
    const request = await LessonIllustrationRequest.create({
      schoolId,
      teacherUserId: new mongoose.Types.ObjectId(),
      teacherId: new mongoose.Types.ObjectId(),
      revision: 1,
      idempotencyKey: "ai-illustration:reuse:1",
      status: "queued",
      imageUrl: "https://files.example/ready.png",
      storageKey: "lesson_illustration/ready.png",
    });
    const { enqueueBackgroundJob } = await import("../../src/lib/background/enqueue-job");
    const queued = await enqueueBackgroundJob({
      kind: "AI_LESSON_ILLUSTRATION",
      schoolId,
      initiatedByUserId: request.teacherUserId,
      input: { illustrationRequestId: String(request._id) },
    });
    const { runTrackedBackgroundJob } = await import("../../src/lib/background/worker-wrapper");
    const { executeLessonIllustration } = await import(
      "../../src/lib/lessons/execute-lesson-illustration"
    );
    const result = await runTrackedBackgroundJob({
      jobId: queued.jobId,
      expectedKind: "AI_LESSON_ILLUSTRATION",
      eventSchoolId: String(schoolId),
      handler: executeLessonIllustration,
    });
    assert.equal(result.outcome, "succeeded");
    const fresh = await LessonIllustrationRequest.findById(request._id);
    assert.equal(fresh?.storageKey, "lesson_illustration/ready.png");
    assert.equal(fresh?.status, "succeeded");
  });
});
