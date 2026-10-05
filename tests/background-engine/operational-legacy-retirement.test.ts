import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { stubServerOnly } from "../regression/helpers/stub-server-only";

stubServerOnly();

const DB_NAME = "operational_legacy_retirement";
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
  const { inngestEventPort } = await import("../../src/lib/background/inngest-port");
  inngestEventPort.send = async () => ({ ids: ["evt_ok"] });
  const db = mongoose.connection.db;
  if (!db) return;
  for (const collection of await db.collections()) {
    await collection.deleteMany({});
  }
});

describe("Prompt 4 legacy retirement", () => {
  test("old runners return 410", async () => {
    const provisioning = await import("../../src/app/api/provisioning/run/route");
    const outbox = await import("../../src/app/api/jobs/communications/process-outbox/route");
    const provisioned = await provisioning.POST();
    const outboxed = await outbox.POST();
    assert.equal(provisioned.status, 410);
    assert.equal(outboxed.status, 410);
  });

  test("send routes enqueue instead of inline processing", () => {
    const admin = readFileSync("src/app/api/admin/communications/[id]/send/route.ts", "utf8");
    const teacher = readFileSync("src/app/api/teacher/communications/[id]/send/route.ts", "utf8");
    assert.match(admin, /enqueueCommunicationOutboxJobs/);
    assert.match(teacher, /enqueueCommunicationOutboxJobs/);
    assert.doesNotMatch(admin, /processCommunicationOutbox/);
    assert.doesNotMatch(teacher, /processCommunicationOutbox/);
  });

  test("payment provisioning no longer triggers the HTTP runner", () => {
    const enqueue = readFileSync("src/lib/jobs/payment-provisioning.ts", "utf8");
    const setup = readFileSync("src/app/api/admin/settings/payment-setup/provision/route.ts", "utf8");
    const review = readFileSync(
      "src/app/api/platform/schools/[id]/payment-setup-review/route.ts",
      "utf8"
    );
    assert.doesNotMatch(enqueue, /triggerProvisioningRunnerBestEffort/);
    assert.doesNotMatch(setup, /triggerProvisioningRunnerBestEffort/);
    assert.doesNotMatch(review, /triggerProvisioningRunnerBestEffort/);
  });

  test("outbox email uses EMAIL_DISPATCH via async send", () => {
    const source = readFileSync(
      "src/lib/communications/delivery/execute-communication-outbox.ts",
      "utf8"
    );
    assert.match(source, /async:\s*true/);
    assert.doesNotMatch(source, /async:\s*false/);
  });

  test("workers are registered", () => {
    const source = readFileSync("src/lib/background/functions/registry.ts", "utf8");
    assert.match(source, /createLibraryImportBackgroundJobFunction/);
    assert.match(source, /createSchemeImportBackgroundJobFunction/);
    assert.match(source, /createSchoolProvisioningBackgroundJobFunction/);
    assert.match(source, /createCommunicationOutboxBackgroundJobFunction/);
    assert.match(source, /createBulkImportBackgroundJobFunction/);
  });

  test("migration dry-run does not create BackgroundJobs", async () => {
    const { LibraryImportJob } = await import("../../src/models/LibraryImportJob");
    await LibraryImportJob.create({
      schoolId: new mongoose.Types.ObjectId(),
      type: "books",
      status: "pending",
      fileName: "books.csv",
      csvText: "title\nA",
      createdBy: new mongoose.Types.ObjectId(),
    });
    const { migrateOperationalJobsToBackgroundEngine } = await import(
      "../../scripts/migrate-operational-jobs-to-background-engine"
    );
    const report = await migrateOperationalJobsToBackgroundEngine({ apply: false });
    assert.equal(report.scanned, 1);
    assert.equal(report.wouldEnqueue, 1);
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    assert.equal(await BackgroundJob.countDocuments(), 0);
  });
});
