/**
 * Normalize StoredAsset metadata for student photographs.
 *
 * Usage:
 *   npx tsx scripts/storage/normalize-student-avatar-metadata.ts
 *       Dry run (default). Strictly read-only: index and collection creation is
 *       off and every driver write method throws, whatever NODE_ENV says.
 *       Prints counts and ambiguous asset ids.
 *
 *   CONFIRM_STUDENT_AVATAR_MIGRATION=yes npx tsx scripts/storage/normalize-student-avatar-metadata.ts \
 *       --apply --manifest <new path> --confirm-database <db name>
 *       Writes the manifest first, then marks every student_avatar private and
 *       links each unambiguous unlinked asset to its student.
 *
 *   CONFIRM_STUDENT_AVATAR_MIGRATION=yes npx tsx scripts/storage/normalize-student-avatar-metadata.ts \
 *       --rollback <manifest path> --confirm-database <db name>
 *       Restores the visibility and removes the links recorded in a manifest.
 *
 * Writes need all three: the mode flag, CONFIRM_STUDENT_AVATAR_MIGRATION=yes, and
 * --confirm-database matching the database the script actually connected to.
 *
 * Only student_avatar documents change. Stored objects are never touched, and
 * no mode creates collections or indexes. Access control does not depend on
 * this script. The manifest holds internal asset and student ids: keep it out
 * of version control and shared channels.
 *
 * Env: MONGODB_URI, MONGO_DB_NAME (via the environment, .env.local, or .env)
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import mongoose from "mongoose";
import type {
  StudentAvatarManifest,
  StudentAvatarMigrationPlan,
} from "../../src/lib/storage/student-avatar-migration";

const COLLECTION_WRITE_METHODS = [
  "insertOne",
  "insertMany",
  "updateOne",
  "updateMany",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "bulkWrite",
  "findOneAndUpdate",
  "findOneAndReplace",
  "findOneAndDelete",
  "createIndex",
  "createIndexes",
  "dropIndex",
  "dropIndexes",
  "drop",
  "rename",
  "createSearchIndex",
  "createSearchIndexes",
  "dropSearchIndex",
  "updateSearchIndex",
] as const;

const DB_WRITE_METHODS = [
  "createCollection",
  "dropCollection",
  "dropDatabase",
  "renameCollection",
  "createIndex",
] as const;

const WRITE_COMMANDS = new Set([
  "insert",
  "update",
  "delete",
  "findAndModify",
  "create",
  "drop",
  "dropDatabase",
  "createIndexes",
  "dropIndexes",
  "renameCollection",
  "collMod",
]);

function dryRunWriteError(operation: string) {
  return new Error(`Dry run attempted a write: ${operation}. Nothing was written.`);
}

function blockMethods(prototype: object, methods: readonly string[], label: string) {
  const target = prototype as Record<string, unknown>;
  for (const method of methods) {
    if (typeof target[method] !== "function") continue;
    target[method] = function blocked() {
      throw dryRunWriteError(`${label}.${method}`);
    };
  }
}

function hasWriteStage(pipeline: unknown) {
  return (
    Array.isArray(pipeline) &&
    pipeline.some(
      (stage) => stage && typeof stage === "object" && ("$out" in stage || "$merge" in stage)
    )
  );
}

/**
 * Makes the driver mongoose uses refuse every write for the rest of the
 * process. Installed before connecting so model initialisation is covered.
 */
export function installDryRunWriteGuard() {
  const { Collection, Db } = mongoose.mongo;
  blockMethods(Collection.prototype, COLLECTION_WRITE_METHODS, "collection");
  blockMethods(Db.prototype, DB_WRITE_METHODS, "db");

  const collectionProto = Collection.prototype as unknown as Record<string, unknown>;
  const aggregate = collectionProto.aggregate as (...args: unknown[]) => unknown;
  collectionProto.aggregate = function guardedAggregate(this: unknown, ...args: unknown[]) {
    if (hasWriteStage(args[0])) throw dryRunWriteError("collection.aggregate($out/$merge)");
    return aggregate.apply(this, args);
  };

  const dbProto = Db.prototype as unknown as Record<string, unknown>;
  const command = dbProto.command as (...args: unknown[]) => unknown;
  dbProto.command = function guardedCommand(this: unknown, ...args: unknown[]) {
    const name = Object.keys((args[0] as Record<string, unknown>) ?? {})[0];
    if (name && WRITE_COMMANDS.has(name)) throw dryRunWriteError(`db.command(${name})`);
    return command.apply(this, args);
  };
}

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

function resolveDatabaseName(uri: string): string | undefined {
  if (process.env.MONGO_DB_NAME) return process.env.MONGO_DB_NAME;
  if (process.env.APP_RUNTIME_MODE === "demo") {
    const demo = process.env.DEMO_MONGO_DB_NAME || process.env.DEMO_DATA_MONGO_DB_NAME;
    if (demo) return demo;
  }
  try {
    return decodeURIComponent(new URL(uri).pathname.replace(/^\/+/, "")) || undefined;
  } catch {
    return undefined;
  }
}

function printPlan(plan: StudentAvatarMigrationPlan) {
  const c = plan.counts;
  console.log(`student_avatar assets:         ${c.assets}`);
  for (const [visibility, count] of Object.entries(c.byVisibility)) {
    console.log(`  visibility ${visibility.padEnd(19)} ${count}`);
  }
  console.log(`linked to a student:           ${c.linkedToStudent}`);
  console.log(`linked to another record:      ${c.linkedToOther}`);
  console.log(`unlinked, one student (link):  ${c.linkable}`);
  console.log(`unlinked, ambiguous:           ${c.ambiguous}`);
  console.log(`unlinked, unreferenced:        ${c.unreferenced}`);
  console.log(`cross-school references:       ${c.crossSchoolReferences}`);
  const p = c.studentPhotoUrl;
  console.log(
    `Student.photoUrl: none ${p.none}, internal asset ${p.internalAsset}, external ${p.external}, other ${p.other}`
  );
  console.log(`changes an apply would make:   ${plan.changes.length}`);
  for (const assetId of plan.ambiguousAssetIds) {
    console.log(`  ambiguous asset ${assetId}`);
  }
}

async function main() {
  const { config } = await import("dotenv");
  config({ path: resolve(process.cwd(), ".env.local") });
  config({ path: resolve(process.cwd(), ".env") });

  const apply = process.argv.includes("--apply");
  const rollbackFlag = process.argv.includes("--rollback");
  const rollbackPath = argValue("--rollback");
  const manifestPath = argValue("--manifest");
  const confirmDatabase = argValue("--confirm-database");
  if (apply && rollbackFlag) throw new Error("Use either --apply or --rollback, not both");
  const writes = apply || rollbackFlag;

  if (writes) {
    if (process.env.CONFIRM_STUDENT_AVATAR_MIGRATION !== "yes") {
      throw new Error("Refusing to write: set CONFIRM_STUDENT_AVATAR_MIGRATION=yes");
    }
    if (!confirmDatabase) {
      throw new Error("Refusing to write: pass --confirm-database <name of the target database>");
    }
  }
  if (apply) {
    if (!manifestPath) throw new Error("--apply requires --manifest <path>");
    if (existsSync(manifestPath)) throw new Error("Manifest file already exists; choose a new path");
  }
  if (rollbackFlag) {
    if (!rollbackPath) throw new Error("--rollback requires a manifest path");
    if (!existsSync(rollbackPath)) throw new Error("Manifest file not found");
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required");
  const dbName = resolveDatabaseName(uri);
  if (!dbName) throw new Error("MONGO_DB_NAME is required, or MONGODB_URI must include a database name");

  // Must happen before any model is compiled, so no mode builds indexes or collections.
  mongoose.set("autoIndex", false);
  mongoose.set("autoCreate", false);
  if (!writes) installDryRunWriteGuard();

  const migration = await import("../../src/lib/storage/student-avatar-migration");

  await mongoose.connect(uri, {
    dbName,
    autoIndex: false,
    autoCreate: false,
    serverSelectionTimeoutMS: 8000,
    socketTimeoutMS: 30000,
  });
  const connectedName = mongoose.connection.name;
  console.log(`Host: ${mongoose.connection.host}`);
  console.log(`Database: ${connectedName}`);

  if (writes && confirmDatabase !== connectedName) {
    throw new Error(
      `Refusing to write: --confirm-database "${confirmDatabase}" does not match the connected database "${connectedName}"`
    );
  }

  if (rollbackFlag) {
    console.log("Mode: ROLLBACK\n");
    const manifest = JSON.parse(readFileSync(rollbackPath!, "utf8")) as StudentAvatarManifest;
    const result = await migration.rollbackStudentAvatarMigration(manifest);
    console.log(`restored ${result.restored}, skipped ${result.skipped}`);
    return;
  }

  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN (read-only, writes blocked)"}\n`);
  const plan = await migration.planStudentAvatarMigration();
  printPlan(plan);
  if (!apply) {
    console.log("\nDry run complete. Nothing was written.");
    return;
  }

  writeFileSync(manifestPath!, JSON.stringify(migration.buildManifest(plan), null, 2), { flag: "wx" });
  console.log(`\nManifest written with ${plan.changes.length} entries.`);
  const result = await migration.applyStudentAvatarMigration(plan.changes);
  console.log(`updated ${result.updated}, skipped ${result.skipped}`);
}

if (require.main === module) {
  process.on("unhandledRejection", (reason) => {
    console.error(reason instanceof Error ? reason.message : reason);
    process.exit(1);
  });
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
