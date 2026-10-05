import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { stubServerOnly } from "../regression/helpers/stub-server-only";

stubServerOnly();

const DB_NAME = "explore_migration_script";
let mongod: MongoMemoryServer;

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
  const db = mongoose.connection.db;
  if (!db) return;
  for (const collection of await db.collections()) {
    await collection.deleteMany({});
  }
  const { inngestEventPort } = await import("../../src/lib/background/inngest-port");
  inngestEventPort.send = async () => ({ ids: ["evt_ok"] });
});

describe("Explore generation migration script", () => {
  test("dry-run does not create BackgroundJobs", async () => {
    const { ExploreGenerationJob } = await import("../../src/models/ExploreGenerationJob");
    await ExploreGenerationJob.create({
      generationKey: "migrate-1",
      schoolId: new mongoose.Types.ObjectId(),
      classGroupId: new mongoose.Types.ObjectId(),
      subjectOfferingId: new mongoose.Types.ObjectId(),
      lessonId: new mongoose.Types.ObjectId(),
      gradeLevel: "P4",
      status: "pending",
      requestedByStudentId: new mongoose.Types.ObjectId(),
    });
    const { migrateExploreGenerationJobsToBackgroundEngine } = await import(
      "../../scripts/migrate-explore-generation-jobs-to-background-engine"
    );
    const report = await migrateExploreGenerationJobsToBackgroundEngine({ apply: false });
    assert.equal(report.scanned, 1);
    assert.equal(report.wouldEnqueue, 1);
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    assert.equal(await BackgroundJob.countDocuments(), 0);
  });
});
