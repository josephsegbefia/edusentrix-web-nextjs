/**
 * Map unfinished operational domain rows onto BackgroundJob.
 *
 * Usage:
 *   npx tsx scripts/migrate-operational-jobs-to-background-engine.ts
 *   npx tsx scripts/migrate-operational-jobs-to-background-engine.ts --apply
 *
 * Dry-run is the default. --apply creates/reuses BackgroundJobs.
 * Never calls providers. Never logs CSV/PDF bytes. Do not run --apply
 * against production from this prompt.
 */
import { connectToDatabase } from "../src/db/connectToDatabase";
import mongoose from "mongoose";
import { LibraryImportJob } from "../src/models/LibraryImportJob";
import { SchemeImportJob } from "../src/models/SchemeImportJob";
import { ProvisioningJob } from "../src/models/ProvisioningJob";
import { CommunicationOutboxJob } from "../src/models/CommunicationOutboxJob";
import {
  enqueueLibraryImportBackgroundJob,
  requeueSchemeImportParse,
  enqueueSchoolProvisioningBackgroundJob,
  enqueueOneCommunicationOutboxJob,
} from "../src/lib/background/domain-enqueue";

export type OperationalMigrationRow = {
  kind: string;
  domainId: string;
  action: "would_enqueue" | "enqueued" | "reused";
};

export type OperationalMigrationReport = {
  apply: boolean;
  scanned: number;
  wouldEnqueue: number;
  enqueued: number;
  reused: number;
  rows: OperationalMigrationRow[];
};

function record(
  report: OperationalMigrationReport,
  row: OperationalMigrationRow
) {
  report.rows.push(row);
  if (row.action === "would_enqueue") report.wouldEnqueue += 1;
  if (row.action === "enqueued") report.enqueued += 1;
  if (row.action === "reused") report.reused += 1;
}

export async function migrateOperationalJobsToBackgroundEngine(options?: {
  apply?: boolean;
}): Promise<OperationalMigrationReport> {
  const apply = Boolean(options?.apply);
  const report: OperationalMigrationReport = {
    apply,
    scanned: 0,
    wouldEnqueue: 0,
    enqueued: 0,
    reused: 0,
    rows: [],
  };

  const libraryJobs = await LibraryImportJob.find({
    status: { $in: ["pending", "processing"] },
  })
    .select("_id schoolId createdBy status")
    .lean();
  const schemeJobs = await SchemeImportJob.find({
    status: { $in: ["queued", "parsing"] },
  })
    .select("_id schoolId createdByUserId status")
    .lean();
  const provisioningJobs = await ProvisioningJob.find({
    status: { $in: ["pending", "running", "failed"] },
    kind: "paystack_subaccount",
  }).select("_id schoolId status payload backgroundJobId attempts");
  const outboxJobs = await CommunicationOutboxJob.find({
    status: "pending",
  }).select("_id schoolId deliveryId backgroundJobId");

  report.scanned =
    libraryJobs.length + schemeJobs.length + provisioningJobs.length + outboxJobs.length;

  for (const job of libraryJobs) {
    if (!apply) {
      record(report, {
        kind: "LIBRARY_IMPORT",
        domainId: String(job._id),
        action: "would_enqueue",
      });
      continue;
    }
    const result = await enqueueLibraryImportBackgroundJob({
      schoolId: job.schoolId,
      libraryImportJobId: job._id,
      initiatedByUserId: job.createdBy,
    });
    record(report, {
      kind: "LIBRARY_IMPORT",
      domainId: String(job._id),
      action: result.created ? "enqueued" : "reused",
    });
  }

  for (const job of schemeJobs) {
    if (!apply) {
      record(report, {
        kind: "SCHEME_IMPORT",
        domainId: String(job._id),
        action: "would_enqueue",
      });
      continue;
    }
    const result = await requeueSchemeImportParse({
      schoolId: job.schoolId,
      schemeImportJobId: job._id,
      initiatedByUserId: job.createdByUserId,
    });
    record(report, {
      kind: "SCHEME_IMPORT",
      domainId: String(job._id),
      action: result.created ? "enqueued" : "reused",
    });
  }

  for (const job of provisioningJobs) {
    if (!apply) {
      record(report, {
        kind: "SCHOOL_PROVISIONING",
        domainId: String(job._id),
        action: "would_enqueue",
      });
      continue;
    }
    const result = await enqueueSchoolProvisioningBackgroundJob({
      schoolId: job.schoolId,
      domain: job,
    });
    record(report, {
      kind: "SCHOOL_PROVISIONING",
      domainId: String(job._id),
      action: result.created ? "enqueued" : "reused",
    });
  }

  for (const job of outboxJobs) {
    if (!apply) {
      record(report, {
        kind: "COMMUNICATION_OUTBOX",
        domainId: String(job._id),
        action: "would_enqueue",
      });
      continue;
    }
    const result = await enqueueOneCommunicationOutboxJob({
      schoolId: job.schoolId,
      outboxJob: job,
    });
    record(report, {
      kind: "COMMUNICATION_OUTBOX",
      domainId: String(job._id),
      action: result.created ? "enqueued" : "reused",
    });
  }

  return report;
}

async function main() {
  const apply = process.argv.includes("--apply");
  process.env.MONGODB_URI ||= process.env.MONGO_URI;
  await connectToDatabase();
  const report = await migrateOperationalJobsToBackgroundEngine({ apply });
  console.log(
    JSON.stringify(
      {
        apply: report.apply,
        scanned: report.scanned,
        wouldEnqueue: report.wouldEnqueue,
        enqueued: report.enqueued,
        reused: report.reused,
      },
      null,
      2
    )
  );
  await mongoose.disconnect();
}

if (require.main === module) {
  main()
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error(error instanceof Error ? error.message : "Migration failed");
      await mongoose.disconnect().catch(() => undefined);
      process.exit(1);
    });
}
