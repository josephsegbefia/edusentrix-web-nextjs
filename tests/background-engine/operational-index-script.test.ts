/**
 * Proves scripts/ensure-operational-job-indexes.ts is safe: dry run by default,
 * --apply never drops or mutates documents, Prompt 4 has no unique targets,
 * unique-blocker still reports counts/ids only, and re-running is a no-op.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { disableAutoIndexing } from "../regression/helpers/disable-auto-indexing";

const DB_NAME = "operational_job_index_script";
const SCRIPT = path.resolve(process.cwd(), "scripts/ensure-operational-job-indexes.ts");
const run = promisify(execFile);

const SENSITIVE_NAME = "Ama Boateng";
const SENSITIVE_EMAIL = "ama.boateng@example.test";
const SENSITIVE_CSV = "firstName,lastName,email\nAma,Boateng,ama.boateng@example.test";
const SENSITIVE_BODY = "Dear parent, your fee balance is overdue.";
const SENSITIVE_PAYSTACK = "sk_test_paystack_not_for_logs";

let mongod: MongoMemoryServer;
let script: typeof import("../../scripts/ensure-operational-job-indexes");

before(
  async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.MONGO_DB_NAME = DB_NAME;
    script = await import("../../scripts/ensure-operational-job-indexes");
    disableAutoIndexing();
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
  await mongoose.connection.db!.dropDatabase();
});

const db = () => mongoose.connection.db!;
const bulk = () => db().collection("bulkimportjobs");

async function dbState() {
  const collections = (await db().listCollections().toArray()).map((c) => c.name).sort();
  const state: Record<string, { count: number; indexes: unknown[] }> = {};
  for (const name of collections) {
    state[name] = {
      count: await db().collection(name).countDocuments(),
      indexes: await db().collection(name).indexes(),
    };
  }
  return JSON.parse(JSON.stringify(state)) as typeof state;
}

function cli(...args: string[]) {
  return run(process.execPath, ["--import", "tsx", SCRIPT, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, MONGODB_URI: mongod.getUri(), MONGO_DB_NAME: DB_NAME },
  });
}

function assertNoSensitiveOutput(text: string) {
  assert.doesNotMatch(text, new RegExp(SENSITIVE_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(text, new RegExp(SENSITIVE_EMAIL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(text, /firstName,lastName,email/);
  assert.doesNotMatch(text, /Dear parent, your fee balance/);
  assert.doesNotMatch(text, /sk_test_paystack_not_for_logs/);
  assert.doesNotMatch(text, /mongodb(\+srv)?:\/\//i);
}

describe("operational job index script", () => {
  test("dry-run creates nothing and reports missing BulkImportJob indexes", async () => {
    const dry = await cli();
    assert.match(dry.stdout, /DRY RUN/);
    assert.match(dry.stdout, /Unique targets: none/);
    assert.match(dry.stdout, /MISSING\s+BulkImportJob \{schoolId\}/);
    assert.match(dry.stdout, /MISSING\s+BulkImportJob \{status\}/);
    assert.match(dry.stdout, /MISSING\s+BulkImportJob \{schoolId,createdAt\}/);
    assert.doesNotMatch(dry.stdout, /CREATED/);
    assert.doesNotMatch(dry.stdout, /targetKind/);
    assertNoSensitiveOutput(dry.stdout);
    assert.equal((await db().listCollections().toArray()).length, 0);
  });

  test("apply creates expected indexes; rerun reports PRESENT", async () => {
    const first = await script.applyOperationalJobIndexes();
    assert.equal(first.applied, true);
    assert.equal(first.created.length, 3);

    const indexes = await bulk().indexes();
    const schoolId = indexes.find((i) => Object.keys(i.key).join(",") === "schoolId");
    const status = indexes.find((i) => Object.keys(i.key).join(",") === "status");
    const compound = indexes.find((i) => Object.keys(i.key).join(",") === "schoolId,createdAt");
    assert.ok(schoolId);
    assert.ok(status);
    assert.deepEqual(compound?.key, { schoolId: 1, createdAt: -1 });
    assert.notEqual(schoolId?.unique, true);
    assert.notEqual(status?.unique, true);
    assert.notEqual(compound?.unique, true);
    assert.equal(
      indexes.some((i) => Object.keys(i.key).includes("targetKind")),
      false
    );
    assert.equal(
      indexes.some((i) => Object.keys(i.key).includes("fileBytes")),
      false
    );
    assert.equal(
      indexes.some((i) => Object.keys(i.key).includes("backgroundJobId")),
      false
    );

    const again = await script.applyOperationalJobIndexes();
    assert.equal(again.applied, true);
    assert.deepEqual(again.created, []);
    assert.ok(again.inspection.targets.every((t) => t.status === "present"));
  });

  test("Prompt 4 has no unique targets; unique-blocker reports counts and ids only", async () => {
    assert.equal(script.operationalIndexTargetsAreUnique(), false);

    const schoolId = new mongoose.Types.ObjectId();
    const firstId = new mongoose.Types.ObjectId();
    const secondId = new mongoose.Types.ObjectId();
    await bulk().insertMany([
      {
        _id: firstId,
        schoolId,
        fileName: SENSITIVE_NAME,
        fileBytes: Buffer.from(SENSITIVE_CSV),
        rowErrors: [{ row: 1, message: SENSITIVE_BODY }],
        result: { email: SENSITIVE_EMAIL, paystack: SENSITIVE_PAYSTACK },
      },
      {
        _id: secondId,
        schoolId,
        fileName: SENSITIVE_NAME,
        fileBytes: Buffer.from(SENSITIVE_CSV),
      },
    ]);

    const duplicates = await script.findOperationalIndexDuplicates({
      key: { schoolId: 1 },
      options: { unique: true },
    });
    assert.equal(duplicates.length, 1);
    assert.equal(duplicates[0]?.count, 2);
    assert.ok(duplicates[0]?.sampleIds.includes(String(firstId)));
    assert.ok(duplicates[0]?.sampleIds.includes(String(secondId)));

    assert.equal(
      script.inspectionIsBlocked({
        targets: [
          {
            label: "BulkImportJob {schoolId}",
            status: "missing",
            existingName: null,
            differences: [],
            spec: { key: { schoolId: 1 }, options: { unique: true } },
            duplicates,
          },
        ],
      }),
      true
    );

    const inspect = await script.inspectOperationalJobIndexes();
    assert.equal(inspect.blocked, false);
    assert.ok(inspect.targets.every((t) => t.duplicates.length === 0));
    assert.ok(inspect.targets.every((t) => !t.spec.options.unique));
  });

  test("a conflicting same-key index is reported and never dropped", async () => {
    await bulk().createIndex({ schoolId: 1 }, { name: "schoolId_1", unique: true });
    const before = await dbState();
    const inspection = await script.inspectOperationalJobIndexes();
    const schoolId = inspection.targets.find((t) => t.label === "BulkImportJob {schoolId}")!;
    assert.equal(schoolId.status, "conflict");
    assert.ok(schoolId.differences.includes("unique"));
    assert.equal(inspection.blocked, true);
    const result = await script.applyOperationalJobIndexes();
    assert.equal(result.applied, false);
    assert.deepEqual(await dbState(), before);
  });

  test("unrelated indexes and documents are untouched", async () => {
    const schoolId = new mongoose.Types.ObjectId();
    await bulk().insertOne({
      schoolId,
      targetKind: "students",
      status: "pending",
      fileName: SENSITIVE_NAME,
      fileBytes: Buffer.from(SENSITIVE_CSV),
      rowErrors: [{ row: 2, message: SENSITIVE_EMAIL }],
      result: { body: SENSITIVE_BODY, provider: SENSITIVE_PAYSTACK },
    });
    await bulk().createIndex({ createdBy: 1 }, { name: "unrelated_created_by_idx" });
    const docsBefore = await bulk().find({}).toArray();
    const before = await dbState();

    const first = await cli("--apply");
    assert.match(first.stdout, /CREATED\s+"schoolId_1"/);
    assert.match(first.stdout, /CREATED\s+"status_1"/);
    assert.match(first.stdout, /CREATED\s+"schoolId_1_createdAt_-1"/);
    assertNoSensitiveOutput(first.stdout);

    const after = await dbState();
    assert.deepEqual(await bulk().find({}).toArray(), docsBefore);
    for (const [name, state] of Object.entries(before)) {
      for (const index of state.indexes) {
        assert.ok(
          after[name].indexes.some((i) => JSON.stringify(i) === JSON.stringify(index)),
          `pre-existing index preserved: ${name} ${JSON.stringify(index)}`
        );
      }
    }
  });
});
