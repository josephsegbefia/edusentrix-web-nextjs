import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { stubServerOnly } from "../regression/helpers/stub-server-only";

stubServerOnly();

const DB_NAME = "background_library_import";
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

describe("LIBRARY_IMPORT", () => {
  test("enqueue creates a job without putting CSV in the event", async () => {
    const schoolId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const { enqueueLibraryImport } = await import("../../src/lib/library/library-import.service");
    const domain = await enqueueLibraryImport(schoolId, userId, {
      type: "books",
      fileName: "books.csv",
      csvText: "title,isbn\nFractions,123",
    });
    const { enqueueLibraryImportBackgroundJob } = await import(
      "../../src/lib/library/enqueue-library-import"
    );
    const queued = await enqueueLibraryImportBackgroundJob({
      schoolId,
      libraryImportJobId: domain._id,
      initiatedByUserId: userId,
    });
    assert.equal(queued.created, true);
    assert.equal(sendCalls.length, 1);
    const payload = JSON.stringify(sendCalls[0]?.data);
    assert.doesNotMatch(payload, /Fractions/);
    assert.doesNotMatch(payload, /csvText/);
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const bg = await BackgroundJob.findById(queued.jobId);
    assert.equal(bg?.kind, "LIBRARY_IMPORT");
    assert.equal(bg?.input?.libraryImportJobId, String(domain._id));
  });

  test("worker refuses a tenant mismatch", async () => {
    const schoolId = new mongoose.Types.ObjectId();
    const otherSchool = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const { LibraryImportJob } = await import("../../src/models/LibraryImportJob");
    const domain = await LibraryImportJob.create({
      schoolId,
      type: "books",
      status: "pending",
      fileName: "books.csv",
      csvText: "title\nA",
      createdBy: userId,
    });
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const bg = await BackgroundJob.create({
      kind: "LIBRARY_IMPORT",
      schoolId: otherSchool,
      tenantKey: `school:${String(otherSchool)}`,
      status: "running",
      queuedAt: new Date(),
      input: { libraryImportJobId: String(domain._id) },
    });
    const { executeLibraryImportBackground } = await import(
      "../../src/lib/library/execute-library-import"
    );
    await assert.rejects(
      () =>
        executeLibraryImportBackground({
          job: bg,
          updateProgress: async () => undefined,
          isCancellationRequested: async () => false,
          throwIfCancellationRequested: async () => undefined,
        }),
      /tenant mismatch/
    );
  });

  test("completed job without csvText is a no-op success", async () => {
    const schoolId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const { LibraryImportJob } = await import("../../src/models/LibraryImportJob");
    const domain = await LibraryImportJob.create({
      schoolId,
      type: "books",
      status: "completed",
      fileName: "books.csv",
      totalRows: 2,
      successfulRows: 2,
      failedRows: 0,
      createdBy: userId,
    });
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const bg = await BackgroundJob.create({
      kind: "LIBRARY_IMPORT",
      schoolId,
      tenantKey: `school:${String(schoolId)}`,
      status: "running",
      queuedAt: new Date(),
      input: { libraryImportJobId: String(domain._id) },
    });
    const { executeLibraryImportBackground } = await import(
      "../../src/lib/library/execute-library-import"
    );
    const result = await executeLibraryImportBackground({
      job: bg,
      updateProgress: async () => undefined,
      isCancellationRequested: async () => false,
      throwIfCancellationRequested: async () => undefined,
    });
    assert.equal(result.processed, 2);
    assert.equal(result.succeeded, 2);
  });
});
