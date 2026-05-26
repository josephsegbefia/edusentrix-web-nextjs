/**
 * Fix LessonFlashcardDeck indexes after lessons v2 (session-scoped decks).
 *
 * - Drops legacy unique { schoolId, lessonId } (null lessonId collisions)
 * - Drops split session indexes in favor of one compound unique key
 * - Backfills class session decks with generatedForStudentId: null
 *
 * Usage:
 *   npx tsx scripts/sync-lesson-flashcard-deck-indexes.ts
 *
 * Env: MONGODB_URI (via .env.local or .env)
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { connectToDatabase } from "../src/db/connectToDatabase";
import { LessonFlashcardDeck } from "../src/models/LessonFlashcardDeck";

const LEGACY_LESSON_UNIQUE_INDEX = "schoolId_1_lessonId_1";
const LEGACY_CLASS_SESSION_INDEX = "schoolId_1_sessionId_1";
const LEGACY_STUDENT_SESSION_INDEX = "schoolId_1_sessionId_1_generatedForStudentId_1";

async function dropIndexIfExists(collection: typeof LessonFlashcardDeck.collection, name: string) {
  const indexes = await collection.indexes();
  if (!indexes.some((idx) => idx.name === name)) {
    console.log(`Index ${name} not found; skip drop.`);
    return;
  }
  console.log(`Dropping index: ${name}`);
  await collection.dropIndex(name);
}

async function main() {
  await connectToDatabase();

  const collection = LessonFlashcardDeck.collection;
  const indexes = await collection.indexes();
  const legacyLesson = indexes.find((idx) => idx.name === LEGACY_LESSON_UNIQUE_INDEX);

  if (legacyLesson?.unique) {
    await dropIndexIfExists(collection, LEGACY_LESSON_UNIQUE_INDEX);
  }

  await dropIndexIfExists(collection, LEGACY_CLASS_SESSION_INDEX);
  await dropIndexIfExists(collection, LEGACY_STUDENT_SESSION_INDEX);

  const backfill = await LessonFlashcardDeck.updateMany(
    {
      sessionId: { $type: "objectId" },
      generatedForStudentId: { $exists: false },
    },
    { $set: { generatedForStudentId: null } }
  );
  console.log(
    `Backfilled class session decks (generatedForStudentId: null): ${backfill.modifiedCount}`
  );

  const synced = await LessonFlashcardDeck.syncIndexes();
  console.log("LessonFlashcardDeck.syncIndexes:", synced);
  console.log("Current indexes:", (await collection.indexes()).map((i) => i.name).join(", "));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
