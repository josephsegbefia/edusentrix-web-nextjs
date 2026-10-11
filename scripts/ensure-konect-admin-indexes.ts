/**
 * Inspect or create the indexes introduced by Konect Administrator integration.
 *
 * Usage:
 *   npx tsx scripts/ensure-konect-admin-indexes.ts
 *   npx tsx scripts/ensure-konect-admin-indexes.ts --apply
 *
 * Dry run is the default. Apply creates only missing indexes and never drops an
 * index or changes a document. Duplicate data or a same-key index with different
 * semantics blocks apply so a reviewer must resolve it deliberately.
 */
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import mongoose, { type Model } from "mongoose";
import { connectToDatabase } from "../src/db/connectToDatabase";
import { EmailMessage } from "../src/models/EmailMessage";
import { ScriptSubmission } from "../src/models/ScriptSubmission";

type ExistingIndex = {
  name?: string;
  key: Record<string, unknown>;
  unique?: boolean;
  sparse?: boolean;
  partialFilterExpression?: unknown;
};

type IndexSpec = { key: Record<string, 1 | -1>; options: Record<string, unknown> };
type Target = { model: Model<unknown>; modelName: string; keyFields: string };

const TARGETS: Target[] = [
  { model: ScriptSubmission as unknown as Model<unknown>, modelName: "ScriptSubmission", keyFields: "schoolId,idempotencyKey" },
  { model: ScriptSubmission as unknown as Model<unknown>, modelName: "ScriptSubmission", keyFields: "schoolId,examPaperId,studentId,createdAt" },
  { model: ScriptSubmission as unknown as Model<unknown>, modelName: "ScriptSubmission", keyFields: "schoolId,submittedByUserId,createdAt" },
  { model: EmailMessage as unknown as Model<unknown>, modelName: "EmailMessage", keyFields: "schoolId,idempotencyKey" },
];

export type AdministratorIndexReport = {
  label: string;
  status: "present" | "missing" | "conflict";
  existingName: string | null;
  differences: string[];
  duplicates: Array<{ key: Record<string, unknown>; count: number; ids: string[] }>;
  spec: IndexSpec;
};

export type AdministratorIndexInspection = {
  targets: AdministratorIndexReport[];
  blocked: boolean;
};

function declaredSpec(target: Target): IndexSpec {
  const indexes = target.model.schema.indexes() as Array<[
    Record<string, 1 | -1>,
    Record<string, unknown>,
  ]>;
  const found = indexes.find(([key]) => Object.keys(key).join(",") === target.keyFields);
  if (!found) throw new Error(`${target.modelName} declares no index on ${target.keyFields}`);
  return { key: found[0], options: found[1] ?? {} };
}

async function indexes(target: Target): Promise<ExistingIndex[]> {
  try {
    return (await target.model.collection.indexes()) as ExistingIndex[];
  } catch (error) {
    if ((error as { codeName?: string }).codeName === "NamespaceNotFound") return [];
    throw error;
  }
}

function differences(existing: ExistingIndex, spec: IndexSpec): string[] {
  return ["unique", "sparse", "partialFilterExpression"].filter((field) => {
    const key = field as "unique" | "sparse" | "partialFilterExpression";
    if (key === "partialFilterExpression") {
      return !isDeepStrictEqual(existing[key] ?? null, spec.options[key] ?? null);
    }
    return Boolean(existing[key]) !== Boolean(spec.options[key]);
  });
}

async function duplicates(target: Target, spec: IndexSpec) {
  if (!spec.options.unique) return [];
  const fields = Object.keys(spec.key);
  const rows = await target.model.collection
    .aggregate<{
      _id: Record<string, unknown>;
      count: number;
      ids: mongoose.Types.ObjectId[];
    }>([
      { $match: (spec.options.partialFilterExpression as Record<string, unknown>) ?? {} },
      { $group: { _id: Object.fromEntries(fields.map((field) => [field, `$${field}`])), count: { $sum: 1 }, ids: { $push: "$_id" } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 100 },
    ])
    .toArray();
  return rows.map((row) => ({ key: row._id, count: row.count, ids: row.ids.map(String) }));
}

export async function inspectAdministratorIndexes(): Promise<AdministratorIndexInspection> {
  const reports: AdministratorIndexReport[] = [];
  for (const target of TARGETS) {
    const spec = declaredSpec(target);
    const current = await indexes(target);
    const sameKey = current.find((index) => Object.keys(index.key).join(",") === target.keyFields);
    const duplicateRows = await duplicates(target, spec);
    const semanticDifferences = sameKey ? differences(sameKey, spec) : [];
    reports.push({
      label: `${target.modelName} {${target.keyFields}}`,
      status: !sameKey ? "missing" : semanticDifferences.length ? "conflict" : "present",
      existingName: sameKey?.name ?? null,
      differences: semanticDifferences,
      duplicates: duplicateRows,
      spec,
    });
  }
  return {
    targets: reports,
    blocked: reports.some(
      (report) => report.status === "conflict" || (report.status === "missing" && report.duplicates.length > 0)
    ),
  };
}

export async function applyAdministratorIndexes() {
  const inspection = await inspectAdministratorIndexes();
  if (inspection.blocked) return { applied: false as const, created: [] as string[], inspection };
  const created: string[] = [];
  for (let index = 0; index < TARGETS.length; index += 1) {
    const report = inspection.targets[index];
    if (report.status !== "missing") continue;
    created.push(await TARGETS[index].model.collection.createIndex(report.spec.key, report.spec.options));
  }
  return { applied: true as const, created, inspection };
}

function print(inspection: AdministratorIndexInspection) {
  for (const report of inspection.targets) {
    console.log(`${report.status.toUpperCase().padEnd(9)} ${report.label}${report.existingName ? ` as "${report.existingName}"` : ""}`);
    if (report.differences.length) console.log(`  differences: ${report.differences.join(", ")}`);
    for (const duplicate of report.duplicates) {
      console.log(`  duplicate ${JSON.stringify(duplicate.key)}: ${duplicate.count} rows [${duplicate.ids.join(", ")}]`);
    }
  }
}

async function main() {
  const { config } = await import("dotenv");
  config({ path: resolve(process.cwd(), ".env.local"), quiet: true });
  config({ path: resolve(process.cwd(), ".env"), quiet: true });
  ScriptSubmission.schema.set("autoIndex", false);
  ScriptSubmission.schema.set("autoCreate", false);
  EmailMessage.schema.set("autoIndex", false);
  EmailMessage.schema.set("autoCreate", false);
  await connectToDatabase();
  const apply = process.argv.includes("--apply");
  console.log(`Database: ${mongoose.connection.name}`);
  console.log(`Mode: ${apply ? "APPLY (create missing, never drop)" : "DRY RUN (read-only)"}\n`);
  if (!apply) {
    const inspection = await inspectAdministratorIndexes();
    print(inspection);
    return;
  }
  const result = await applyAdministratorIndexes();
  print(result.inspection);
  if (!result.applied) throw new Error("Refusing to apply while duplicates or conflicting indexes exist.");
  for (const name of result.created) console.log(`CREATED   "${name}"`);
  if (!result.created.length) console.log("Nothing to create.");
}

if (require.main === module) {
  main()
    .then(async () => {
      await mongoose.disconnect();
    })
    .catch(async (error) => {
      console.error(error instanceof Error ? error.message : error);
      await mongoose.disconnect().catch(() => undefined);
      process.exitCode = 1;
    });
}
