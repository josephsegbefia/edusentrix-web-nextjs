/**
 * Seeds a combined daily schedule (Nursery + KG + Primary) for Snow Leopard Academy
 * with different structures on Wednesday and Friday.
 *
 * Usage:
 *   npx tsx scripts/seed-snow-leopard-combined-daily-schedule.ts
 *   npx tsx scripts/seed-snow-leopard-combined-daily-schedule.ts "Snow Leopard Academy"
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "path";
import mongoose from "mongoose";

loadEnv({ path: resolve(process.cwd(), ".env.local"), quiet: true });
loadEnv({ path: resolve(process.cwd(), ".env"), quiet: true });

import { connectToDatabase, disconnectDatabase } from "../src/db/connectToDatabase";
import { School } from "../src/models/School";
import { Grade } from "../src/models/Grade";
import { SchoolDailySchedule } from "../src/models/SchoolDailySchedule";
import {
  prepareSchoolDailyConfigForApi,
} from "../src/lib/school-day/migrate-v2";
import { validateAndNormalizeSchoolDailySchedule } from "../src/lib/school-day/validateConfig";
import { buildResolvedFromSchoolDailyConfig } from "../src/lib/timetable/dailyScheduleTimetable";
import type { SchoolDailyScheduleConfigV2 } from "../src/types/school-daily-schedule";

const GROUP_ID = "nursery-kg-primary-test";
const GROUP_LABEL = "Nursery, KG & Primary (test)";

/** Grades included in the combined testing profile (excludes JHS). */
const GRADE_NAME_PATTERN =
  /^(Creche|Nursery|KG\s*1|KG\s*2|KG1|KG2|Primary\s*[1-6])$/i;

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildCombinedConfig(): SchoolDailyScheduleConfigV2 {
  return {
    version: 2,
    dayGateStart: "08:00",
    lessonStart: "08:15",
    dayEnd: "14:30",
    periodLengthMinutes: 35,
    periodLengthOverrides: [],
    openingBlocks: [
      {
        id: "opening-assembly",
        name: "Morning circle / assembly",
        kind: "assembly",
        startTime: "08:00",
        endTime: "08:15",
      },
    ],
    breaks: [
      {
        id: "break-short",
        name: "Short Break",
        startTime: "09:40",
        endTime: "09:55",
      },
      {
        id: "break-snack",
        name: "Snack Break",
        startTime: "11:05",
        endTime: "11:20",
      },
      {
        id: "break-lunch",
        name: "Lunch",
        startTime: "12:30",
        endTime: "13:15",
      },
    ],
    allWeekdaysSame: false,
    weekdayExceptions: [
      {
        weekday: "wednesday",
        dayGateStart: "08:00",
        lessonStart: "08:10",
        dayEnd: "14:30",
        periodLengthMinutes: 30,
        openingBlocks: [
          {
            id: "wed-registration",
            name: "Registration",
            kind: "registration",
            startTime: "08:00",
            endTime: "08:10",
          },
        ],
        breaks: [
          {
            id: "wed-short",
            name: "Short Break",
            startTime: "09:30",
            endTime: "09:45",
          },
          {
            id: "wed-lunch",
            name: "Lunch",
            startTime: "12:00",
            endTime: "12:45",
          },
          {
            id: "wed-outdoor",
            name: "Outdoor / clubs (end of day)",
            startTime: "13:50",
            endTime: "14:15",
          },
        ],
      },
      {
        weekday: "friday",
        dayGateStart: "08:00",
        lessonStart: "08:10",
        dayEnd: "14:00",
        periodLengthMinutes: 30,
        openingBlocks: [
          {
            id: "fri-assembly",
            name: "Assembly",
            kind: "assembly",
            startTime: "08:00",
            endTime: "08:10",
          },
        ],
        breaks: [
          {
            id: "fri-short",
            name: "Short Break",
            startTime: "09:35",
            endTime: "09:50",
          },
          {
            id: "fri-lunch",
            name: "Lunch",
            startTime: "11:45",
            endTime: "12:30",
          },
        ],
      },
    ],
    hasGradeOverrides: false,
    gradeOverrides: [],
  };
}

async function main() {
  const schoolName =
    process.argv[2]?.trim() ||
    process.env.SCHOOL_NAME?.trim() ||
    "Snow Leopard Academy";

  await connectToDatabase();

  const school = await School.findOne({
    name: new RegExp(`^${escapeRegex(schoolName)}$`, "i"),
  }).lean();

  if (!school) {
    console.error(`School not found: ${schoolName}`);
    process.exitCode = 1;
    await disconnectDatabase();
    return;
  }

  const schoolId = school._id as mongoose.Types.ObjectId;

  const grades = await Grade.find({ schoolId, isActive: true })
    .select("_id name")
    .sort({ name: 1 })
    .lean();

  const included = grades.filter((g) =>
    GRADE_NAME_PATTERN.test(String(g.name).trim())
  );

  if (included.length === 0) {
    console.error("No matching Nursery/KG/Primary grades found.");
    process.exitCode = 1;
    await disconnectDatabase();
    return;
  }

  const rawConfig = buildCombinedConfig();
  const prepared = prepareSchoolDailyConfigForApi(rawConfig);
  const validated = validateAndNormalizeSchoolDailySchedule(prepared);

  if (!validated.ok) {
    console.error("Config validation failed:", validated.error);
    process.exitCode = 1;
    await disconnectDatabase();
    return;
  }

  const config = validated.config;
  const gradeIds = included.map((g) => g._id as mongoose.Types.ObjectId);

  const existing = await SchoolDailySchedule.findOne({ schoolId }).lean();
  const revision = (existing?.revision ?? 0) + 1;

  const historyEntry = existing
    ? {
        revision: existing.revision ?? 0,
        savedAt: new Date(),
        label: "Before Nursery/KG/Primary test schedule",
        scheduleMode: existing.scheduleMode ?? "unified",
        scheduleGroups: existing.scheduleGroups,
        config: existing.config,
      }
    : null;

  await SchoolDailySchedule.findOneAndUpdate(
    { schoolId },
    {
      $set: {
        scheduleMode: "grouped",
        config: null,
        scheduleGroups: [
          {
            groupId: GROUP_ID,
            label: GROUP_LABEL,
            gradeIds,
            classGroupIds: [],
            config,
          },
        ],
        revision,
        updatedBy: null,
      },
      ...(historyEntry
        ? {
            $push: {
              scheduleHistory: {
                $each: [historyEntry],
                $slice: -20,
              },
            },
          }
        : {}),
    },
    { upsert: true, new: true }
  );

  console.log(`School: ${school.name} (${String(schoolId)})`);
  console.log(`Schedule group: ${GROUP_LABEL}`);
  console.log(
    "Grades:",
    included.map((g) => g.name).join(", ")
  );
  if (validated.warnings?.length) {
    console.log("Warnings:", validated.warnings.join("; "));
  }

  const sampleGradeId = String(included.find((g) => /Primary\s*3/i.test(g.name))?._id ?? included[0]!._id);
  for (const [dayNum, label] of [
    [1, "Monday"],
    [3, "Wednesday"],
    [5, "Friday"],
  ] as const) {
    const resolved = buildResolvedFromSchoolDailyConfig(config, sampleGradeId, dayNum);
    console.log(
      `${label}: ${resolved?.periodsPerDay ?? 0} periods, ${resolved?.periodDuration ?? 0} min avg, ${resolved?.startTime}–${resolved?.endTime}`
    );
  }

  console.log("\nDone. Open Admin → Settings → Daily schedule to review the timeline.");
  await disconnectDatabase();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
  return disconnectDatabase();
});
