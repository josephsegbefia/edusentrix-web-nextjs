/**
 * Prepare existing data for per-school atomic invoice numbering.
 *
 * Invoice numbers (INV-{year}-{sequence}) are now allocated from a durable
 * per-school, per-year counter (InvoiceNumberSequence) and are unique per
 * school ({schoolId, invoiceNumber}) instead of globally. Production connects
 * with autoIndex disabled, so the compound index and the counters must be
 * prepared explicitly.
 *
 * Usage:
 *   npx tsx scripts/ensure-invoice-number-integrity.ts            # dry run (default)
 *   npx tsx scripts/ensure-invoice-number-integrity.ts --apply    # create index + seed counters
 *   npx tsx scripts/ensure-invoice-number-integrity.ts --apply --drop-legacy-global-index
 *
 * Dry run is read-only and reports: invoice indexes (target compound index and
 * the legacy global invoiceNumber index), same-school duplicate numbers
 * (BLOCKING), cross-school duplicate numbers (informational), the highest
 * sequence per school/year, existing counters and the planned seed, and
 * malformed numbers (NEEDS_REVIEW).
 *
 * --apply refuses while same-school duplicates or a conflicting index exist.
 * Otherwise it creates the compound unique index if missing and seeds each
 * counter with $max to the highest existing sequence (never lowers a counter;
 * re-running is a no-op). It never deletes invoices, never modifies invoice
 * numbers and never drops indexes.
 *
 * --drop-legacy-global-index (explicit opt-in, requires --apply) additionally
 * drops the legacy index whose key is exactly {invoiceNumber: 1}, and only
 * after the compound unique index is verified present.
 *
 * Env: MONGODB_URI, MONGO_DB_NAME (via .env.local or .env)
 */
import { resolve } from "path";
import mongoose from "mongoose";
import { connectToDatabase } from "../src/db/connectToDatabase";
import { Invoice } from "../src/models/Invoice";
import {
  InvoiceNumberSequence,
  invoiceNumberSequenceKey,
} from "../src/models/InvoiceNumberSequence";
import { parseInvoiceNumber } from "../src/lib/fees/invoice-utils";

const TARGET_KEY = { schoolId: 1, invoiceNumber: 1 } as const;
export const TARGET_INDEX_NAME = "unique_school_invoice_number";
const SAMPLE_LIMIT = 20;

type ExistingIndex = {
  name?: string;
  key: Record<string, unknown>;
  unique?: boolean;
  sparse?: boolean;
  partialFilterExpression?: unknown;
};

export type TargetIndexReport = {
  status: "present" | "missing" | "conflict";
  existingName: string | null;
  differences: string[];
};

export type LegacyGlobalIndexReport = {
  status: "LEGACY_GLOBAL_UNIQUE" | "LEGACY_GLOBAL_NON_UNIQUE";
  name: string;
};

export type DuplicateGroup = {
  schoolId: string | null;
  invoiceNumber: string | null;
  count: number;
  invoiceIds: string[];
};

export type CrossSchoolDuplicate = {
  invoiceNumber: string;
  schoolIds: string[];
};

export type SchoolYearSequence = {
  schoolId: string;
  year: number;
  invoiceCount: number;
  maxSequence: number;
  counterKey: string;
  counterSeq: number | null;
  action: "create_counter" | "raise_counter" | "ok";
};

export type MalformedReport = {
  schoolId: string | null;
  count: number;
  samples: Array<{ invoiceId: string; invoiceNumber: unknown }>;
};

export type InvoiceNumberInspection = {
  targetIndex: TargetIndexReport;
  legacyGlobalIndex: LegacyGlobalIndexReport | null;
  sameSchoolDuplicates: DuplicateGroup[];
  crossSchoolDuplicates: { total: number; samples: CrossSchoolDuplicate[] };
  sequences: SchoolYearSequence[];
  orphanCounters: Array<{ key: string; seq: number }>;
  malformed: MalformedReport[];
  totalInvoices: number;
  blocked: boolean;
  blockReasons: string[];
};

function sameKey(key: Record<string, unknown>, expected: Record<string, unknown>) {
  const a = Object.entries(key);
  const b = Object.entries(expected);
  return a.length === b.length && a.every(([k, v], i) => b[i]?.[0] === k && b[i]?.[1] === v);
}

async function existingIndexes(): Promise<ExistingIndex[]> {
  try {
    return (await Invoice.collection.indexes()) as ExistingIndex[];
  } catch (error) {
    if ((error as { codeName?: string }).codeName === "NamespaceNotFound") return [];
    throw error;
  }
}

function inspectTargetIndex(indexes: ExistingIndex[]): TargetIndexReport {
  const byKey = indexes.find((idx) => sameKey(idx.key, TARGET_KEY));
  const byName = indexes.find((idx) => idx.name === TARGET_INDEX_NAME);
  if (byName && !sameKey(byName.key, TARGET_KEY)) {
    return {
      status: "conflict",
      existingName: byName.name ?? null,
      differences: [`index "${TARGET_INDEX_NAME}" exists with key ${JSON.stringify(byName.key)}`],
    };
  }
  if (!byKey) return { status: "missing", existingName: null, differences: [] };
  const differences: string[] = [];
  if (!byKey.unique) differences.push("unique");
  if (byKey.sparse) differences.push("sparse");
  if (byKey.partialFilterExpression) differences.push("partialFilterExpression");
  return {
    status: differences.length > 0 ? "conflict" : "present",
    existingName: byKey.name ?? null,
    differences,
  };
}

function inspectLegacyGlobalIndex(indexes: ExistingIndex[]): LegacyGlobalIndexReport | null {
  const legacy = indexes.find((idx) => sameKey(idx.key, { invoiceNumber: 1 }));
  if (!legacy?.name) return null;
  return {
    status: legacy.unique ? "LEGACY_GLOBAL_UNIQUE" : "LEGACY_GLOBAL_NON_UNIQUE",
    name: legacy.name,
  };
}

async function findSameSchoolDuplicates(): Promise<DuplicateGroup[]> {
  const rows = await Invoice.collection
    .aggregate<{
      _id: { schoolId: unknown; invoiceNumber: unknown };
      count: number;
      ids: unknown[];
    }>([
      {
        $group: {
          _id: { schoolId: "$schoolId", invoiceNumber: "$invoiceNumber" },
          count: { $sum: 1 },
          ids: { $push: "$_id" },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 100 },
    ])
    .toArray();
  return rows.map((row) => ({
    schoolId: row._id.schoolId == null ? null : String(row._id.schoolId),
    invoiceNumber: row._id.invoiceNumber == null ? null : String(row._id.invoiceNumber),
    count: row.count,
    invoiceIds: row.ids.map(String),
  }));
}

async function findCrossSchoolDuplicates() {
  const [result] = await Invoice.collection
    .aggregate<{
      total: Array<{ n: number }>;
      samples: Array<{ _id: unknown; schoolIds: unknown[] }>;
    }>([
      { $match: { invoiceNumber: { $type: "string" } } },
      { $group: { _id: "$invoiceNumber", schoolIds: { $addToSet: "$schoolId" } } },
      { $match: { "schoolIds.1": { $exists: true } } },
      {
        $facet: {
          total: [{ $count: "n" }],
          samples: [{ $sort: { _id: 1 } }, { $limit: SAMPLE_LIMIT }],
        },
      },
    ])
    .toArray();
  return {
    total: result?.total[0]?.n ?? 0,
    samples: (result?.samples ?? []).map((row) => ({
      invoiceNumber: String(row._id),
      schoolIds: row.schoolIds.map(String).sort(),
    })),
  };
}

/** Read-only. */
export async function inspectInvoiceNumberIntegrity(): Promise<InvoiceNumberInspection> {
  const indexes = await existingIndexes();
  const targetIndex = inspectTargetIndex(indexes);
  const legacyGlobalIndex = inspectLegacyGlobalIndex(indexes);
  const sameSchoolDuplicates = await findSameSchoolDuplicates();
  const crossSchoolDuplicates = await findCrossSchoolDuplicates();

  const bySchoolYear = new Map<string, { schoolId: string; year: number; count: number; max: number }>();
  const malformedBySchool = new Map<string, MalformedReport>();
  let totalInvoices = 0;

  const cursor = Invoice.collection.find(
    {},
    { projection: { schoolId: 1, invoiceNumber: 1 } }
  );
  for await (const doc of cursor) {
    totalInvoices += 1;
    const schoolId = doc.schoolId == null ? null : String(doc.schoolId);
    const parsed = parseInvoiceNumber(doc.invoiceNumber);
    if (!parsed || !schoolId) {
      const bucketKey = schoolId ?? "(missing schoolId)";
      const bucket = malformedBySchool.get(bucketKey) ?? { schoolId, count: 0, samples: [] };
      bucket.count += 1;
      if (bucket.samples.length < 5) {
        bucket.samples.push({ invoiceId: String(doc._id), invoiceNumber: doc.invoiceNumber ?? null });
      }
      malformedBySchool.set(bucketKey, bucket);
      continue;
    }
    const key = invoiceNumberSequenceKey(schoolId, parsed.year);
    const entry = bySchoolYear.get(key) ?? { schoolId, year: parsed.year, count: 0, max: 0 };
    entry.count += 1;
    entry.max = Math.max(entry.max, parsed.sequence);
    bySchoolYear.set(key, entry);
  }

  const counters = await InvoiceNumberSequence.collection
    .find({}, { projection: { seq: 1 } })
    .toArray();
  const counterSeqByKey = new Map(counters.map((c) => [String(c._id), Number(c.seq ?? 0)]));

  const sequences: SchoolYearSequence[] = [...bySchoolYear.entries()]
    .map(([counterKey, entry]) => {
      const counterSeq = counterSeqByKey.has(counterKey) ? counterSeqByKey.get(counterKey)! : null;
      const action: SchoolYearSequence["action"] =
        counterSeq === null ? "create_counter" : counterSeq < entry.max ? "raise_counter" : "ok";
      return {
        schoolId: entry.schoolId,
        year: entry.year,
        invoiceCount: entry.count,
        maxSequence: entry.max,
        counterKey,
        counterSeq,
        action,
      };
    })
    .sort((a, b) => a.schoolId.localeCompare(b.schoolId) || a.year - b.year);

  const orphanCounters = [...counterSeqByKey.entries()]
    .filter(([key]) => !bySchoolYear.has(key))
    .map(([key, seq]) => ({ key, seq }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const blockReasons: string[] = [];
  if (sameSchoolDuplicates.length > 0) {
    blockReasons.push(
      `${sameSchoolDuplicates.length} same-school duplicate invoice number group(s); resolve manually`
    );
  }
  if (targetIndex.status === "conflict") {
    blockReasons.push(`conflicting index definition: ${targetIndex.differences.join("; ")}`);
  }

  return {
    targetIndex,
    legacyGlobalIndex,
    sameSchoolDuplicates,
    crossSchoolDuplicates,
    sequences,
    orphanCounters,
    malformed: [...malformedBySchool.values()],
    totalInvoices,
    blocked: blockReasons.length > 0,
    blockReasons,
  };
}

export type ApplyInvoiceNumberResult =
  | { applied: false; reason: "blocked"; inspection: InvoiceNumberInspection }
  | {
      applied: true;
      inspection: InvoiceNumberInspection;
      createdIndex: string | null;
      seededCounters: Array<{ key: string; seq: number }>;
      droppedLegacyIndex: string | null;
      errors: string[];
    };

/**
 * Creates the compound index if missing and seeds counters with $max. Drops
 * the legacy global index only when `dropLegacyGlobalIndex` is set and the
 * compound unique index is verified present. Never touches invoice documents.
 */
export async function applyInvoiceNumberIntegrity(
  options: { dropLegacyGlobalIndex?: boolean } = {}
): Promise<ApplyInvoiceNumberResult> {
  const inspection = await inspectInvoiceNumberIntegrity();
  if (inspection.blocked) return { applied: false, reason: "blocked", inspection };

  const errors: string[] = [];
  let createdIndex: string | null = null;
  if (inspection.targetIndex.status === "missing") {
    try {
      createdIndex = await Invoice.collection.createIndex(TARGET_KEY, {
        unique: true,
        name: TARGET_INDEX_NAME,
      });
    } catch (error) {
      const err = error as { code?: number; codeName?: string; message?: string };
      errors.push(`create ${TARGET_INDEX_NAME}: ${err.codeName ?? err.code ?? "error"} ${String(err.message ?? error)}`);
    }
  }

  const seededCounters: Array<{ key: string; seq: number }> = [];
  for (const row of inspection.sequences) {
    if (row.action === "ok") continue;
    await InvoiceNumberSequence.updateOne(
      { _id: row.counterKey },
      {
        $max: { seq: row.maxSequence },
        $setOnInsert: { schoolId: new mongoose.Types.ObjectId(row.schoolId), year: row.year },
      },
      { upsert: true }
    );
    seededCounters.push({ key: row.counterKey, seq: row.maxSequence });
  }

  let droppedLegacyIndex: string | null = null;
  if (options.dropLegacyGlobalIndex) {
    const after = await existingIndexes();
    const target = inspectTargetIndex(after);
    const legacy = inspectLegacyGlobalIndex(after);
    if (target.status !== "present") {
      errors.push(
        `refusing to drop legacy global index: ${TARGET_INDEX_NAME} is ${target.status}, not present`
      );
    } else if (legacy) {
      await Invoice.collection.dropIndex(legacy.name);
      droppedLegacyIndex = legacy.name;
    }
  }

  return { applied: true, inspection, createdIndex, seededCounters, droppedLegacyIndex, errors };
}

function printInspection(inspection: InvoiceNumberInspection, dropLegacyRequested: boolean) {
  console.log(`Invoices scanned: ${inspection.totalInvoices}\n`);

  const t = inspection.targetIndex;
  const head = `${t.status.toUpperCase().padEnd(11)} invoices {schoolId, invoiceNumber} UNIQUE`;
  if (t.status === "missing") console.log(`${head}: would create "${TARGET_INDEX_NAME}"`);
  if (t.status === "present") console.log(`${head} as "${t.existingName}"`);
  if (t.status === "conflict") console.log(`${head}: ${t.differences.join("; ")}; review manually`);

  const legacy = inspection.legacyGlobalIndex;
  if (!legacy) {
    console.log("NONE        legacy global {invoiceNumber} index");
  } else {
    console.log(`${legacy.status} "${legacy.name}" on {invoiceNumber}`);
    if (legacy.status === "LEGACY_GLOBAL_UNIQUE") {
      console.log(
        "  This still blocks the same INV number in two different schools. After the compound index is present," +
          (dropLegacyRequested
            ? " --drop-legacy-global-index will drop it."
            : ` drop it with --apply --drop-legacy-global-index, or manually: db.invoices.dropIndex("${legacy.name}")`)
      );
    }
  }

  console.log(`\nSame-school duplicates (BLOCKING): ${inspection.sameSchoolDuplicates.length}`);
  for (const dup of inspection.sameSchoolDuplicates) {
    console.log(
      `  school ${dup.schoolId} number ${JSON.stringify(dup.invoiceNumber)}: ${dup.count} invoices [${dup.invoiceIds.join(", ")}]`
    );
  }

  console.log(`\nCross-school duplicate numbers (informational): ${inspection.crossSchoolDuplicates.total}`);
  for (const dup of inspection.crossSchoolDuplicates.samples) {
    console.log(`  ${dup.invoiceNumber}: schools [${dup.schoolIds.join(", ")}]`);
  }

  console.log(`\nHighest sequence per school/year: ${inspection.sequences.length}`);
  for (const row of inspection.sequences) {
    const counter = row.counterSeq === null ? "none" : String(row.counterSeq);
    const plan =
      row.action === "ok"
        ? "ok (counter already at or above max)"
        : row.action === "create_counter"
          ? `would create counter at ${row.maxSequence}`
          : `would raise counter to ${row.maxSequence}`;
    console.log(
      `  school ${row.schoolId} ${row.year}: ${row.invoiceCount} invoices, max ${row.maxSequence}, counter ${counter} -> ${plan}`
    );
  }
  if (inspection.orphanCounters.length > 0) {
    console.log("\nCounters without matching INV-format invoices (left unchanged):");
    for (const c of inspection.orphanCounters) console.log(`  ${c.key}: seq ${c.seq}`);
  }

  const malformedTotal = inspection.malformed.reduce((sum, m) => sum + m.count, 0);
  console.log(`\nNEEDS_REVIEW malformed invoice numbers (not INV-YYYY-N): ${malformedTotal}`);
  for (const m of inspection.malformed) {
    console.log(`  school ${m.schoolId ?? "(missing)"}: ${m.count}`);
    for (const s of m.samples) console.log(`    ${s.invoiceId}: ${JSON.stringify(s.invoiceNumber)}`);
  }
}

async function main() {
  const { config } = await import("dotenv");
  config({ path: resolve(process.cwd(), ".env.local") });
  config({ path: resolve(process.cwd(), ".env") });

  const apply = process.argv.includes("--apply");
  const dropLegacy = process.argv.includes("--drop-legacy-global-index");
  if (dropLegacy && !apply) {
    throw new Error("--drop-legacy-global-index requires --apply");
  }

  // Outside production the connection enables autoIndex/autoCreate, which
  // would build indexes and collections on connect. Disable them so a dry run
  // is truly read-only and --apply creates only what it reports.
  for (const name of mongoose.modelNames()) {
    mongoose.model(name).schema.set("autoIndex", false);
    mongoose.model(name).schema.set("autoCreate", false);
  }
  await connectToDatabase();
  console.log(`Database: ${mongoose.connection.name}`);
  console.log(
    `Mode: ${
      apply
        ? `APPLY (create index, seed counters${dropLegacy ? ", drop legacy global index" : ", never drop"})`
        : "DRY RUN (read-only)"
    }\n`
  );

  if (!apply) {
    const inspection = await inspectInvoiceNumberIntegrity();
    printInspection(inspection, false);
    console.log(
      inspection.blocked
        ? `\nDry run complete. --apply would refuse:\n  ${inspection.blockReasons.join("\n  ")}`
        : "\nDry run complete. Re-run with --apply to create the index and seed counters."
    );
    return;
  }

  const result = await applyInvoiceNumberIntegrity({ dropLegacyGlobalIndex: dropLegacy });
  printInspection(result.inspection, dropLegacy);
  if (!result.applied) {
    throw new Error(`Refusing to apply:\n  ${result.inspection.blockReasons.join("\n  ")}`);
  }
  console.log("");
  if (result.createdIndex) console.log(`CREATED     index "${result.createdIndex}"`);
  for (const c of result.seededCounters) console.log(`SEEDED      ${c.key} -> at least ${c.seq}`);
  if (result.droppedLegacyIndex) console.log(`DROPPED     legacy index "${result.droppedLegacyIndex}"`);
  if (!result.createdIndex && result.seededCounters.length === 0 && !result.droppedLegacyIndex) {
    console.log("Nothing to change.");
  }
  if (result.errors.length > 0) {
    throw new Error(`Errors (no invoices modified):\n${result.errors.join("\n")}`);
  }
}

if (require.main === module) {
  main()
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await mongoose.disconnect().catch(() => undefined);
      process.exit(1);
    });
}
