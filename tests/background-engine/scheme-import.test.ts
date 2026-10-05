import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { stubServerOnly } from "../regression/helpers/stub-server-only";

stubServerOnly();

const DB_NAME = "background_scheme_import";
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

describe("SCHEME_IMPORT", () => {
  test("enqueue persists queued job without downloading the file", async () => {
    const schoolId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const { School } = await import("../../src/models/School");
    const { SchoolSettings } = await import("../../src/models/SchoolSettings");
    await School.create({ _id: schoolId, name: "NaCCA School", type: "Basic", status: "active", curriculumCode: "ghana_nacca" });
    await SchoolSettings.create({
      schoolId,
      academicPlanning: { enableSchemeOfWork: true, allowSchemeImport: true },
    });
    const { StoredAsset } = await import("../../src/models/StoredAsset");
    const asset = await StoredAsset.create({
      schoolId,
      provider: "r2",
      storageKey: "scheme/import.csv",
      fileName: "scheme.csv",
      extension: "csv",
      mimeType: "text/csv",
      sizeBytes: 120,
      kind: "scheme_import",
      visibility: "private",
      status: "ready",
    });
    const { enqueueSchemeImportParse } = await import(
      "../../src/lib/schemes/enqueue-scheme-import-parse"
    );
    const result = await enqueueSchemeImportParse({
      schoolId,
      createdByUserId: userId,
      fileUrl: `/api/storage/assets/${String(asset._id)}`,
      fileName: "scheme.csv",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.job.status, "queued");
    const payload = JSON.stringify(sendCalls[0]?.data);
    assert.doesNotMatch(payload, /fileBytes|csv|pdf/i);
    assert.equal(sendCalls[0]?.data.kind, "SCHEME_IMPORT");
  });

  test("worker refuses a tenant mismatch", async () => {
    const schoolId = new mongoose.Types.ObjectId();
    const other = new mongoose.Types.ObjectId();
    const { SchemeImportJob } = await import("../../src/models/SchemeImportJob");
    const domain = await SchemeImportJob.create({
      schoolId,
      createdByUserId: new mongoose.Types.ObjectId(),
      status: "queued",
      fileName: "scheme.csv",
      fileUrl: "/api/storage/assets/aaaaaaaaaaaaaaaaaaaaaaaa",
    });
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const bg = await BackgroundJob.create({
      kind: "SCHEME_IMPORT",
      schoolId: other,
      tenantKey: `school:${String(other)}`,
      status: "running",
      queuedAt: new Date(),
      input: { schemeImportJobId: String(domain._id) },
    });
    const { executeSchemeImportParse } = await import(
      "../../src/lib/schemes/execute-scheme-import-parse"
    );
    await assert.rejects(
      () =>
        executeSchemeImportParse({
          job: bg,
          updateProgress: async () => undefined,
          isCancellationRequested: async () => false,
          throwIfCancellationRequested: async () => undefined,
        }),
      /tenant mismatch/
    );
  });

  test("confirm routes stay synchronous", () => {
    const admin = readFileSync("src/app/api/admin/scheme-imports/[id]/confirm/route.ts", "utf8");
    const teacher = readFileSync("src/app/api/teacher/scheme-imports/[id]/confirm/route.ts", "utf8");
    assert.doesNotMatch(admin, /enqueueBackgroundJob|enqueueSchemeImportParse/);
    assert.doesNotMatch(teacher, /enqueueBackgroundJob|enqueueSchemeImportParse/);
  });
});
