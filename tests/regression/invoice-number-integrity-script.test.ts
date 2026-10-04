/**
 * Proves scripts/ensure-invoice-number-integrity.ts prepares existing data
 * safely: dry run by default, refuses on same-school duplicates, seeds
 * counters from the highest existing sequence (never a count), reports
 * malformed numbers, is idempotent, never modifies invoices, and never drops
 * an index unless --drop-legacy-global-index is passed. In-memory MongoDB only.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { disableAutoIndexing } from "./helpers/disable-auto-indexing";

const DB_NAME = "invoice_number_integrity_script";
const SCRIPT = path.resolve(process.cwd(), "scripts/ensure-invoice-number-integrity.ts");
const run = promisify(execFile);

let mongod: MongoMemoryServer;
let script: typeof import("../../scripts/ensure-invoice-number-integrity");

before(
  async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.MONGO_DB_NAME = DB_NAME;
    script = await import("../../scripts/ensure-invoice-number-integrity");
    disableAutoIndexing();
    const { connectToDatabase } = await import("../../src/db/connectToDatabase");
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
const invoices = () => db().collection("invoices");
const counters = () => db().collection<{ _id: string; seq: number }>("invoicenumbersequences");
const oid = () => new mongoose.Types.ObjectId();
const invoice = (schoolId: mongoose.Types.ObjectId, invoiceNumber: unknown) => ({
  schoolId,
  studentId: oid(),
  academicPeriodId: oid(),
  invoiceNumber,
});

async function dbState() {
  const collections = (await db().listCollections().toArray()).map((c) => c.name).sort();
  const state: Record<string, { docs: unknown[]; indexes: unknown[] }> = {};
  for (const name of collections) {
    state[name] = {
      docs: await db().collection(name).find({}).sort({ _id: 1 }).toArray(),
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

describe("dry run", () => {
  test("reports indexes, sequences, cross-school duplicates and malformed numbers without writing", async () => {
    const a = oid();
    const b = oid();
    await invoices().createIndex({ invoiceNumber: 1 }, { name: "invoiceNumber_1" });
    await invoices().insertMany([
      invoice(a, "INV-2026-0001"),
      invoice(a, "INV-2026-0007"),
      invoice(a, "INV-2025-0042"),
      invoice(a, "DEMO-1234-abcdef"),
      invoice(b, "INV-2026-0001"),
      invoice(b, null),
    ]);
    const before = await dbState();

    const inspection = await script.inspectInvoiceNumberIntegrity();
    assert.equal(inspection.totalInvoices, 6);
    assert.equal(inspection.targetIndex.status, "missing");
    assert.deepEqual(inspection.legacyGlobalIndex, {
      status: "LEGACY_GLOBAL_NON_UNIQUE",
      name: "invoiceNumber_1",
    });
    assert.equal(inspection.sameSchoolDuplicates.length, 0);
    assert.equal(inspection.crossSchoolDuplicates.total, 1);
    assert.equal(inspection.crossSchoolDuplicates.samples[0]!.invoiceNumber, "INV-2026-0001");
    assert.equal(inspection.blocked, false);

    const byKey = Object.fromEntries(inspection.sequences.map((s) => [`${s.schoolId}:${s.year}`, s]));
    assert.equal(byKey[`${a}:2026`]!.maxSequence, 7, "highest, not count (2 invoices)");
    assert.equal(byKey[`${a}:2026`]!.invoiceCount, 2);
    assert.equal(byKey[`${a}:2026`]!.action, "create_counter");
    assert.equal(byKey[`${a}:2025`]!.maxSequence, 42);
    assert.equal(byKey[`${b}:2026`]!.maxSequence, 1);

    const malformed = inspection.malformed.reduce((sum, m) => sum + m.count, 0);
    assert.equal(malformed, 2, "DEMO-* and null reported as NEEDS_REVIEW");

    assert.deepEqual(await dbState(), before, "inspection is read-only");
  });

  test("CLI defaults to a read-only dry run", async () => {
    await invoices().insertMany([invoice(oid(), "INV-2026-0003"), invoice(oid(), "weird")]);
    const before = await dbState();
    const { stdout } = await cli();
    assert.match(stdout, /DRY RUN/);
    assert.match(stdout, /MISSING\s+invoices \{schoolId, invoiceNumber\} UNIQUE: would create "unique_school_invoice_number"/);
    assert.match(stdout, /would create counter at 3/);
    assert.match(stdout, /NEEDS_REVIEW malformed invoice numbers \(not INV-YYYY-N\): 1/);
    assert.deepEqual(await dbState(), before);
  });
});

describe("refusals", () => {
  test("same-school duplicates block --apply and nothing changes", async () => {
    const a = oid();
    await invoices().insertMany([
      invoice(a, "INV-2026-0002"),
      invoice(a, "INV-2026-0002"),
      invoice(a, "INV-2026-0003"),
    ]);
    const before = await dbState();

    const inspection = await script.inspectInvoiceNumberIntegrity();
    assert.equal(inspection.sameSchoolDuplicates.length, 1);
    assert.equal(inspection.sameSchoolDuplicates[0]!.invoiceNumber, "INV-2026-0002");
    assert.equal(inspection.sameSchoolDuplicates[0]!.count, 2);
    assert.equal(inspection.blocked, true);

    const result = await script.applyInvoiceNumberIntegrity({ dropLegacyGlobalIndex: true });
    assert.equal(result.applied, false);
    assert.deepEqual(await dbState(), before, "refused apply changed nothing");

    await assert.rejects(cli("--apply"), (err: { stdout?: string; stderr?: string }) => {
      assert.match(String(err.stderr), /Refusing to apply/);
      return true;
    });
    assert.deepEqual(await dbState(), before);
  });

  test("a non-unique index with the target key is a conflict and is never dropped", async () => {
    await invoices().createIndex({ schoolId: 1, invoiceNumber: 1 }, { name: "school_number_plain" });
    const before = await dbState();
    const inspection = await script.inspectInvoiceNumberIntegrity();
    assert.equal(inspection.targetIndex.status, "conflict");
    const result = await script.applyInvoiceNumberIntegrity();
    assert.equal(result.applied, false);
    assert.deepEqual(await dbState(), before);
  });

  test("--drop-legacy-global-index without --apply is rejected", async () => {
    await assert.rejects(cli("--drop-legacy-global-index"), (err: { stderr?: string }) => {
      assert.match(String(err.stderr), /requires --apply/);
      return true;
    });
  });
});

describe("apply", () => {
  test("creates the index, seeds counters from the highest number, keeps invoices and indexes, idempotent", async () => {
    const a = oid();
    const b = oid();
    await invoices().createIndex({ invoiceNumber: 1 }, { name: "invoiceNumber_1", unique: true });
    await invoices().createIndex({ schoolId: 1, status: 1 }, { name: "unrelated_status_idx" });
    await invoices().insertMany([
      invoice(a, "INV-2026-0001"),
      invoice(a, "INV-2026-0007"),
      invoice(b, "INV-2026-0003"),
      invoice(b, "LEGACY-9"),
    ]);
    // An existing counter above the legacy max must never be lowered.
    await counters().insertOne({ _id: `invoice:${b}:2026`, seq: 10 });
    const docsBefore = await invoices().find({}).sort({ _id: 1 }).toArray();
    const indexesBefore = await invoices().indexes();

    const first = await cli("--apply");
    assert.match(first.stdout, /CREATED\s+index "unique_school_invoice_number"/);
    assert.match(first.stdout, new RegExp(`SEEDED\\s+invoice:${a}:2026 -> at least 7`));
    assert.match(first.stdout, /LEGACY_GLOBAL_UNIQUE "invoiceNumber_1"/);

    assert.deepEqual(await invoices().find({}).sort({ _id: 1 }).toArray(), docsBefore, "invoices untouched");
    const indexesAfter = await invoices().indexes();
    for (const index of indexesBefore) {
      assert.ok(
        indexesAfter.some((i) => JSON.stringify(i) === JSON.stringify(index)),
        `pre-existing index preserved: ${JSON.stringify(index)}`
      );
    }
    const target = indexesAfter.find((i) => i.name === "unique_school_invoice_number");
    assert.deepEqual(target?.key, { schoolId: 1, invoiceNumber: 1 });
    assert.equal(target?.unique, true);

    assert.equal((await counters().findOne({ _id: `invoice:${a}:2026` }))?.seq, 7, "0001 + 0007 -> 7");
    assert.equal((await counters().findOne({ _id: `invoice:${b}:2026` }))?.seq, 10, "never lowered");

    const { allocateInvoiceNumber } = await import("../../src/lib/fees/invoice-numbering");
    assert.equal(await allocateInvoiceNumber(a, 2026), "INV-2026-0008");

    const stateAfterFirst = await dbState();
    const second = await cli("--apply");
    assert.match(second.stdout, /Nothing to change/);
    assert.deepEqual(await dbState(), stateAfterFirst, "second --apply is a no-op");
  });

  test("--drop-legacy-global-index drops only the {invoiceNumber} index, after the compound index exists", async () => {
    const a = oid();
    await invoices().createIndex({ invoiceNumber: 1 }, { name: "invoiceNumber_1", unique: true });
    await invoices().createIndex({ schoolId: 1, status: 1 }, { name: "unrelated_status_idx" });
    await invoices().insertOne(invoice(a, "INV-2026-0004"));
    const docsBefore = await invoices().find({}).toArray();

    const { stdout } = await cli("--apply", "--drop-legacy-global-index");
    assert.match(stdout, /DROPPED\s+legacy index "invoiceNumber_1"/);

    const names = (await invoices().indexes()).map((i) => i.name).sort();
    assert.deepEqual(names, ["_id_", "unique_school_invoice_number", "unrelated_status_idx"]);
    assert.deepEqual(await invoices().find({}).toArray(), docsBefore);

    await invoices().insertOne(invoice(oid(), "INV-2026-0004"));
    assert.equal(await invoices().countDocuments({ invoiceNumber: "INV-2026-0004" }), 2);
  });
});
