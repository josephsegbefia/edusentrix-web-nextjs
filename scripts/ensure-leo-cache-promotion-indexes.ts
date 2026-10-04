/**
 * Install the LeoResponseCache TTL index and the PromotionCycle idempotency
 * unique index.
 *
 * Production connects with autoIndex disabled, so these schema-declared indexes
 * only exist if created explicitly (both were missing in production).
 *
 * - LeoResponseCache {expiresAt}: TTL, expireAfterSeconds 0. Once built,
 *   MongoDB's TTL monitor deletes cache rows after their expiresAt passes
 *   (including rows that have already expired). Reads already ignore expired
 *   rows, so this only reclaims storage.
 * - PromotionCycle {idempotencyKey}: unique. Protects runPreview's
 *   find-or-create from concurrent duplicate cycles.
 *
 * Usage:
 *   npx tsx scripts/ensure-leo-cache-promotion-indexes.ts          # dry run (default)
 *   npx tsx scripts/ensure-leo-cache-promotion-indexes.ts --apply  # create missing indexes
 *
 * Dry run is read-only. --apply creates only missing target indexes, never
 * drops or modifies indexes or documents, and refuses to run while duplicate
 * idempotency keys or conflicting index definitions exist. Re-running is a no-op.
 *
 * Env: MONGODB_URI, MONGO_DB_NAME (via .env.local or .env)
 */
import { resolve } from "path";
import { isDeepStrictEqual } from "util";
import mongoose from "mongoose";
import { connectToDatabase } from "../src/db/connectToDatabase";
import { LeoResponseCache } from "../src/models/LeoResponseCache";
import { PromotionCycle } from "../src/models/PromotionCycle";

type Target = { model: mongoose.Model<any>; keyFields: string };

const TARGETS: Target[] = [
  { model: LeoResponseCache, keyFields: "expiresAt" },
  { model: PromotionCycle, keyFields: "idempotencyKey" },
];

/** Options that change what an index enforces; others (name, background) do not. */
const SEMANTIC_OPTIONS = ["unique", "sparse", "partialFilterExpression", "expireAfterSeconds"] as const;

type ExistingIndex = {
  name?: string;
  key: Record<string, unknown>;
  unique?: boolean;
  sparse?: boolean;
  partialFilterExpression?: unknown;
  expireAfterSeconds?: number;
};

type IndexSpec = { key: Record<string, 1 | -1>; options: Record<string, unknown> };

export type IndexTargetReport = {
  label: string;
  status: "present" | "missing" | "conflict";
  existingName: string | null;
  differences: string[];
  spec: IndexSpec;
  duplicates: Array<{ key: Record<string, unknown>; count: number; ids: string[] }>;
};

export type IndexInspection = { targets: IndexTargetReport[]; blocked: boolean };

function schemaIndex(target: Target): IndexSpec {
  const entries = target.model.schema
    .indexes()
    .filter(([key]) => Object.keys(key).join(",") === target.keyFields);
  if (entries.length !== 1) {
    throw new Error(
      `${target.model.modelName} must declare exactly one index on ${target.keyFields} (found ${entries.length})`
    );
  }
  return { key: entries[0][0] as Record<string, 1 | -1>, options: entries[0][1] as Record<string, unknown> };
}

async function existingIndexes(model: mongoose.Model<any>): Promise<ExistingIndex[]> {
  try {
    return (await model.collection.indexes()) as ExistingIndex[];
  } catch (error) {
    if ((error as { codeName?: string }).codeName === "NamespaceNotFound") return [];
    throw error;
  }
}

function semanticDifferences(existing: ExistingIndex, spec: IndexSpec) {
  return SEMANTIC_OPTIONS.filter((option) => {
    const actual = existing[option];
    const expected = spec.options[option];
    if (option === "partialFilterExpression") {
      return !isDeepStrictEqual(actual ?? null, expected ?? null);
    }
    if (option === "expireAfterSeconds") {
      return (actual ?? null) !== (expected ?? null);
    }
    return Boolean(actual) !== Boolean(expected);
  });
}

/** Duplicate groups for unique targets; missing/null keys count, as a plain unique index rejects them too. */
async function findDuplicates(target: Target, spec: IndexSpec) {
  if (!spec.options.unique) return [];
  const fields = Object.keys(spec.key);
  const groupId = Object.fromEntries(fields.map((field) => [field, `$${field}`]));
  const rows = await target.model.aggregate<{
    _id: Record<string, unknown>;
    count: number;
    ids: mongoose.Types.ObjectId[];
  }>([
    { $match: (spec.options.partialFilterExpression as Record<string, unknown>) ?? {} },
    { $group: { _id: groupId, count: { $sum: 1 }, ids: { $push: "$_id" } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 100 },
  ]);
  return rows.map((row) => ({ key: row._id, count: row.count, ids: row.ids.map(String) }));
}

/** Read-only. */
export async function inspectLeoPromotionIndexes(): Promise<IndexInspection> {
  const targets: IndexTargetReport[] = [];
  for (const target of TARGETS) {
    const spec = schemaIndex(target);
    const label = `${target.model.modelName} {${target.keyFields}}`;
    const sameKey = (await existingIndexes(target.model)).find(
      (idx) => Object.keys(idx.key).join(",") === target.keyFields
    );
    const duplicates = await findDuplicates(target, spec);

    if (!sameKey) {
      targets.push({ label, status: "missing", existingName: null, differences: [], spec, duplicates });
      continue;
    }
    const differences = semanticDifferences(sameKey, spec);
    targets.push({
      label,
      status: differences.length > 0 ? "conflict" : "present",
      existingName: sameKey.name ?? null,
      differences,
      spec,
      duplicates,
    });
  }
  const blocked = targets.some(
    (t) => t.status === "conflict" || (t.status === "missing" && t.duplicates.length > 0)
  );
  return { targets, blocked };
}

export type ApplyResult =
  | { applied: false; reason: "blocked"; inspection: IndexInspection }
  | { applied: true; created: string[]; errors: string[]; inspection: IndexInspection };

/** Creates missing target indexes only. Never drops or modifies indexes or documents. */
export async function applyLeoPromotionIndexes(): Promise<ApplyResult> {
  const inspection = await inspectLeoPromotionIndexes();
  if (inspection.blocked) return { applied: false, reason: "blocked", inspection };

  const created: string[] = [];
  const errors: string[] = [];
  for (const [index, report] of inspection.targets.entries()) {
    if (report.status !== "missing") continue;
    const target = TARGETS[index];
    try {
      created.push(await target.model.collection.createIndex(report.spec.key, report.spec.options));
    } catch (error) {
      // 85 IndexOptionsConflict / 86 IndexKeySpecsConflict: an index with the
      // same name exists with a different definition. Report, never drop.
      const err = error as { code?: number; codeName?: string; message?: string };
      errors.push(`${report.label}: ${err.codeName ?? err.code ?? "error"} ${String(err.message ?? error)}`);
    }
  }
  return { applied: true, created, errors, inspection };
}

function describeSpec(spec: IndexSpec) {
  const parts: string[] = [];
  if (spec.options.unique) parts.push("UNIQUE");
  if (typeof spec.options.expireAfterSeconds === "number") {
    parts.push(
      `TTL expireAfterSeconds=${spec.options.expireAfterSeconds} (MongoDB will delete documents once the indexed date passes)`
    );
  }
  return parts.join(" ") || "plain";
}

function printInspection(inspection: IndexInspection) {
  for (const t of inspection.targets) {
    const head = `${t.status.toUpperCase().padEnd(11)} ${t.label}`;
    if (t.status === "missing") console.log(`${head}: would create ${describeSpec(t.spec)}`);
    if (t.status === "present") console.log(`${head} as "${t.existingName}"`);
    if (t.status === "conflict") {
      console.log(
        `${head}: existing index "${t.existingName}" differs in [${t.differences.join(", ")}]; review and replace manually`
      );
    }
    for (const dup of t.duplicates) {
      console.log(`  duplicate ${JSON.stringify(dup.key)}: ${dup.count} docs [${dup.ids.join(", ")}]`);
    }
  }
}

async function main() {
  const { config } = await import("dotenv");
  config({ path: resolve(process.cwd(), ".env.local") });
  config({ path: resolve(process.cwd(), ".env") });

  const apply = process.argv.includes("--apply");
  // Outside production the connection enables autoIndex/autoCreate, which
  // would build indexes and collections on connect. Disable them so a dry run
  // is truly read-only and --apply creates only what it reports.
  for (const { model } of TARGETS) {
    model.schema.set("autoIndex", false);
    model.schema.set("autoCreate", false);
  }
  await connectToDatabase();
  console.log(`Database: ${mongoose.connection.name}`);
  console.log(`Mode: ${apply ? "APPLY (create missing, never drop)" : "DRY RUN (read-only)"}\n`);

  if (!apply) {
    const inspection = await inspectLeoPromotionIndexes();
    printInspection(inspection);
    console.log(
      inspection.blocked
        ? "\nDry run complete. --apply would refuse: resolve the duplicates/conflicts above first."
        : "\nDry run complete. Re-run with --apply to create missing indexes."
    );
    return;
  }

  const result = await applyLeoPromotionIndexes();
  printInspection(result.inspection);
  if (!result.applied) {
    throw new Error("Refusing to apply: resolve duplicates/conflicts listed above first.");
  }
  for (const name of result.created) console.log(`CREATED     "${name}"`);
  if (result.created.length === 0 && result.errors.length === 0) console.log("\nNothing to create.");
  if (result.errors.length > 0) {
    throw new Error(`Index creation errors (nothing dropped):\n${result.errors.join("\n")}`);
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
