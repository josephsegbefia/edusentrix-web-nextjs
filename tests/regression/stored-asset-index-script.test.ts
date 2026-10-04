/**
 * Proves scripts/ensure-stored-asset-indexes.ts is safe: dry run by default,
 * --apply never drops or modifies documents, duplicate storageKey blocks
 * apply, and re-running is a no-op.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { disableAutoIndexing } from "./helpers/disable-auto-indexing";

const DB_NAME = "stored_asset_index_script";
const SCRIPT = path.resolve(process.cwd(), "scripts/ensure-stored-asset-indexes.ts");
const run = promisify(execFile);

let mongod: MongoMemoryServer;
let script: typeof import("../../scripts/ensure-stored-asset-indexes");

before(
  async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.MONGO_DB_NAME = DB_NAME;
    script = await import("../../scripts/ensure-stored-asset-indexes");
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
const assets = () => db().collection("storedassets");

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

describe("StoredAsset index script", () => {
  test("dry run is the default and --apply creates missing indexes only", async () => {
    const dry = await cli();
    assert.match(dry.stdout, /DRY RUN/);
    assert.doesNotMatch(dry.stdout, /CREATED/);

    const result = await script.applyStoredAssetIndexes();
    assert.equal(result.applied, true);
    assert.ok(result.created.length >= 1);
    const unique = (await assets().indexes()).find((i) => i.name === "unique_stored_asset_storage_key");
    assert.equal(unique?.unique, true);

    const again = await script.applyStoredAssetIndexes();
    assert.equal(again.applied, true);
    assert.deepEqual(again.created, []);
  });

  test("duplicate storageKey blocks apply and changes nothing", async () => {
    await assets().insertMany([
      { storageKey: "schools/abc/pending/notice_attachment/one.pdf" },
      { storageKey: "schools/abc/pending/notice_attachment/one.pdf" },
    ]);
    const before = await dbState();
    const inspection = await script.inspectStoredAssetIndexes();
    const unique = inspection.targets.find((t) => t.label.includes("storageKey"));
    assert.equal(unique?.status, "missing");
    assert.equal(unique?.duplicates.length, 1);
    assert.equal(inspection.blocked, true);

    const result = await script.applyStoredAssetIndexes();
    assert.equal(result.applied, false);
    assert.deepEqual(await dbState(), before);
  });

  test("a conflicting same-key index is reported and never dropped", async () => {
    await assets().createIndex({ storageKey: 1 }, { name: "storageKey_1" });
    const before = await dbState();
    const inspection = await script.inspectStoredAssetIndexes();
    const unique = inspection.targets.find((t) => t.label.includes("storageKey"))!;
    assert.equal(unique.status, "conflict");
    assert.equal(inspection.blocked, true);
    const result = await script.applyStoredAssetIndexes();
    assert.equal(result.applied, false);
    assert.deepEqual(await dbState(), before);
  });
});
