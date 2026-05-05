/**
 * Data hygiene: remove legacy internal-test flag from invitation metadata.
 *
 * Unsets `metadata.syntheticClerkUser` on any Invitation document where it exists.
 * Safe to run multiple times (no-op when nothing matches).
 *
 * Usage:
 *   npx tsx scripts/unset-invitation-synthetic-clerk-metadata.ts --dry-run
 *   npx tsx scripts/unset-invitation-synthetic-clerk-metadata.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import connectToDatabase, {
  disconnectDatabase,
} from "../src/db/connectToDatabase";
import { Invitation } from "../src/models/Invitation";

const FILTER = {
  "metadata.syntheticClerkUser": { $exists: true },
} as const;

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  await connectToDatabase();

  const matched = await Invitation.countDocuments(FILTER);
  console.log(
    `Found ${matched} invitation(s) with metadata.syntheticClerkUser set.`
  );

  if (dryRun) {
    console.log("Dry run: no changes applied.");
    await disconnectDatabase();
    return;
  }

  const result = await Invitation.updateMany(FILTER, {
    $unset: { "metadata.syntheticClerkUser": "" },
  });

  console.log(
    `Unset syntheticClerkUser on ${result.modifiedCount} invitation(s) (matched ${result.matchedCount}).`
  );

  await disconnectDatabase();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
