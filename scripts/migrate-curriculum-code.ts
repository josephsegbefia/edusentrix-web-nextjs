/**
 * Migration: Backfill curriculumCode for existing schools.
 *
 * Sets curriculumCode = "ghana_nacca" on any school document that
 * doesn't already have the field.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/migrate-curriculum-code.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import connectToDatabase, {
  disconnectDatabase,
} from "../src/db/connectToDatabase";
import { School } from "../src/models/School";

async function main() {
  await connectToDatabase();

  const result = await School.updateMany(
    { curriculumCode: { $exists: false } },
    { $set: { curriculumCode: "ghana_nacca" } }
  );

  console.log(
    `Migration complete: ${result.modifiedCount} school(s) updated to "ghana_nacca".`
  );

  await disconnectDatabase();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
