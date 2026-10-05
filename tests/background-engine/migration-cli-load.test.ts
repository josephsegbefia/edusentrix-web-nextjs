import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

const DB_NAME = "background_migration_cli_load";
let mongod: MongoMemoryServer;

describe("migration scripts load under plain tsx", () => {
  test("email/explore/operational scripts import without server-only", async () => {
    await assert.doesNotReject(() =>
      import("../../scripts/migrate-email-dispatch-jobs-to-background-engine")
    );
    await assert.doesNotReject(() =>
      import("../../scripts/migrate-explore-generation-jobs-to-background-engine")
    );
    await assert.doesNotReject(() =>
      import("../../scripts/migrate-operational-jobs-to-background-engine")
    );
  });
});

describe("migration script dry-run does not mutate", () => {
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
  });

  test("email dry-run does not create BackgroundJobs", async () => {
    const { EmailMessage } = await import("../../src/models/EmailMessage");
    const { EmailDispatchJob } = await import("../../src/models/EmailDispatchJob");
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const { migrateEmailDispatchJobsToBackgroundEngine } = await import(
      "../../scripts/migrate-email-dispatch-jobs-to-background-engine"
    );
    const message = await EmailMessage.create({
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
    });
    await EmailDispatchJob.create({
      kind: "outbound_single",
      emailMessageId: message._id,
      trafficClass: "transactional",
      priority: "high",
      status: "pending",
    });
    const report = await migrateEmailDispatchJobsToBackgroundEngine({ apply: false });
    assert.equal(report.apply, false);
    assert.equal(report.wouldEnqueue, 1);
    assert.equal(report.enqueued, 0);
    assert.equal(await BackgroundJob.countDocuments(), 0);
  });

  test("explore dry-run does not create BackgroundJobs", async () => {
    const { ExploreGenerationJob } = await import("../../src/models/ExploreGenerationJob");
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const { migrateExploreGenerationJobsToBackgroundEngine } = await import(
      "../../scripts/migrate-explore-generation-jobs-to-background-engine"
    );
    await ExploreGenerationJob.create({
      generationKey: "cli-load-explore-1",
      schoolId: new mongoose.Types.ObjectId(),
      classGroupId: new mongoose.Types.ObjectId(),
      subjectOfferingId: new mongoose.Types.ObjectId(),
      lessonId: new mongoose.Types.ObjectId(),
      gradeLevel: "P4",
      status: "pending",
      requestedByStudentId: new mongoose.Types.ObjectId(),
    });
    const report = await migrateExploreGenerationJobsToBackgroundEngine({ apply: false });
    assert.equal(report.wouldEnqueue, 1);
    assert.equal(await BackgroundJob.countDocuments(), 0);
  });

  test("operational dry-run does not create BackgroundJobs", async () => {
    const { LibraryImportJob } = await import("../../src/models/LibraryImportJob");
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const { migrateOperationalJobsToBackgroundEngine } = await import(
      "../../scripts/migrate-operational-jobs-to-background-engine"
    );
    await LibraryImportJob.create({
      schoolId: new mongoose.Types.ObjectId(),
      type: "books",
      status: "pending",
      fileName: "books.csv",
      csvText: "title\nA",
      createdBy: new mongoose.Types.ObjectId(),
    });
    const report = await migrateOperationalJobsToBackgroundEngine({ apply: false });
    assert.equal(report.scanned, 1);
    assert.equal(report.wouldEnqueue, 1);
    assert.equal(await BackgroundJob.countDocuments(), 0);
  });
});
