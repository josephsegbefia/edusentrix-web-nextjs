/**
 * Map unfinished ExploreGenerationJob rows onto BackgroundJob EXPLORE_GENERATION.
 *
 * Usage:
 *   npx tsx scripts/migrate-explore-generation-jobs-to-background-engine.ts
 *   npx tsx scripts/migrate-explore-generation-jobs-to-background-engine.ts --apply
 *
 * Dry-run is the default. --apply creates/reuses BackgroundJobs.
 * Never calls providers. Never mutates Explore content. Do not run --apply
 * against production from this prompt.
 */
import { resolve } from "path";
import mongoose from "mongoose";
import { connectToDatabase } from "../src/db/connectToDatabase";
import { ExploreGenerationJob } from "../src/models/ExploreGenerationJob";
import { enqueueExploreGenerationWork } from "../src/lib/learn/explore/enqueue-explore-generation";

const UNFINISHED = ["pending", "generating", "safety_checking", "repairing"] as const;

export type ExploreLegacyMigrationRow = {
  exploreJobId: string;
  generationKey: string;
  action: "would_enqueue" | "enqueued" | "reused" | "skipped_terminal";
};

export type ExploreLegacyMigrationReport = {
  apply: boolean;
  scanned: number;
  wouldEnqueue: number;
  enqueued: number;
  reused: number;
  skippedTerminal: number;
  rows: ExploreLegacyMigrationRow[];
};

export async function migrateExploreGenerationJobsToBackgroundEngine(options?: {
  apply?: boolean;
}): Promise<ExploreLegacyMigrationReport> {
  const apply = Boolean(options?.apply);
  const jobs = await ExploreGenerationJob.find({
    status: { $in: [...UNFINISHED] },
  })
    .select("_id generationKey status backgroundJobId schoolId requestedByStudentId lessonId")
    .lean();

  const report: ExploreLegacyMigrationReport = {
    apply,
    scanned: jobs.length,
    wouldEnqueue: 0,
    enqueued: 0,
    reused: 0,
    skippedTerminal: 0,
    rows: [],
  };

  for (const job of jobs) {
    if (!UNFINISHED.includes(job.status as (typeof UNFINISHED)[number])) {
      report.skippedTerminal += 1;
      report.rows.push({
        exploreJobId: String(job._id),
        generationKey: job.generationKey,
        action: "skipped_terminal",
      });
      continue;
    }
    if (!apply) {
      report.wouldEnqueue += 1;
      report.rows.push({
        exploreJobId: String(job._id),
        generationKey: job.generationKey,
        action: "would_enqueue",
      });
      continue;
    }
    const result = await enqueueExploreGenerationWork({
      exploreJob: job as typeof job & { schoolId: mongoose.Types.ObjectId },
      trigger: "system",
    });
    if (result.created) report.enqueued += 1;
    else report.reused += 1;
    report.rows.push({
      exploreJobId: String(job._id),
      generationKey: job.generationKey,
      action: result.created ? "enqueued" : "reused",
    });
  }

  return report;
}

async function main() {
  const apply = process.argv.includes("--apply");
  process.env.MONGODB_URI ||= process.env.MONGO_URI;
  await connectToDatabase();
  const report = await migrateExploreGenerationJobsToBackgroundEngine({ apply });
  console.log(
    JSON.stringify(
      {
        apply: report.apply,
        scanned: report.scanned,
        wouldEnqueue: report.wouldEnqueue,
        enqueued: report.enqueued,
        reused: report.reused,
        skippedTerminal: report.skippedTerminal,
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
