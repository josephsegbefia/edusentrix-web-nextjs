/**
 * Ensure StoredAsset indexes exist. Production connects with autoIndex
 * disabled, so schema-declared indexes are only present if created explicitly.
 *
 * Usage:
 *   npx tsx scripts/ensure-stored-asset-indexes.ts            # dry run (default)
 *   npx tsx scripts/ensure-stored-asset-indexes.ts --apply    # create missing indexes
 *
 * Dry run is read-only: reports each target index as present / missing /
 * conflicting, plus duplicate storageKey groups that would block the unique
 * index. --apply creates only missing StoredAsset indexes, never drops or
 * modifies indexes or documents, and refuses while duplicates or conflicts
 * exist. Re-running is a no-op.
 *
 * Env: MONGODB_URI, MONGO_DB_NAME (via .env.local or .env)
 */
import { resolve } from "path";
import { isDeepStrictEqual } from "util";
import mongoose from "mongoose";
import { connectToDatabase } from "../src/db/connectToDatabase";
import { StoredAsset } from "../src/models/StoredAsset";

const SEMANTIC_OPTIONS = ["unique", "sparse", "partialFilterExpression"] as const;

const TARGET_KEY_FIELDS = [
  "storageKey",
  "schoolId,status",
  "schoolId,kind,createdAt",
  "purgeAfter",
] as const;

type ExistingIndex = {
  name?: string;
  key: Record<string, unknown>;
  unique?: boolean;
  sparse?: boolean;
  partialFilterExpression?: unknown;
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

function schemaIndexes(): Array<[Record<string, 1 | -1>, Record<string, unknown>]> {
  return StoredAsset.schema.indexes() as Array<
    [Record<string, 1 | -1>, Record<string, unknown>]
  >;
}

function schemaIndex(keyFields: string): IndexSpec {
  const entry = schemaIndexes().find(([key]) => Object.keys(key).join(",") === keyFields);
  if (!entry) {
    throw new Error(`StoredAsset declares no index on ${keyFields}`);
  }
  return { key: entry[0], options: entry[1] ?? {} };
}

async function existingIndexes(): Promise<ExistingIndex[]> {
  try {
    return (await StoredAsset.collection.indexes()) as ExistingIndex[];
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
    return Boolean(actual) !== Boolean(expected);
  });
}

async function findDuplicates(spec: IndexSpec) {
  if (!spec.options.unique) return [];
  const fields = Object.keys(spec.key);
  const groupId = Object.fromEntries(fields.map((field) => [field, `$${field}`]));
  const rows = await StoredAsset.aggregate<{
    _id: Record<string, unknown>;
    count: number;
    ids: mongoose.Types.ObjectId[];
  }>([
    { $match: (spec.options.partialFilterExpression as Record<string, unknown>) ?? {} },
    { $group: { _id: groupId, count: { $sum: 1 }, ids: { $push: "$_id" } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 100 },
  ]);
  return rows.map((row) => ({
    key: row._id,
    count: row.count,
    ids: row.ids.map(String),
  }));
}

export async function inspectStoredAssetIndexes(): Promise<IndexInspection> {
  const existing = await existingIndexes();
  const targets: IndexTargetReport[] = [];
  for (const keyFields of TARGET_KEY_FIELDS) {
    const spec = schemaIndex(keyFields);
    const label = `StoredAsset {${keyFields}}`;
    const sameKey = existing.find((idx) => Object.keys(idx.key).join(",") === keyFields);
    const duplicates = await findDuplicates(spec);
    if (!sameKey) {
      targets.push({
        label,
        status: "missing",
        existingName: null,
        differences: [],
        spec,
        duplicates,
      });
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

export async function applyStoredAssetIndexes(): Promise<ApplyResult> {
  const inspection = await inspectStoredAssetIndexes();
  if (inspection.blocked) return { applied: false, reason: "blocked", inspection };

  const created: string[] = [];
  const errors: string[] = [];
  for (const report of inspection.targets) {
    if (report.status !== "missing") continue;
    try {
      created.push(await StoredAsset.collection.createIndex(report.spec.key, report.spec.options));
    } catch (error) {
      const err = error as { code?: number; codeName?: string; message?: string };
      errors.push(
        `${report.label}: ${err.codeName ?? err.code ?? "error"} ${String(err.message ?? error)}`
      );
    }
  }
  return { applied: true, created, errors, inspection };
}

function printInspection(inspection: IndexInspection) {
  for (const t of inspection.targets) {
    const head = `${t.status.toUpperCase().padEnd(11)} ${t.label}`;
    if (t.status === "missing") console.log(head, JSON.stringify(t.spec.options));
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
  StoredAsset.schema.set("autoIndex", false);
  StoredAsset.schema.set("autoCreate", false);
  await connectToDatabase();
  console.log(`Database: ${mongoose.connection.name}`);
  console.log(`Mode: ${apply ? "APPLY (create missing, never drop)" : "DRY RUN (read-only)"}\n`);

  if (!apply) {
    const inspection = await inspectStoredAssetIndexes();
    printInspection(inspection);
    console.log(
      inspection.blocked
        ? "\nDry run complete. --apply would refuse: resolve the duplicates/conflicts above first."
        : "\nDry run complete. Re-run with --apply to create missing indexes."
    );
    return;
  }

  const result = await applyStoredAssetIndexes();
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
      console.error(err instanceof Error ? err.message : err);
      await mongoose.disconnect().catch(() => undefined);
      process.exit(1);
    });
}
