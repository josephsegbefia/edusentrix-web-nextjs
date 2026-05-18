/**
 * Lessons v2 Phase A migration
 *
 * - Maps lesson note status `published` → `approved`
 *
 * Usage:
 *   npx tsx scripts/migrations/lessons-v2-phase-a.ts
 *   npx tsx scripts/migrations/lessons-v2-phase-a.ts --dry-run
 */
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { LessonNote } from "@/models/LessonNote";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  await connectToDatabase();

  const filter = { status: "published" as const };
  const count = await LessonNote.countDocuments(filter);
  console.log(`Lesson notes with legacy status 'published': ${count}`);

  if (dryRun) {
    console.log("Dry run — no writes.");
    await mongoose.disconnect();
    return;
  }

  if (count > 0) {
    const result = await LessonNote.updateMany(filter, { $set: { status: "approved" } });
    console.log(`Updated ${result.modifiedCount} lesson note(s) to approved.`);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
