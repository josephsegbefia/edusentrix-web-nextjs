/**
 * Delete all lazy Explore v2 + legacy guided adventure documents (dev/reset only).
 *
 * Usage:
 *   npx tsx scripts/clear-explore-content.ts
 *
 * Env: MONGODB_URI (via .env.local or .env)
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { connectToDatabase } from "../src/db/connectToDatabase";
import { ExploreAdventure } from "../src/models/ExploreAdventure";
import { ExploreContentReview } from "../src/models/ExploreContentReview";
import { ExploreContentSnapshot } from "../src/models/ExploreContentSnapshot";
import { ExploreGenerationJob } from "../src/models/ExploreGenerationJob";
import { LearnGuidedAdventure } from "../src/models/LearnGuidedAdventure";
import { StudentExploreRecord } from "../src/models/StudentExploreRecord";

const COLLECTIONS = [
  { name: "ExploreGenerationJob", model: ExploreGenerationJob },
  { name: "StudentExploreRecord", model: StudentExploreRecord },
  { name: "ExploreContentReview", model: ExploreContentReview },
  { name: "ExploreContentSnapshot", model: ExploreContentSnapshot },
  { name: "ExploreAdventure", model: ExploreAdventure },
  { name: "LearnGuidedAdventure (legacy)", model: LearnGuidedAdventure },
] as const;

async function main() {
  await connectToDatabase();

  const inProgress = await ExploreGenerationJob.find({
    status: { $in: ["pending", "generating", "safety_checking", "repairing"] },
  })
    .select("generationKey status lockExpiresAt updatedAt lessonId")
    .lean();

  if (inProgress.length > 0) {
    console.log("\nIn-flight generation jobs (will be cleared):");
    for (const job of inProgress) {
      console.log(
        `  - ${job.generationKey} | ${job.status} | lockExpires=${job.lockExpiresAt?.toISOString() ?? "n/a"}`
      );
    }
  }

  console.log("\nDeleting explore content only...\n");

  for (const { name, model } of COLLECTIONS) {
    const count = await model.countDocuments({});
    const result = await model.deleteMany({});
    console.log(`${name}: deleted ${result.deletedCount} (was ${count})`);
  }

  console.log("\nDone. Explore collections are empty.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
