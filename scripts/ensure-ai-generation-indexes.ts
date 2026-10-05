/**
 * Ensure Prompt 3 unique idempotency indexes exist for lesson AI generation
 * and lesson illustration requests.
 *
 * Production connects with autoIndex disabled, so schema-declared indexes are
 * only present if created explicitly.
 *
 * Usage:
 *   npx tsx scripts/ensure-ai-generation-indexes.ts            # dry run (default)
 *   npx tsx scripts/ensure-ai-generation-indexes.ts --apply    # create missing indexes
 *
 * Dry run is read-only. --apply creates only the two unique target indexes,
 * never drops or modifies indexes or documents, and refuses while duplicates
 * or conflicts exist. Never prints idempotency keys, prompts, generated
 * content, PII, or secrets.
 *
 * Env: MONGODB_URI, MONGO_DB_NAME (via .env.local or .env)
 * Do NOT run --apply against production from this pass.
 */
import { resolve } from "path";
import { isDeepStrictEqual } from "util";
import mongoose from "mongoose";
import { connectToDatabase } from "../src/db/connectToDatabase";
import { LessonAiGenerationRequest } from "../src/models/LessonAiGenerationRequest";
import { LessonIllustrationRequest } from "../src/models/LessonIllustrationRequest";

type Target = { model: mongoose.Model<any>; keyFields: string };

const TARGETS: Target[] = [
  { model: LessonAiGenerationRequest, keyFields: "schoolId,idempotencyKey" },
  { model: LessonIllustrationRequest, keyFields: "schoolId,idempotencyKey" },
];

const SEMANTIC_OPTIONS = ["unique", "sparse", "partialFilterExpression"] as const;
const SAMPLE_ID_LIMIT = 3;

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

function schemaIndex(target: Target): IndexSpec {
  const entry = target.model.schema
    .indexes()
    .find(([key]) => Object.keys(key).join(",") === target.keyFields);
  if (!entry) {
    throw new Error(`${target.model.modelName} declares no index on ${target.keyFields}`);
  }
  return {
    key: entry[0] as Record<string, 1 | -1>,
    options: (entry[1] ?? {}) as Record<string, unknown>,
  };
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
    return Boolean(actual) !== Boolean(expected);
  });
}

async function findDuplicates(
  target: Target,
  spec: IndexSpec
): Promise<DuplicateGroup[]> {
  if (!spec.options.unique) return [];
  const fields = Object.keys(spec.key);
  const groupId = Object.fromEntries(fields.map((field) => [field, `$${field}`]));
  const rows = await target.model.aggregate<{
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

export async function inspectAiGenerationIndexes(): Promise<IndexInspection> {
  const targets: IndexTargetReport[] = [];
  for (const target of TARGETS) {
    const spec = schemaIndex(target);
    const label = `${target.model.modelName} {${target.keyFields}}`;
    const sameKey = (await existingIndexes(target.model)).find(
      (idx) => Object.keys(idx.key).join(",") === target.keyFields
    );
    const duplicates = await findDuplicates(target, spec);

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

export async function applyAiGenerationIndexes(): Promise<ApplyResult> {
  const inspection = await inspectAiGenerationIndexes();
  if (inspection.blocked) return { applied: false, reason: "blocked", inspection };

  const created: string[] = [];
  const errors: string[] = [];
  for (const [index, report] of inspection.targets.entries()) {
    if (report.status !== "missing") continue;
    const target = TARGETS[index];
    if (!target) {
      errors.push(`${report.label}: target mapping missing`);
      continue;
    }
    try {
      created.push(
        await target.model.collection.createIndex(report.spec.key, report.spec.options)
      );
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

async function main() {
  const { config } = await import("dotenv");
  config({ path: resolve(process.cwd(), ".env.local"), quiet: true });
  config({ path: resolve(process.cwd(), ".env"), quiet: true });

  const apply = process.argv.includes("--apply");
  for (const { model } of TARGETS) {
    model.schema.set("autoIndex", false);
    model.schema.set("autoCreate", false);
  }
  await connectToDatabase();
  console.log(`Database: ${mongoose.connection.name}`);
  console.log(`Mode: ${apply ? "APPLY (create missing, never drop)" : "DRY RUN (read-only)"}\n`);

  if (!apply) {
    const inspection = await inspectAiGenerationIndexes();
    printInspection(inspection);
    console.log(
      inspection.blocked
        ? "\nDry run complete. --apply would refuse: resolve the duplicates/conflicts above first."
        : "\nDry run complete. Re-run with --apply to create missing indexes."
    );
    return;
  }

  const result = await applyAiGenerationIndexes();
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
