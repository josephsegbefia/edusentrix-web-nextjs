import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { stubServerOnly } from "../regression/helpers/stub-server-only";

stubServerOnly();

const DB_NAME = "background_bulk_import";
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

describe("BULK_IMPORT", () => {
  test("persist-and-enqueue does not put file bytes in the event", async () => {
    const schoolId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const { persistAndEnqueueBulkImport } = await import(
      "../../src/lib/imports/enqueue-bulk-import"
    );
    const queued = await persistAndEnqueueBulkImport({
      schoolId,
      createdBy: userId,
      targetKind: "students",
      fileName: "students.csv",
      fileBytes: Buffer.from("First Name,Last Name\nAma,Mensah\n"),
    });
    assert.ok(queued.bulkImportJobId);
    const payload = JSON.stringify(sendCalls[0]?.data);
    assert.doesNotMatch(payload, /Ama|Mensah|fileBytes/);
    const { BulkImportJob } = await import("../../src/models/BulkImportJob");
    const domain = await BulkImportJob.findById(queued.bulkImportJobId);
    assert.equal(domain?.status, "pending");
    assert.ok(domain?.fileBytes?.length);
  });

  test("malformed teacher file is permanent", async () => {
    const schoolId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const { BulkImportJob } = await import("../../src/models/BulkImportJob");
    const domain = await BulkImportJob.create({
      schoolId,
      createdBy: userId,
      targetKind: "teachers",
      status: "pending",
      fileName: "teachers.csv",
      fileBytes: Buffer.from("not-a-header-row\n"),
    });
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const bg = await BackgroundJob.create({
      kind: "BULK_IMPORT",
      schoolId,
      tenantKey: `school:${String(schoolId)}`,
      status: "running",
      queuedAt: new Date(),
      input: { bulkImportJobId: String(domain._id), targetKind: "teachers" },
    });
    const { executeBulkImport } = await import("../../src/lib/imports/execute-bulk-import");
    await assert.rejects(
      () =>
        executeBulkImport({
          job: bg,
          updateProgress: async () => undefined,
          isCancellationRequested: async () => false,
          throwIfCancellationRequested: async () => undefined,
        }),
      /Missing required columns|no data rows|permanent|failed/i
    );
    const fresh = await BulkImportJob.findById(domain._id);
    assert.equal(fresh?.status, "failed");
  });

  test("worker refuses a tenant mismatch", async () => {
    const schoolId = new mongoose.Types.ObjectId();
    const other = new mongoose.Types.ObjectId();
    const { BulkImportJob } = await import("../../src/models/BulkImportJob");
    const domain = await BulkImportJob.create({
      schoolId,
      createdBy: new mongoose.Types.ObjectId(),
      targetKind: "students",
      status: "pending",
      fileName: "students.csv",
      fileBytes: Buffer.from("First Name,Last Name\nA,B\n"),
    });
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const bg = await BackgroundJob.create({
      kind: "BULK_IMPORT",
      schoolId: other,
      tenantKey: `school:${String(other)}`,
      status: "running",
      queuedAt: new Date(),
      input: { bulkImportJobId: String(domain._id) },
    });
    const { executeBulkImport } = await import("../../src/lib/imports/execute-bulk-import");
    await assert.rejects(
      () =>
        executeBulkImport({
          job: bg,
          updateProgress: async () => undefined,
          isCancellationRequested: async () => false,
          throwIfCancellationRequested: async () => undefined,
        }),
      /tenant mismatch/
    );
  });
});
