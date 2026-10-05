/**
 * Ensure Prompt 4 BulkImportJob indexes exist. Production connects with
 * autoIndex disabled, so schema-declared indexes are only present if created
 * explicitly. BulkImportJob is a new collection; LibraryImportJob,
 * SchemeImportJob, ProvisioningJob, and CommunicationOutboxJob indexes were
 * already declared before Prompt 4 and are not re-homed here.
 *
 * Prompt 4 introduces NO new unique indexes. Current targets are all
 * non-unique. The unique-blocker path still refuses --apply if a unique
 * target ever appears with duplicate rows (counts and sample _ids only).
 *
 * Usage:
 *   npx tsx scripts/ensure-operational-job-indexes.ts            # dry run (default)
 *   npx tsx scripts/ensure-operational-job-indexes.ts --apply    # create missing indexes
 *
 * Dry run is read-only. --apply creates only missing BulkImportJob indexes,
 * never drops or modifies indexes or documents, and refuses while conflicts
 * or unique-index duplicates exist. Never prints CSV contents, file bytes,
 * student/teacher names, emails, communication bodies, or Paystack secrets.
 *
 * Env: MONGODB_URI, MONGO_DB_NAME (via .env.local or .env)
 * Do NOT run --apply against production from this Prompt 4 index pass.
 */
import { resolve } from "path";
import { isDeepStrictEqual } from "util";
import mongoose from "mongoose";
import { connectToDatabase } from "../src/db/connectToDatabase";
import { BulkImportJob } from "../src/models/BulkImportJob";

const SEMANTIC_OPTIONS = ["unique", "sparse", "partialFilterExpression"] as const;
const SAMPLE_ID_LIMIT = 3;

const TARGET_KEY_FIELDS = ["schoolId", "status", "schoolId,createdAt"] as const;

type ExistingIndex = {
  name?: string;
  key: Record<string, unknown>;
  unique?: boolean;
  sparse?: boolean;
  partialFilterExpression?: unknown;
};

type IndexSpec = { key: Record<string, 1 | -1>; options: Record<string, unknown> };

export type DuplicateGroup = {
  count: number;
  sampleIds: string[];
};

export type IndexTargetReport = {
  label: string;
  status: "present" | "missing" | "conflict";
  existingName: string | null;
  differences: string[];
  spec: IndexSpec;
  duplicates: DuplicateGroup[];
};

export type IndexInspection = { targets: IndexTargetReport[]; blocked: boolean };

function schemaIndexes(): Array<[Record<string, 1 | -1>, Record<string, unknown>]> {
  return BulkImportJob.schema.indexes() as Array<
    [Record<string, 1 | -1>, Record<string, unknown>]
  >;
}

function schemaIndex(keyFields: string): IndexSpec {
  const entry = schemaIndexes().find(([key]) => Object.keys(key).join(",") === keyFields);
  if (!entry) {
    throw new Error(`BulkImportJob declares no index on ${keyFields}`);
  }
  return { key: entry[0], options: entry[1] ?? {} };
}

async function existingIndexes(): Promise<ExistingIndex[]> {
  try {
    return (await BulkImportJob.collection.indexes()) as ExistingIndex[];
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

export function operationalIndexTargetsAreUnique(): boolean {
  return TARGET_KEY_FIELDS.some((keyFields) => Boolean(schemaIndex(keyFields).options.unique));
}

export function inspectionIsBlocked(inspection: Pick<IndexInspection, "targets">): boolean {
  return inspection.targets.some(
    (t) => t.status === "conflict" || (t.status === "missing" && t.duplicates.length > 0)
  );
}

export async function findOperationalIndexDuplicates(spec: IndexSpec): Promise<DuplicateGroup[]> {
  if (!spec.options.unique) return [];
  const fields = Object.keys(spec.key);
  const groupId = Object.fromEntries(fields.map((field) => [field, `$${field}`]));
  const rows = await BulkImportJob.aggregate<{
    count: number;
    ids: mongoose.Types.ObjectId[];
  }>([
    { $match: (spec.options.partialFilterExpression as Record<string, unknown>) ?? {} },
    { $group: { _id: groupId, count: { $sum: 1 }, ids: { $push: "$_id" } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 100 },
  ]);
  return rows.map((row) => ({
    count: row.count,
    sampleIds: row.ids.slice(0, SAMPLE_ID_LIMIT).map(String),
  }));
}

function printDuplicateSummary(duplicates: DuplicateGroup[]) {
  if (duplicates.length === 0) return;
  const groupCount = duplicates.length;
  const documentCount = duplicates.reduce((sum, row) => sum + row.count, 0);
  const sampleIds = duplicates.flatMap((row) => row.sampleIds).slice(0, SAMPLE_ID_LIMIT);
  console.log(
    `  duplicates: ${groupCount} group${groupCount === 1 ? "" : "s"}, ${documentCount} documents [${sampleIds.join(", ")}]`
  );
}

export async function inspectOperationalJobIndexes(): Promise<IndexInspection> {
  const existing = await existingIndexes();
  const targets: IndexTargetReport[] = [];
  for (const keyFields of TARGET_KEY_FIELDS) {
    const spec = schemaIndex(keyFields);
    const label = `BulkImportJob {${keyFields}}`;
    const sameKey = existing.find((idx) => Object.keys(idx.key).join(",") === keyFields);
    const duplicates = await findOperationalIndexDuplicates(spec);
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
  return { targets, blocked: inspectionIsBlocked({ targets }) };
}

export type ApplyResult =
  | { applied: false; reason: "blocked"; inspection: IndexInspection }
  | { applied: true; created: string[]; errors: string[]; inspection: IndexInspection };

export async function applyOperationalJobIndexes(): Promise<ApplyResult> {
  const inspection = await inspectOperationalJobIndexes();
  if (inspection.blocked) return { applied: false, reason: "blocked", inspection };

  const created: string[] = [];
  const errors: string[] = [];
  for (const report of inspection.targets) {
    if (report.status !== "missing") continue;
    try {
      created.push(await BulkImportJob.collection.createIndex(report.spec.key, report.spec.options));
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
    printDuplicateSummary(t.duplicates);
  }
  if (inspection.blocked) console.log("BLOCKED");
}

function printTargetDatabase() {
  const host = mongoose.connection.host || "unknown-host";
  console.log(`Database: ${mongoose.connection.name} host=${host}`);
}

async function main() {
  const { config } = await import("dotenv");
  config({ path: resolve(process.cwd(), ".env.local"), quiet: true });
  config({ path: resolve(process.cwd(), ".env"), quiet: true });

  const apply = process.argv.includes("--apply");
  BulkImportJob.schema.set("autoIndex", false);
  BulkImportJob.schema.set("autoCreate", false);
  await connectToDatabase();
  printTargetDatabase();
  console.log(`Mode: ${apply ? "APPLY (create missing, never drop)" : "DRY RUN (read-only)"}\n`);
  if (!operationalIndexTargetsAreUnique()) {
    console.log("Unique targets: none (Prompt 4 added no new unique indexes)\n");
  }

  if (!apply) {
    const inspection = await inspectOperationalJobIndexes();
    printInspection(inspection);
    console.log(
      inspection.blocked
        ? "\nDry run complete. --apply would refuse: resolve the duplicates/conflicts above first."
        : "\nDry run complete. Re-run with --apply to create missing indexes."
    );
    return;
  }

  const result = await applyOperationalJobIndexes();
  printInspection(result.inspection);
  if (!result.applied) {
    throw new Error("Refusing to apply: resolve duplicates/conflicts listed above first.");
  }
  for (const name of result.created) console.log(`CREATED     "${name}"`);
  if (result.created.length === 0 && result.errors.length === 0) {
    console.log("\nNothing to create.");
  }
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
