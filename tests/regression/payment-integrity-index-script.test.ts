/**
 * Proves scripts/ensure-payment-integrity-indexes.ts is safe to run:
 * valid definition, correct scope, dry run by default, --apply never drops or
 * modifies, and idempotent. In-memory MongoDB only.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { disableAutoIndexing } from "./helpers/disable-auto-indexing";
import { stubServerOnly } from "./helpers/stub-server-only";

stubServerOnly();

const DB_NAME = "payment_integrity_index_script";
const SCRIPT = path.resolve(process.cwd(), "scripts/ensure-payment-integrity-indexes.ts");
const run = promisify(execFile);

let replSet: MongoMemoryReplSet;
let script: typeof import("../../scripts/ensure-payment-integrity-indexes");

before(
  async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, name: "rs0" } });
    process.env.MONGODB_URI = replSet.getUri();
    process.env.MONGO_DB_NAME = DB_NAME;
    script = await import("../../scripts/ensure-payment-integrity-indexes");
    disableAutoIndexing();
    const { connectToDatabase } = await import("../../src/db/connectToDatabase");
    await connectToDatabase();
  },
  { timeout: 180_000 }
);

after(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  await mongoose.connection.db!.dropDatabase();
});

const db = () => mongoose.connection.db!;
const payments = () => db().collection("payments");

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
    env: { ...process.env, MONGODB_URI: replSet.getUri(), MONGO_DB_NAME: DB_NAME },
  });
}

describe("Payment.paystackReference index definition", () => {
  test("MongoDB accepts it and it enforces uniqueness only for non-empty string references", async () => {
    const result = await script.applyPaymentIntegrityIndexes();
    assert.equal(result.applied, true);
    const index = (await payments().indexes()).find((i) => i.name === "paystackReference_1");
    assert.equal(index?.unique, true);
    assert.deepEqual(index?.partialFilterExpression, { paystackReference: { $gt: "" } });
    assert.equal(index?.sparse, undefined);

    await payments().insertOne({ paystackReference: "REF-1" });
    await assert.rejects(payments().insertOne({ paystackReference: "REF-1" }), /E11000/);
    await payments().insertOne({ paystackReference: "REF-2" });

    // Legacy shapes must never block creation, even repeated.
    for (let i = 0; i < 2; i++) {
      await payments().insertOne({ paystackReference: null });
      await payments().insertOne({});
      await payments().insertOne({ paystackReference: "" });
      await payments().insertOne({ paystackReference: 12345 });
      await payments().insertOne({ paystackReference: { legacy: true } });
    }
    assert.equal(await payments().countDocuments(), 12);
  });
});

describe("duplicate detection", () => {
  test("string duplicates are reported and --apply refuses without changing anything", async () => {
    await payments().insertMany([
      { paystackReference: "DUP" },
      { paystackReference: "DUP" },
      { paystackReference: "OK" },
      { paystackReference: "" },
      { paystackReference: "" },
      { paystackReference: null },
      { paystackReference: null },
    ]);
    const before = await dbState();

    const inspection = await script.inspectPaymentIntegrityIndexes();
    const report = inspection.targets.find((t) => t.label.startsWith("Payment {"))!;
    assert.equal(report.status, "missing");
    assert.equal(report.duplicates.length, 1, "only the non-empty string duplicate counts");
    assert.deepEqual(report.duplicates[0].key, { paystackReference: "DUP" });
    assert.equal(inspection.blocked, true);

    const result = await script.applyPaymentIntegrityIndexes();
    assert.equal(result.applied, false);
    assert.deepEqual(await dbState(), before, "refused apply changed nothing");
  });

  test("an existing same-key index with a different definition is a conflict and is never dropped", async () => {
    await payments().createIndex(
      { paystackReference: 1 },
      { name: "paystackReference_1", unique: true, partialFilterExpression: { paystackReference: { $type: "string" } } }
    );
    const before = await dbState();
    const inspection = await script.inspectPaymentIntegrityIndexes();
    const report = inspection.targets.find((t) => t.label.startsWith("Payment {"))!;
    assert.equal(report.status, "conflict");
    assert.deepEqual(report.differences, ["partialFilterExpression"]);
    const result = await script.applyPaymentIntegrityIndexes();
    assert.equal(result.applied, false);
    assert.deepEqual(await dbState(), before);
  });
});

describe("CLI safety", () => {
  test("dry run is the default and is read-only (no indexes, collections or documents created)", async () => {
    await payments().insertOne({ paystackReference: "EXISTING" });
    const before = await dbState();
    const { stdout } = await cli();
    assert.match(stdout, /DRY RUN/);
    assert.match(stdout, /MISSING\s+Payment \{paystackReference\}/);
    assert.deepEqual(await dbState(), before);
  });

  test("--apply creates only the missing targets, never drops or modifies, and a second run is a no-op", async () => {
    await payments().insertMany([
      { paystackReference: "A", amountMinor: 1 },
      { paystackReference: null, amountMinor: 2 },
    ]);
    await payments().createIndex({ amountMinor: 1 }, { name: "unrelated_amount_idx" });
    const docsBefore = await payments().find({}).sort({ amountMinor: 1 }).toArray();
    const before = await dbState();

    const first = await cli("--apply");
    assert.match(first.stdout, /CREATED\s+"paystackReference_1"/);

    const after = await dbState();
    assert.deepEqual(await payments().find({}).sort({ amountMinor: 1 }).toArray(), docsBefore, "documents untouched");
    for (const [name, state] of Object.entries(before)) {
      for (const index of state.indexes) {
        assert.ok(
          after[name].indexes.some((i) => JSON.stringify(i) === JSON.stringify(index)),
          `pre-existing index preserved: ${name} ${JSON.stringify(index)}`
        );
      }
    }

    const second = await cli("--apply");
    assert.match(second.stdout, /Nothing to create/);
    assert.deepEqual(await dbState(), after, "second --apply is a no-op");
  });
});
