/**
 * Proves scripts/ensure-leo-cache-promotion-indexes.ts installs the
 * LeoResponseCache TTL index and the PromotionCycle unique idempotency index
 * safely: dry run by default, --apply never drops or modifies, refuses on
 * duplicates/conflicts, idempotent. In-memory MongoDB only.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { disableAutoIndexing } from "./regression/helpers/disable-auto-indexing";

const DB_NAME = "leo_promotion_index_script";
const SCRIPT = path.resolve(process.cwd(), "scripts/ensure-leo-cache-promotion-indexes.ts");
const run = promisify(execFile);

let mongod: MongoMemoryServer;
let script: typeof import("../scripts/ensure-leo-cache-promotion-indexes");

before(
  async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.MONGO_DB_NAME = DB_NAME;
    script = await import("../scripts/ensure-leo-cache-promotion-indexes");
    disableAutoIndexing();
    const { connectToDatabase } = await import("../src/db/connectToDatabase");
    await connectToDatabase();
  },
  { timeout: 180_000 }
);

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await mongoose.connection.db!.dropDatabase();
});

const db = () => mongoose.connection.db!;
const caches = () => db().collection("leoresponsecaches");
const cycles = () => db().collection("promotioncycles");

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

describe("apply", () => {
  test("creates the TTL index with its options and an enforced unique idempotency index", async () => {
    const result = await script.applyLeoPromotionIndexes();
    assert.equal(result.applied, true);

    const ttl = (await caches().indexes()).filter((i) => Object.keys(i.key).join(",") === "expiresAt");
    assert.equal(ttl.length, 1, "exactly one expiresAt index");
    assert.equal(ttl[0].name, "expiresAt_1");
    assert.equal(ttl[0].expireAfterSeconds, 0);
    assert.equal(ttl[0].unique, undefined);

    const uniq = (await cycles().indexes()).filter((i) => Object.keys(i.key).join(",") === "idempotencyKey");
    assert.equal(uniq.length, 1, "exactly one idempotencyKey index");
    assert.equal(uniq[0].name, "idempotencyKey_1");
    assert.equal(uniq[0].unique, true);
    assert.equal(uniq[0].sparse, undefined);
    assert.equal(uniq[0].partialFilterExpression, undefined);

    await cycles().insertOne({ idempotencyKey: "preview-a" });
    await assert.rejects(cycles().insertOne({ idempotencyKey: "preview-a" }), /E11000/);
    await cycles().insertOne({ idempotencyKey: "preview-b" });
    assert.equal(await cycles().countDocuments(), 2);

    const again = await script.applyLeoPromotionIndexes();
    assert.equal(again.applied, true);
    assert.deepEqual(again.applied && again.created, []);
  });
});

describe("refusals", () => {
  test("duplicate idempotency keys are reported and --apply refuses without changing anything", async () => {
    await cycles().insertMany([
      { idempotencyKey: "preview-dup" },
      { idempotencyKey: "preview-dup" },
      { idempotencyKey: "preview-ok" },
    ]);
    const before = await dbState();

    const inspection = await script.inspectLeoPromotionIndexes();
    const report = inspection.targets.find((t) => t.label.startsWith("PromotionCycle"))!;
    assert.equal(report.status, "missing");
    assert.equal(report.duplicates.length, 1);
    assert.deepEqual(report.duplicates[0].key, { idempotencyKey: "preview-dup" });
    assert.equal(inspection.blocked, true);

    const result = await script.applyLeoPromotionIndexes();
    assert.equal(result.applied, false);
    assert.deepEqual(await dbState(), before, "refused apply changed nothing");
  });

  test("an existing plain expiresAt index is a TTL conflict and is never dropped", async () => {
    await caches().createIndex({ expiresAt: 1 }, { name: "expiresAt_1" });
    const before = await dbState();

    const inspection = await script.inspectLeoPromotionIndexes();
    const report = inspection.targets.find((t) => t.label.startsWith("LeoResponseCache"))!;
    assert.equal(report.status, "conflict");
    assert.deepEqual(report.differences, ["expireAfterSeconds"]);

    const result = await script.applyLeoPromotionIndexes();
    assert.equal(result.applied, false);
    assert.deepEqual(await dbState(), before);
  });
});

describe("CLI safety", () => {
  test("dry run is the default, read-only, and states the TTL explicitly", async () => {
    await cycles().insertOne({ idempotencyKey: "preview-existing" });
    const before = await dbState();
    const { stdout } = await cli();
    assert.match(stdout, /DRY RUN/);
    assert.match(stdout, /MISSING\s+LeoResponseCache \{expiresAt\}: would create TTL expireAfterSeconds=0/);
    assert.match(stdout, /MISSING\s+PromotionCycle \{idempotencyKey\}: would create UNIQUE/);
    assert.deepEqual(await dbState(), before);
  });

  test("--apply creates only the two targets, never drops or modifies, and a second run is a no-op", async () => {
    const past = new Date(Date.now() - 60_000);
    await caches().insertOne({ cacheKey: "k", expiresAt: new Date(Date.now() + 3_600_000) });
    await cycles().insertOne({ idempotencyKey: "preview-1", status: "draft", createdAt: past });
    await cycles().createIndex({ status: 1 }, { name: "unrelated_status_idx" });
    const docsBefore = {
      caches: await caches().find({}).toArray(),
      cycles: await cycles().find({}).toArray(),
    };
    const before = await dbState();

    const first = await cli("--apply");
    assert.match(first.stdout, /CREATED\s+"expiresAt_1"/);
    assert.match(first.stdout, /CREATED\s+"idempotencyKey_1"/);

    const after = await dbState();
    assert.deepEqual(await caches().find({}).toArray(), docsBefore.caches, "cache documents untouched");
    assert.deepEqual(await cycles().find({}).toArray(), docsBefore.cycles, "cycle documents untouched");
    for (const [name, state] of Object.entries(before)) {
      for (const index of state.indexes) {
        assert.ok(
          after[name].indexes.some((i) => JSON.stringify(i) === JSON.stringify(index)),
          `pre-existing index preserved: ${name} ${JSON.stringify(index)}`
        );
      }
    }
    assert.equal(after.leoresponsecaches.indexes.length, before.leoresponsecaches.indexes.length + 1);
    assert.equal(after.promotioncycles.indexes.length, before.promotioncycles.indexes.length + 1);

    const second = await cli("--apply");
    assert.match(second.stdout, /Nothing to create/);
    assert.deepEqual(await dbState(), after, "second --apply is a no-op");
  });
});
