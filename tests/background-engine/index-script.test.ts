/**
 * Proves scripts/ensure-background-job-indexes.ts is safe: dry run by default,
 * --apply never drops or modifies documents, duplicate idempotency keys block
 * apply, and re-running is a no-op.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { disableAutoIndexing } from "../regression/helpers/disable-auto-indexing";

const DB_NAME = "background_job_index_script";
const SCRIPT = path.resolve(process.cwd(), "scripts/ensure-background-job-indexes.ts");
const run = promisify(execFile);

let mongod: MongoMemoryServer;
let script: typeof import("../../scripts/ensure-background-job-indexes");

before(
  async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.MONGO_DB_NAME = DB_NAME;
    script = await import("../../scripts/ensure-background-job-indexes");
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
const jobs = () => db().collection("backgroundjobs");

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

describe("BackgroundJob index script", () => {
  test("dry run is the default and --apply creates missing indexes only", async () => {
    const dry = await cli();
    assert.match(dry.stdout, /DRY RUN/);
    assert.doesNotMatch(dry.stdout, /CREATED/);
    assert.doesNotMatch(dry.stdout, /input/);

    const result = await script.applyBackgroundJobIndexes();
    assert.equal(result.applied, true);
    assert.ok(result.created.length >= 1);
    const unique = (await jobs().indexes()).find(
      (i) => i.name === "unique_background_job_idempotency"
    );
    assert.equal(unique?.unique, true);

    const again = await script.applyBackgroundJobIndexes();
    assert.equal(again.applied, true);
    assert.deepEqual(again.created, []);
  });

  test("duplicate idempotency keys block apply and change nothing", async () => {
    await jobs().insertMany([
      {
        tenantKey: "school:aaa",
        kind: "LIBRARY_IMPORT",
        idempotencyKey: "dup",
      },
      {
        tenantKey: "school:aaa",
        kind: "LIBRARY_IMPORT",
        idempotencyKey: "dup",
      },
    ]);
    const before = await dbState();
    const inspection = await script.inspectBackgroundJobIndexes();
    const unique = inspection.targets.find((t) => t.label.includes("idempotencyKey"));
    assert.equal(unique?.status, "missing");
    assert.equal(unique?.duplicates.length, 1);
    assert.equal(inspection.blocked, true);

    const result = await script.applyBackgroundJobIndexes();
    assert.equal(result.applied, false);
    assert.deepEqual(await dbState(), before);
  });

  test("a conflicting same-key index is reported and never dropped", async () => {
    await jobs().createIndex(
      { tenantKey: 1, kind: 1, idempotencyKey: 1 },
      { name: "tenantKey_1_kind_1_idempotencyKey_1" }
    );
    const before = await dbState();
    const inspection = await script.inspectBackgroundJobIndexes();
    const unique = inspection.targets.find((t) => t.label.includes("idempotencyKey"))!;
    assert.equal(unique.status, "conflict");
    assert.equal(inspection.blocked, true);
    const result = await script.applyBackgroundJobIndexes();
    assert.equal(result.applied, false);
    assert.deepEqual(await dbState(), before);
  });
});
