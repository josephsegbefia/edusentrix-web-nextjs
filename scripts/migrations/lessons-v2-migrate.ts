/**
 * Lessons v2 full migration (Phase F)
 *
 * 1. Lesson notes: status `published` → `approved`
 * 2. Legacy `Lesson` → `LessonWeekPlan` + `LessonSession` + `LessonDelivery` (with `legacyLessonId`)
 * 3. `LessonFlashcardDeck`: copy `lessonId` → `sessionId` when session exists
 *
 * Usage:
 *   npx tsx scripts/migrations/lessons-v2-migrate.ts --dry-run
 *   npx tsx scripts/migrations/lessons-v2-migrate.ts
 *   npx tsx scripts/migrations/lessons-v2-migrate.ts --school-id=<mongoId>
 */
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { LessonNote } from "@/models/LessonNote";
import { Lesson } from "@/models/Lesson";
import { LessonWeekPlan } from "@/models/LessonWeekPlan";
import { LessonSession } from "@/models/LessonSession";
import { LessonDelivery } from "@/models/LessonDelivery";
import { LessonFlashcardDeck } from "@/models/LessonFlashcardDeck";
import { getCalendarWeekRange } from "@/lib/lessons/week-dates";

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

function dayOfWeekUtc(d: Date): number {
  const dow = d.getUTCDay();
  return dow === 0 ? 7 : dow;
}

async function migrateNotes(dryRun: boolean) {
  const filter = { status: "published" as const };
  const count = await LessonNote.countDocuments(filter);
  console.log(`[notes] published → approved: ${count}`);
  if (!dryRun && count > 0) {
    const result = await LessonNote.updateMany(filter, { $set: { status: "approved" } });
    console.log(`[notes] updated ${result.modifiedCount}`);
  }
}

async function migrateLessons(dryRun: boolean, schoolFilter: mongoose.Types.ObjectId | null) {
  const lessonFilter: Record<string, unknown> = {};
  if (schoolFilter) lessonFilter.schoolId = schoolFilter;

  const lessons = await Lesson.find(lessonFilter).lean();
  let migrated = 0;
  let skippedExisting = 0;
  let unmapped = 0;

  for (const lesson of lessons) {
    const existingSession = await LessonSession.findOne({
      schoolId: lesson.schoolId,
      legacyLessonId: lesson._id,
    })
      .select("_id")
      .lean();
    if (existingSession) {
      skippedExisting += 1;
      continue;
    }

    if (!lesson.subjectOfferingId) {
      unmapped += 1;
      console.log(`[lessons] skip ${lesson._id}: missing subjectOfferingId`);
      if (!dryRun) {
        await Lesson.updateOne({ _id: lesson._id }, { $set: { status: "archived" } });
      }
      continue;
    }

    if (!lesson.academicPeriodId) {
      unmapped += 1;
      console.log(`[lessons] skip ${lesson._id}: missing academicPeriodId`);
      continue;
    }

    const anchor = lesson.scheduledAt ? new Date(lesson.scheduledAt) : new Date(lesson.createdAt);
    const week = getCalendarWeekRange(anchor);
    const scheduledDate = new Date(`${week.weekStartDate}T00:00:00.000Z`);
    const dow = dayOfWeekUtc(anchor);

    const sessionStatus =
      lesson.status === "published"
        ? "published"
        : lesson.status === "archived"
          ? "archived"
          : "draft";
    const studentVisibility = lesson.status === "published" ? "published" : "hidden";
    const deliveryStatus =
      lesson.status === "published"
        ? "completed"
        : lesson.status === "archived"
          ? "cancelled"
          : "scheduled";

    if (dryRun) {
      migrated += 1;
      continue;
    }

    const plan = await LessonWeekPlan.create({
      schoolId: lesson.schoolId,
      academicPeriodId: lesson.academicPeriodId,
      classGroupId: lesson.classGroupId,
      subjectOfferingId: lesson.subjectOfferingId,
      lessonNoteId: lesson.lessonNoteId,
      ownerTeacherId: lesson.teacherId,
      weekStartDate: new Date(`${week.weekStartDate}T00:00:00.000Z`),
      weekEndDate: new Date(`${week.weekEndDate}T00:00:00.000Z`),
      weekLabel: week.weekLabel,
      title: lesson.title,
      status: lesson.status === "archived" ? "archived" : "ready",
      sessionIds: [],
    });

    const session = await LessonSession.create({
      schoolId: lesson.schoolId,
      weekPlanId: plan._id,
      lessonNoteId: lesson.lessonNoteId,
      classGroupId: lesson.classGroupId,
      subjectOfferingId: lesson.subjectOfferingId,
      ownerTeacherId: lesson.teacherId,
      sequenceInWeek: 1,
      scheduledDate,
      dayOfWeek: dow,
      startTime: "08:00",
      endTime: "09:00",
      durationMinutes: 60,
      title: lesson.title,
      status: sessionStatus,
      studentVisibility,
      parentVisibility: Boolean(lesson.parentContent?.visible || lesson.parentSummaryHtml),
      adminVisibility: true,
      planNotes: lesson.studentContent?.summaryHtml ?? null,
      contentBlocks: [],
      legacyLessonId: lesson._id,
      noteSectionAllocation: {
        schemeItemIds: lesson.schemeItemIds ?? [],
        noteSectionKeys: [],
        coverageWeight: 1,
      },
    });

    await LessonDelivery.create({
      schoolId: lesson.schoolId,
      sessionId: session._id,
      weekPlanId: plan._id,
      classGroupId: lesson.classGroupId,
      ownerTeacherId: lesson.teacherId,
      scheduledTeacherId: lesson.teacherId,
      status: deliveryStatus,
      completedAt: deliveryStatus === "completed" ? lesson.publishedAt ?? new Date() : null,
      completedByTeacherId: deliveryStatus === "completed" ? lesson.teacherId : null,
    });

    plan.sessionIds = [session._id];
    await plan.save();
    migrated += 1;
  }

  console.log(
    `[lessons] total=${lessons.length} migrated=${migrated} already=${skippedExisting} unmapped=${unmapped}`,
  );
}

async function migrateFlashcardDecks(dryRun: boolean, schoolFilter: mongoose.Types.ObjectId | null) {
  const filter: Record<string, unknown> = {
    lessonId: { $type: "objectId" },
    sessionId: null,
  };
  if (schoolFilter) filter.schoolId = schoolFilter;

  const decks = await LessonFlashcardDeck.find(filter).select("_id lessonId schoolId").lean();
  let updated = 0;
  let missingSession = 0;

  for (const deck of decks) {
    if (!deck.lessonId) continue;
    const session = await LessonSession.findOne({
      schoolId: deck.schoolId,
      legacyLessonId: deck.lessonId,
    })
      .select("_id")
      .lean();
    if (!session) {
      missingSession += 1;
      continue;
    }
    if (!dryRun) {
      await LessonFlashcardDeck.updateOne(
        { _id: deck._id },
        { $set: { sessionId: session._id }, $unset: { lessonId: "" } },
      );
    }
    updated += 1;
  }

  console.log(`[flashcards] decks=${decks.length} session-linked=${updated} no-session=${missingSession}`);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const schoolFilter = parseSchoolIdArg();
  await connectToDatabase();

  console.log(`Lessons v2 migrate${dryRun ? " (dry-run)" : ""}${schoolFilter ? ` school=${schoolFilter}` : ""}`);

  await migrateNotes(dryRun);
  await migrateLessons(dryRun, schoolFilter);
  await migrateFlashcardDecks(dryRun, schoolFilter);

  if (dryRun) console.log("Dry run — no writes.");
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
