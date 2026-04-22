/**
 * One-time destructive reset for a single school: removes all timetable versions/slots/conflicts
 * and clears v2 day schedule configuration in SchoolSettings (and legacy timetable fields).
 * Does not delete school identity, students, or payment data.
 *
 * Usage:
 *   tsx scripts/reset-timetable-day-spring-school.ts
 *   tsx scripts/reset-timetable-day-spring-school.ts "Day Spring School"
 *
 * Env: MONGODB_URI (via .env.local)
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { connectToDatabase, disconnectDatabase } from "../src/db/connectToDatabase";
import { School } from "../src/models/School";
import { SchoolSettings } from "../src/models/SchoolSettings";
import { TimetableConflict } from "../src/models/TimetableConflict";
import { TimetableSlot } from "../src/models/TimetableSlot";
import { TimetableVersion } from "../src/models/TimetableVersion";

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const DEFAULT_SCHOOL_NAME = "Day Spring School";

async function main() {
  const nameArg = process.argv[2]?.trim() || process.env.SCHOOL_NAME?.trim() || DEFAULT_SCHOOL_NAME;

  await connectToDatabase();

  let school = await School.findOne({
    name: new RegExp(`^${escapeRegex(nameArg)}$`, "i"),
  });

  if (!school) {
    const tokens = nameArg
      .replace(/\./g, "")
      .split(/\s+/)
      .filter((t) => t.length >= 3)
      .slice(0, 4);
    const loose =
      tokens.length >= 2
        ? new RegExp(tokens.map((t) => escapeRegex(t)).join(".*"), "i")
        : new RegExp(escapeRegex(nameArg), "i");
    const candidates = await School.find({ name: loose })
      .select("name")
      .limit(15)
      .lean();

    if (candidates.length === 1) {
      school = await School.findById(candidates[0]._id);
    } else if (candidates.length > 1) {
      console.error(`Multiple matches for "${nameArg}":`);
      for (const c of candidates) {
        console.error(`  - ${c.name}`);
      }
      process.exitCode = 1;
      await disconnectDatabase();
      return;
    }
  }

  if (!school) {
    console.error(`No school found matching "${nameArg}".`);
    process.exitCode = 1;
    await disconnectDatabase();
    return;
  }

  const schoolId = school._id;
  const label = school.name;
  console.log(`Resetting timetables for: ${label} (${String(schoolId)})`);

  const [slotsRes, conflictRes, versionRes] = await Promise.all([
    TimetableSlot.deleteMany({ schoolId }),
    TimetableConflict.deleteMany({ schoolId }),
    TimetableVersion.deleteMany({ schoolId }),
  ]);

  console.log(
    `Deleted TimetableSlot=${slotsRes.deletedCount}, TimetableConflict=${conflictRes.deletedCount}, TimetableVersion=${versionRes.deletedCount}`
  );

  await SchoolSettings.findOneAndUpdate(
    { schoolId },
    {
      $set: {
        scheduleModelVersion: 2,
        daySchedules: [],
        gradeDayScheduleProfiles: [],
        dailyScheduleOverrides: [],
        gradeScheduleOverrides: [],
        breakDailyOverrides: [],
        breakGradeOverrides: [],
        breaks: [],
      },
      $unset: { periodSlots: 1 },
    },
    { new: true, upsert: false }
  );

  console.log("Cleared SchoolSettings daySchedules / gradeDayScheduleProfiles and legacy timetable fields.");
  await disconnectDatabase();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
  return disconnectDatabase();
});
