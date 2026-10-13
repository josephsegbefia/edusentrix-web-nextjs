/**
 * Read-only legacy teacher/student import quarantine audit.
 *
 * Usage:
 *   MONGODB_URI='...' MONGO_DB_NAME='...' npx tsx scripts/audit-legacy-staged-imports.ts
 *   MONGODB_URI='...' MONGO_DB_NAME='...' npx tsx scripts/audit-legacy-staged-imports.ts \
 *     --school=0123456789abcdef01234567 --since=2026-10-13T01:13:00Z
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
  updatedAt?: Date;
  lastErrorCode?: string | null;
  failureCategory?: string | null;
  input?: {
    bulkImportJobId?: string;
    teacherImportJobId?: string;
    studentImportJobId?: string;
    teacherImportPhase?: string;
    studentImportPhase?: string;
  };
};

type StagedTeacherDomain = {
  _id: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  status?: string;
  analysisBackgroundJobId?: mongoose.Types.ObjectId | null;
  analysisErrors?: Array<{ code?: string | null }>;
  createdAt?: Date;
  updatedAt?: Date;
};

function getArgument(name: string) {
  const flag = `--${name}`;
  const inline = process.argv.find((argument) => argument.startsWith(`${flag}=`));
  if (inline) return inline.slice(flag.length + 1).trim();
  const index = process.argv.indexOf(flag);
  return index >= 0 ? (process.argv[index + 1] || "").trim() : "";
}

function safeDate(value: Date | undefined) {
  return value ? value.toISOString() : null;
}

function summarizeIndex(index: {
  name?: string;
  key?: Record<string, unknown>;
  unique?: boolean;
  partialFilterExpression?: Record<string, unknown>;
}) {
  return {
    name: index.name || null,
    keyFields: Object.keys(index.key || {}),
    unique: Boolean(index.unique),
    partialFilterFields: Object.keys(index.partialFilterExpression || {}),
  };
}

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGO_DB_NAME;
  if (!uri || !dbName) throw new Error("MONGODB_URI and MONGO_DB_NAME are required. The script does not load .env.local.");
  const schoolArgument = getArgument("school");
  const sinceArgument = getArgument("since");
  if (sinceArgument && !schoolArgument) throw new Error("--since requires --school so the staged audit remains tenant-scoped.");
  if (schoolArgument && !mongoose.isValidObjectId(schoolArgument)) throw new Error("--school must be a valid MongoDB ObjectId.");
  const since = schoolArgument
    ? sinceArgument
      ? new Date(sinceArgument)
      : new Date(Date.now() - 24 * 60 * 60 * 1000)
    : null;
  if (since && Number.isNaN(since.getTime())) throw new Error("--since must be a valid date or ISO timestamp.");
  mongoose.set("autoIndex", false);
  mongoose.set("autoCreate", false);
  await mongoose.connect(uri, {
    dbName,
    autoIndex: false,
    autoCreate: false,
    readPreference: "primaryPreferred",
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

  const activeLegacyTransport = await db.collection<Transport>("backgroundjobs")
    .find(
      {
        kind: "BULK_IMPORT",
        status: { $in: ["queued", "waiting", "running", "dispatch_failed"] },
        $or: [
          { subjectType: "BulkImportJob" },
          { "input.bulkImportJobId": { $type: "string" } },
        ],
      },
      {
        projection: {
          subjectId: 1,
          subjectType: 1,
          schoolId: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          lastErrorCode: 1,
          failureCategory: 1,
          "input.bulkImportJobId": 1,
          "input.teacherImportJobId": 1,
          "input.studentImportJobId": 1,
          "input.teacherImportPhase": 1,
          "input.studentImportPhase": 1,
        },
      }
    )
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();

  let stagedTeacherUploadAudit: null | Record<string, unknown> = null;
  if (schoolArgument && since) {
    const schoolId = new mongoose.Types.ObjectId(schoolArgument);
    const teacherCollectionExists = collections.has("teacherimportjobs");
    const teacherImportIndexes = teacherCollectionExists
      ? (await db.collection("teacherimportjobs").listIndexes().toArray()).map(summarizeIndex)
      : [];
    const backgroundJobIndexes = (await db.collection("backgroundjobs").listIndexes().toArray()).map(summarizeIndex);
    const teacherImports = teacherCollectionExists
      ? await db.collection<StagedTeacherDomain>("teacherimportjobs")
        .find(
          { schoolId, createdAt: { $gte: since } },
          {
            projection: {
              schoolId: 1,
              status: 1,
              analysisBackgroundJobId: 1,
              "analysisErrors.code": 1,
              createdAt: 1,
              updatedAt: 1,
            },
          }
        )
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray()
      : [];
    const teacherImportIds = teacherImports.map((row) => row._id);
    const teacherImportIdStrings = teacherImportIds.map(String);
    const stagedTransport = await db.collection<Transport>("backgroundjobs")
      .find(
        {
          kind: "BULK_IMPORT",
          schoolId,
          createdAt: { $gte: since },
          $or: [
            { subjectType: "TeacherImportJob" },
            { "input.teacherImportJobId": { $type: "string" } },
          ],
        },
        {
          projection: {
            subjectId: 1,
            subjectType: 1,
            schoolId: 1,
            status: 1,
            createdAt: 1,
            updatedAt: 1,
            lastErrorCode: 1,
            failureCategory: 1,
            "input.teacherImportJobId": 1,
            "input.teacherImportPhase": 1,
          },
        }
      )
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    const stagedTransportFor = (teacherImportJobId: string) => stagedTransport.filter((row) =>
      String(row.subjectId || "") === teacherImportJobId || row.input?.teacherImportJobId === teacherImportJobId
    );
    const serializeStagedTransport = (row: Transport) => ({
      backgroundJobId: String(row._id),
      subjectType: row.subjectType || null,
      subjectId: row.subjectId ? String(row.subjectId) : null,
      status: row.status || null,
      phase: row.input?.teacherImportPhase || null,
      lastErrorCode: row.lastErrorCode || null,
      failureCategory: row.failureCategory || null,
      createdAt: safeDate(row.createdAt),
      updatedAt: safeDate(row.updatedAt),
    });
    const stagedImports = teacherImports.map((row) => {
      const teacherImportJobId = String(row._id);
      const relatedTransport = stagedTransportFor(teacherImportJobId);
      const linkedBackgroundJobId = row.analysisBackgroundJobId ? String(row.analysisBackgroundJobId) : null;
      const linkedTransportFound = Boolean(
        linkedBackgroundJobId && relatedTransport.some((job) => String(job._id) === linkedBackgroundJobId)
      );
      let persistenceFinding = "upload_persistence_completed";
      if (!relatedTransport.length) {
        persistenceFinding = "background_job_enqueue_failed_after_teacher_import_create";
      } else if (!linkedBackgroundJobId) {
        persistenceFinding = "teacher_import_link_failed_after_background_job_create";
      } else if (!linkedTransportFound) {
        persistenceFinding = "teacher_import_link_points_to_unmatched_background_job";
      }
      return {
        teacherImportJobId,
        status: row.status || null,
        analysisBackgroundJobId: linkedBackgroundJobId,
        analysisErrorCodes: (row.analysisErrors || [])
          .map((error) => error.code)
          .filter((code): code is string => typeof code === "string"),
        createdAt: safeDate(row.createdAt),
        updatedAt: safeDate(row.updatedAt),
        persistenceFinding,
        relatedBackgroundJobs: relatedTransport.map(serializeStagedTransport),
      };
    });
    const unmatchedTransport = stagedTransport.filter((row) => {
      const routedId = row.input?.teacherImportJobId || String(row.subjectId || "");
      return !teacherImportIdStrings.includes(routedId);
    });
    let windowFinding = "staged_records_found";
    if (!teacherCollectionExists) {
      windowFinding = "teacher_import_collection_missing";
    } else if (!teacherImports.length && stagedTransport.length) {
      windowFinding = "background_jobs_found_without_matching_teacher_import_in_window";
    } else if (!teacherImports.length) {
      windowFinding = "no_staged_records_first_insert_may_have_failed_or_window_does_not_match";
    }

    stagedTeacherUploadAudit = {
      schoolId: schoolArgument,
      since: since.toISOString(),
      teacherImportCollectionExists: teacherCollectionExists,
      teacherImportCount: teacherImports.length,
      backgroundJobCount: stagedTransport.length,
      windowFinding,
      collectionIndexes: {
        teacherImportJobs: teacherImportIndexes,
        backgroundJobs: backgroundJobIndexes,
      },
      teacherImports: stagedImports,
      unmatchedBackgroundJobs: unmatchedTransport.map(serializeStagedTransport),
    };
  }

  console.log(JSON.stringify({
    mode: "read_only",
    database: db.databaseName,
    legacyPendingOrProcessing: legacy.length,
    queuedOrRunningLegacyTransport: activeLegacyTransport.length,
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
    activeLegacyBackgroundJobs: activeLegacyTransport.map((row) => ({
      backgroundJobId: String(row._id),
      subjectType: row.subjectType || null,
      subjectId: row.subjectId ? String(row.subjectId) : null,
      schoolId: row.schoolId ? String(row.schoolId) : null,
      status: row.status || null,
      lastErrorCode: row.lastErrorCode || null,
      failureCategory: row.failureCategory || null,
      createdAt: safeDate(row.createdAt),
      updatedAt: safeDate(row.updatedAt),
      bulkImportJobId: row.input?.bulkImportJobId || null,
    })),
    stagedTeacherUploadAudit,
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
