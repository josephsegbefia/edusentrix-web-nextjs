/**
 * Migrate LessonResource rows from lessonId to sessionId.
 *
 * For each resource that still has `lessonId` set, find the LessonSession with
 * `legacyLessonId === resource.lessonId`, then set `resource.sessionId` and
 * clear `resource.lessonId`.
 *
 * Usage:
 *   npx tsx scripts/migrations/lesson-resources-to-sessions.ts --dry-run
 *   npx tsx scripts/migrations/lesson-resources-to-sessions.ts
 *   npx tsx scripts/migrations/lesson-resources-to-sessions.ts --school-id=<mongoId>
 */
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { LessonResource } from "@/models/LessonResource";
import { LessonSession } from "@/models/LessonSession";

const isDryRun = process.argv.includes("--dry-run");

function parseSchoolIdArg(): mongoose.Types.ObjectId | null {
  const arg = process.argv.find((a) => a.startsWith("--school-id="));
  if (!arg) return null;
  const id = arg.split("=")[1]?.trim();
  if (!id) return null;
  try {
    return new mongoose.Types.ObjectId(id);
  } catch {
    return null;
  }
}

async function main() {
  await connectToDatabase();

  const schoolFilter = parseSchoolIdArg();
  if (isDryRun) console.log("[DRY RUN] No changes will be written.");
  if (schoolFilter) console.log(`[filter] schoolId = ${schoolFilter}`);

  const filter: Record<string, unknown> = { lessonId: { $exists: true, $ne: null } };
  if (schoolFilter) filter.schoolId = schoolFilter;

  const total = await LessonResource.countDocuments(filter);
  console.log(`[resources] Found ${total} rows still referencing lessonId`);

  if (total === 0) {
    console.log("[resources] Nothing to migrate.");
    process.exit(0);
  }

  const resources = await LessonResource.find(filter)
    .select("_id schoolId lessonId")
    .lean();

  let migrated = 0;
  let noSession = 0;

  for (const resource of resources) {
    const lessonId = resource.lessonId as mongoose.Types.ObjectId;
    const session = await LessonSession.findOne({
      schoolId: resource.schoolId,
      legacyLessonId: lessonId,
    })
      .select("_id")
      .lean();

    if (!session) {
      console.log(
        `[resources] skip ${resource._id}: no session found for lessonId ${lessonId}`
      );
      noSession += 1;
      continue;
    }

    console.log(
      `[resources] ${resource._id}: lessonId ${lessonId} → sessionId ${session._id}`
    );

    if (!isDryRun) {
      // The pre-validate hook requires exactly one of lessonId/sessionId, so unset lessonId
      // while setting sessionId in the same operation using direct update (bypassing validation).
      await LessonResource.collection.updateOne(
        { _id: resource._id },
        { $set: { sessionId: session._id }, $unset: { lessonId: "" } }
      );
    }

    migrated += 1;
  }

  console.log(
    `[resources] Done. Migrated: ${migrated}, no matching session: ${noSession}. ${isDryRun ? "(DRY RUN)" : ""}`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
