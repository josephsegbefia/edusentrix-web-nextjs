/**
 * Map leftover EmailDispatchJob rows onto BackgroundJob EMAIL_DISPATCH.
 *
 * Usage:
 *   npx tsx scripts/migrate-email-dispatch-jobs-to-background-engine.ts
 *   npx tsx scripts/migrate-email-dispatch-jobs-to-background-engine.ts --apply
 *
 * Dry-run is the default. --apply creates/reuses EMAIL_DISPATCH jobs for
 * retryable outbound_single / batch_chunk rows that still have a valid
 * EmailMessage. Never sends mail. Never prints recipient, body, or URLs.
 * Do not run --apply against production from this prompt.
 */
import { resolve } from "path";
import mongoose from "mongoose";
import { connectToDatabase } from "../src/db/connectToDatabase";
import { BackgroundJob } from "../src/models/BackgroundJob";
import { EmailDispatchJob } from "../src/models/EmailDispatchJob";
import { EmailMessage } from "../src/models/EmailMessage";
import { enqueueBackgroundJob } from "../src/lib/background/enqueue-job-core";
import { emailDispatchIdempotencyKey } from "../src/lib/email/email-dispatch-keys";
import { isSucceededEmailStatus } from "../src/lib/email/email-dispatch-keys";

const RETRYABLE_KINDS = ["outbound_single", "batch_chunk"] as const;
const SKIP_STATUSES = ["done", "dead_letter"] as const;

export type LegacyEmailDispatchMigrationRow = {
  legacyJobId: string;
  action:
    | "would_enqueue"
    | "enqueued"
    | "reused"
    | "skipped_missing_message"
    | "skipped_inbound_route"
    | "skipped_dead_letter"
    | "skipped_terminal_legacy"
    | "skipped_already_mapped"
    | "skipped_already_sent";
};

export type LegacyEmailDispatchMigrationReport = {
  apply: boolean;
  scanned: number;
  wouldEnqueue: number;
  enqueued: number;
  reused: number;
  skippedMissingMessage: number;
  skippedInboundRoute: number;
  skippedDeadLetter: number;
  skippedTerminalLegacy: number;
  skippedAlreadyMapped: number;
  skippedAlreadySent: number;
  rows: LegacyEmailDispatchMigrationRow[];
};

export async function migrateEmailDispatchJobsToBackgroundEngine(options?: {
  apply?: boolean;
}): Promise<LegacyEmailDispatchMigrationReport> {
  const apply = Boolean(options?.apply);
  const jobs = await EmailDispatchJob.find({
    kind: { $in: [...RETRYABLE_KINDS, "inbound_route", "digest_chunk", "imap_recovery"] },
  })
    .select("_id kind status emailMessageId schoolId")
    .lean();

  const report: LegacyEmailDispatchMigrationReport = {
    apply,
    scanned: jobs.length,
    wouldEnqueue: 0,
    enqueued: 0,
    reused: 0,
    skippedMissingMessage: 0,
    skippedInboundRoute: 0,
    skippedDeadLetter: 0,
    skippedTerminalLegacy: 0,
    skippedAlreadyMapped: 0,
    skippedAlreadySent: 0,
    rows: [],
  };

  for (const job of jobs) {
    const legacyJobId = String(job._id);
    if (job.kind === "inbound_route" || job.kind === "imap_recovery") {
      report.skippedInboundRoute += 1;
      report.rows.push({ legacyJobId, action: "skipped_inbound_route" });
      continue;
    }
    if (job.status === "dead_letter") {
      report.skippedDeadLetter += 1;
      report.rows.push({ legacyJobId, action: "skipped_dead_letter" });
      continue;
    }
    if ((SKIP_STATUSES as readonly string[]).includes(job.status) && job.status !== "dead_letter") {
      report.skippedTerminalLegacy += 1;
      report.rows.push({ legacyJobId, action: "skipped_terminal_legacy" });
      continue;
    }
    if (!job.emailMessageId) {
      report.skippedMissingMessage += 1;
      report.rows.push({ legacyJobId, action: "skipped_missing_message" });
      continue;
    }

    const message = await EmailMessage.findById(job.emailMessageId)
      .select("_id status schoolId")
      .lean();
    if (!message) {
      report.skippedMissingMessage += 1;
      report.rows.push({ legacyJobId, action: "skipped_missing_message" });
      continue;
    }
    if (isSucceededEmailStatus(message.status) || message.status === "dead_letter") {
      report.skippedAlreadySent += 1;
      report.rows.push({ legacyJobId, action: "skipped_already_sent" });
      continue;
    }

    const messageId = String(message._id);
    const alreadyMapped = await BackgroundJob.findOne({
      kind: "EMAIL_DISPATCH",
      $or: [
        { idempotencyKey: emailDispatchIdempotencyKey(messageId) },
        { "input.emailMessageId": messageId },
      ],
    })
      .select("_id")
      .lean();
    if (alreadyMapped) {
      report.skippedAlreadyMapped += 1;
      report.rows.push({ legacyJobId, action: "skipped_already_mapped" });
      continue;
    }

    if (!apply) {
      report.wouldEnqueue += 1;
      report.rows.push({ legacyJobId, action: "would_enqueue" });
      continue;
    }

    const result = await enqueueBackgroundJob({
      kind: "EMAIL_DISPATCH",
      schoolId: message.schoolId || job.schoolId || null,
      subjectType: "EmailMessage",
      subjectId: message._id,
      correlationId: messageId,
      input: { emailMessageId: messageId },
      idempotencyKey: emailDispatchIdempotencyKey(messageId),
    });
    if (result.created) {
      report.enqueued += 1;
      report.rows.push({ legacyJobId, action: "enqueued" });
    } else {
      report.reused += 1;
      report.rows.push({ legacyJobId, action: "reused" });
    }
  }

  return report;
}

function printReport(report: LegacyEmailDispatchMigrationReport) {
  console.log(`Mode: ${report.apply ? "APPLY" : "DRY RUN"}`);
  console.log(`Scanned legacy jobs: ${report.scanned}`);
  console.log(`Would enqueue: ${report.wouldEnqueue}`);
  console.log(`Enqueued: ${report.enqueued}`);
  console.log(`Reused: ${report.reused}`);
  console.log(`Skipped missing message: ${report.skippedMissingMessage}`);
  console.log(`Skipped inbound/imap: ${report.skippedInboundRoute}`);
  console.log(`Skipped dead-letter: ${report.skippedDeadLetter}`);
  console.log(`Skipped terminal legacy: ${report.skippedTerminalLegacy}`);
  console.log(`Skipped already mapped: ${report.skippedAlreadyMapped}`);
  console.log(`Skipped already sent: ${report.skippedAlreadySent}`);
  for (const row of report.rows) {
    console.log(`${row.action} legacyJobId=${row.legacyJobId}`);
  }
}

async function main() {
  const { config } = await import("dotenv");
  config({ path: resolve(process.cwd(), ".env.local") });
  config({ path: resolve(process.cwd(), ".env") });

  const apply = process.argv.includes("--apply");
  await connectToDatabase();
  console.log(`Database: ${mongoose.connection.name}`);
  const report = await migrateEmailDispatchJobsToBackgroundEngine({ apply });
  printReport(report);
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
