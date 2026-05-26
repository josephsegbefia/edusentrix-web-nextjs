/**
 * Migrate LessonReflection rows to LessonDeliveryReflection.
 *
 * For each LessonReflection, find the LessonSession with
 * `legacyLessonId === reflection.lessonId`, then find the first LessonDelivery
 * for that session, and create a LessonDeliveryReflection if one does not
 * already exist for that delivery.
 *
 * Usage:
 *   npx tsx scripts/migrations/lesson-reflections-to-delivery.ts --dry-run
 *   npx tsx scripts/migrations/lesson-reflections-to-delivery.ts
 *   npx tsx scripts/migrations/lesson-reflections-to-delivery.ts --school-id=<mongoId>
 */
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { LessonReflection, type ILessonReflection } from "@/models/LessonReflection";
import { LessonSession } from "@/models/LessonSession";
import { LessonDelivery } from "@/models/LessonDelivery";
import { LessonDeliveryReflection } from "@/models/LessonDeliveryReflection";

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

  const filter: Record<string, unknown> = {};
  if (schoolFilter) filter.schoolId = schoolFilter;

  const total = await LessonReflection.countDocuments(filter);
  console.log(`[reflections] Found ${total} LessonReflection rows`);

  if (total === 0) {
    console.log("[reflections] Nothing to migrate.");
    process.exit(0);
  }

  const reflections = await LessonReflection.find(filter).lean() as ILessonReflection[];

  let migrated = 0;
  let skippedExisting = 0;
  let noSession = 0;
  let noDelivery = 0;

  for (const reflection of reflections) {
    const session = await LessonSession.findOne({
      schoolId: reflection.schoolId,
      legacyLessonId: reflection.lessonId,
    })
      .select("_id")
      .lean();

    if (!session) {
      console.log(
        `[reflections] skip ${reflection._id}: no session for lessonId ${reflection.lessonId}`
      );
      noSession += 1;
      continue;
    }

    const delivery = await LessonDelivery.findOne({
      schoolId: reflection.schoolId,
      sessionId: session._id,
    })
      .select("_id")
      .lean();

    if (!delivery) {
      console.log(
        `[reflections] skip ${reflection._id}: no delivery for sessionId ${session._id}`
      );
      noDelivery += 1;
      continue;
    }

    const existing = await LessonDeliveryReflection.findOne({
      schoolId: reflection.schoolId,
      deliveryId: delivery._id,
    })
      .select("_id")
      .lean();

    if (existing) {
      console.log(
        `[reflections] skip ${reflection._id}: delivery reflection already exists`
      );
      skippedExisting += 1;
      continue;
    }

    console.log(
      `[reflections] ${reflection._id}: lessonId ${reflection.lessonId} → deliveryId ${delivery._id}, sessionId ${session._id}`
    );

    if (!isDryRun) {
      await LessonDeliveryReflection.create({
        schoolId: reflection.schoolId,
        deliveryId: delivery._id,
        sessionId: session._id,
        teacherId: reflection.teacherId,
        completed: reflection.completed,
        objectivesMet: reflection.objectivesMet,
        notes: reflection.notes,
        studentsWhoStruggled: reflection.studentsWhoStruggled ?? [],
        followUpRequired: reflection.followUpRequired,
        followUpNotes: reflection.followUpNotes,
        nextStep: reflection.nextStep,
      });
    }

    migrated += 1;
  }

  console.log(
    `[reflections] Done. Migrated: ${migrated}, already existed: ${skippedExisting}, ` +
      `no session: ${noSession}, no delivery: ${noDelivery}. ${isDryRun ? "(DRY RUN)" : ""}`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
