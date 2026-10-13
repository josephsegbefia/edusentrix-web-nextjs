/**
 * Read-only legacy teacher/student import quarantine audit.
 *
 * Usage:
 *   MONGODB_URI='...' MONGO_DB_NAME='...' npx tsx scripts/audit-legacy-staged-imports.ts
 *
 * This script never loads source file bytes, row data, names, emails, or file
 * names. It performs find/listCollections operations only and prints IDs,
 * lifecycle state, target type, and timestamps needed for operations review.
 */
import mongoose from "mongoose";

type LegacyDomain = {
  _id: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  targetKind: "teachers" | "students";
  status: "pending" | "processing";
  backgroundJobId?: mongoose.Types.ObjectId | null;
  createdAt?: Date;
};

type Transport = {
  _id: mongoose.Types.ObjectId;
  subjectId?: mongoose.Types.ObjectId | null;
  subjectType?: string | null;
  schoolId?: mongoose.Types.ObjectId | null;
  status?: string;
  createdAt?: Date;
  input?: {
    bulkImportJobId?: string;
    teacherImportJobId?: string;
    studentImportJobId?: string;
    teacherImportPhase?: string;
    studentImportPhase?: string;
  };
};

function safeDate(value: Date | undefined) {
  return value ? value.toISOString() : null;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGO_DB_NAME;
  if (!uri || !dbName) throw new Error("MONGODB_URI and MONGO_DB_NAME are required. The script does not load .env.local.");
  mongoose.set("autoIndex", false);
  mongoose.set("autoCreate", false);
  await mongoose.connect(uri, {
    dbName,
    autoIndex: false,
    autoCreate: false,
    readPreference: "secondaryPreferred",
    serverSelectionTimeoutMS: 20_000,
  });
  const db = mongoose.connection.db;
  if (!db) throw new Error("No database handle");
  const collections = new Set((await db.listCollections().toArray()).map((collection) => collection.name));
  if (!collections.has("bulkimportjobs") || !collections.has("backgroundjobs")) {
    throw new Error("Expected import collections are missing; no audit was run.");
  }

  const legacy = await db.collection<LegacyDomain>("bulkimportjobs")
    .find(
      { targetKind: { $in: ["teachers", "students"] }, status: { $in: ["pending", "processing"] } },
      { projection: { schoolId: 1, targetKind: 1, status: 1, backgroundJobId: 1, createdAt: 1 } }
    )
    .sort({ createdAt: -1 })
    .toArray();
  const ids = legacy.map((row) => row._id);
  const transport = ids.length
    ? await db.collection<Transport>("backgroundjobs")
      .find(
        {
          kind: "BULK_IMPORT",
          $or: [
            { subjectType: "BulkImportJob", subjectId: { $in: ids } },
            { "input.bulkImportJobId": { $in: ids.map(String) } },
          ],
        },
        {
          projection: {
            subjectId: 1,
            subjectType: 1,
            schoolId: 1,
            status: 1,
            createdAt: 1,
            "input.bulkImportJobId": 1,
            "input.teacherImportJobId": 1,
            "input.studentImportJobId": 1,
            "input.teacherImportPhase": 1,
            "input.studentImportPhase": 1,
          },
        }
      )
      .sort({ createdAt: -1 })
      .toArray()
    : [];

  const activeTransport = transport.filter((row) => ["queued", "waiting", "running", "dispatch_failed"].includes(row.status || ""));
  console.log(JSON.stringify({
    mode: "read_only",
    database: db.databaseName,
    legacyPendingOrProcessing: legacy.length,
    queuedOrRunningLegacyTransport: activeTransport.length,
    legacyImports: legacy.map((row) => ({
      importJobId: String(row._id),
      schoolId: String(row.schoolId),
      targetKind: row.targetKind,
      status: row.status,
      backgroundJobId: row.backgroundJobId ? String(row.backgroundJobId) : null,
      createdAt: safeDate(row.createdAt),
    })),
    associatedBackgroundJobs: transport.map((row) => ({
      backgroundJobId: String(row._id),
      subjectType: row.subjectType || null,
      subjectId: row.subjectId ? String(row.subjectId) : null,
      schoolId: row.schoolId ? String(row.schoolId) : null,
      status: row.status || null,
      createdAt: safeDate(row.createdAt),
      route: {
        bulkImportJobId: row.input?.bulkImportJobId || null,
        teacherImportJobId: row.input?.teacherImportJobId || null,
        studentImportJobId: row.input?.studentImportJobId || null,
        teacherImportPhase: row.input?.teacherImportPhase || null,
        studentImportPhase: row.input?.studentImportPhase || null,
      },
    })),
  }, null, 2));
} 

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Legacy import audit failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
