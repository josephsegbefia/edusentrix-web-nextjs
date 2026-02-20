/**
 * Migration Script: Lesson Notes v1 → v2
 *
 * This script migrates existing lesson notes to the new schema:
 * - Sets templateType to "SIMPLE" for all existing notes
 * - Moves content/objectives to body.content/body.objectives
 * - Initializes new fields with defaults
 *
 * Run with: npx tsx src/scripts/migrate-lesson-notes-v2.ts
 *
 * IMPORTANT: Run on a backup database first!
 */

import "dotenv/config";
import mongoose from "mongoose";

// Connect to MongoDB
async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI not set in environment");
  }

  console.log("📡 Connecting to MongoDB...");
  await mongoose.connect(uri);
  console.log("✅ Connected to MongoDB");
}

// Migration function
async function migrateLessonNotes() {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Database connection not established");
  }

  const collection = db.collection("lessonnotes");

  // Count existing notes
  const totalCount = await collection.countDocuments({});
  console.log(`📋 Found ${totalCount} lesson notes to check`);

  if (totalCount === 0) {
    console.log("✅ No lesson notes to migrate");
    return;
  }

  // Find notes without templateType (not yet migrated)
  const notesToMigrate = await collection
    .find({
      $or: [
        { templateType: { $exists: false } },
        { templateType: null },
      ],
    })
    .toArray();

  console.log(`🔄 ${notesToMigrate.length} notes need migration`);

  if (notesToMigrate.length === 0) {
    console.log("✅ All notes already migrated");
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  for (const note of notesToMigrate) {
    try {
      // Build the simple body from existing fields
      const simpleBody = {
        objectives: note.objectives || "",
        content: note.content || "",
      };

      // Build update document
      const update = {
        $set: {
          templateType: "SIMPLE",
          body: simpleBody,
          references: note.references || [],
          tlms: note.tlms || [],
          curriculum: note.curriculum || {
            strand: "",
            subStrand: "",
            contentStandard: "",
            indicators: [],
            learningOutcomes: [],
          },
          assessment: note.assessment || {
            inClassChecks: [],
            exitTicket: "",
            homework: "",
          },
          reflections: note.reflections || {
            learner: "",
            teacher: "",
            nextLessonLink: "",
          },
          // Update status if it's the old enum
          status:
            note.status === "published"
              ? "published"
              : note.status === "draft"
              ? "draft"
              : "draft",
        },
      };

      await collection.updateOne({ _id: note._id }, update);
      successCount++;

      if (successCount % 100 === 0) {
        console.log(`  ... migrated ${successCount}/${notesToMigrate.length}`);
      }
    } catch (error) {
      console.error(`❌ Failed to migrate note ${note._id}:`, error);
      errorCount++;
    }
  }

  console.log(`\n📊 Migration Summary:`);
  console.log(`   ✅ Successfully migrated: ${successCount}`);
  console.log(`   ❌ Failed: ${errorCount}`);
  console.log(`   📋 Total checked: ${totalCount}`);
}

// Add new indexes
async function addIndexes() {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Database connection not established");
  }

  const collection = db.collection("lessonnotes");

  console.log("\n📇 Adding new indexes...");

  try {
    // Index for approval workflow
    await collection.createIndex(
      { schoolId: 1, status: 1, submittedAt: -1 },
      { background: true }
    );
    console.log("  ✅ Added approval workflow index");

    // Index for template type queries
    await collection.createIndex(
      { schoolId: 1, templateType: 1, status: 1 },
      { background: true }
    );
    console.log("  ✅ Added template type index");

    // Text index for search
    await collection.createIndex(
      { topic: "text", tags: "text" },
      { background: true }
    );
    console.log("  ✅ Added text search index");
  } catch (error) {
    // Index might already exist
    console.log("  ⚠️ Some indexes may already exist:", (error as Error).message);
  }
}

// Main execution
async function main() {
  console.log("🚀 Starting Lesson Notes v2 Migration\n");
  console.log("=".repeat(50));

  try {
    await connect();
    await migrateLessonNotes();
    await addIndexes();

    console.log("\n" + "=".repeat(50));
    console.log("✅ Migration completed successfully!");
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n📡 Disconnected from MongoDB");
  }
}

main();
