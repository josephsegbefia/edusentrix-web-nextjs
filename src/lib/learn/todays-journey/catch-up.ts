import "server-only";

import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getStudentLearnAccess } from "@/lib/learn/access";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import {
  LearnSubjectJourney,
  type ILearnSubjectJourney,
} from "@/models/LearnSubjectJourney";
import { RevisionBankItem } from "@/models/RevisionBankItem";

import { dateKeyForSchoolDay, JOURNEY_TIMEZONE } from "./journey-step-utils";
import { loadSubjectJourneyDetail, type MobileSubjectJourneyDetail } from "./load-subject-journey";
import {
  serializeSubjectJourneySummary,
  type MobileSubjectJourneySummary,
} from "./serialize-todays-journey";

export type CatchUpVaultGroupId = "today" | "this_week" | "older";

export type MobileCatchUpVaultGroup = {
  id: CatchUpVaultGroupId;
  title: string;
  items: MobileSubjectJourneySummary[];
};

export type MobileCatchUpVaultResponse = {
  headline: string;
  message: string;
  pressure: "none" | "light" | "moderate" | "recovery";
  totalCount: number;
  visibleCount: number;
  groups: MobileCatchUpVaultGroup[];
};

const MAX_VAULT_VISIBLE = 12;
const MAX_CATCH_UP_AGE_DAYS = 5;

type JourneyResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; status: number };

function daysBetweenDateKeys(older: string, newer: string) {
  const olderDate = new Date(`${older}T12:00:00.000Z`);
  const newerDate = new Date(`${newer}T12:00:00.000Z`);
  return Math.floor((newerDate.getTime() - olderDate.getTime()) / (24 * 60 * 60 * 1000));
}

function catchUpPressure(count: number): MobileCatchUpVaultResponse["pressure"] {
  if (count <= 0) return "none";
  if (count <= 2) return "light";
  if (count <= 5) return "moderate";
  return "recovery";
}

function groupIdForJourney(todayKey: string, journeyDate: string): CatchUpVaultGroupId {
  const ageDays = daysBetweenDateKeys(journeyDate, todayKey);
  if (ageDays <= 0) return "today";
  if (ageDays <= 7) return "this_week";
  return "older";
}

function groupTitle(id: CatchUpVaultGroupId) {
  if (id === "today") return "Saved today";
  if (id === "this_week") return "This week";
  return "Older reviews";
}

function vaultMessage(count: number) {
  if (count === 0) return "You are all caught up. Leo will save important reviews here when needed.";
  if (count === 1) return "Leo saved 1 important review for you.";
  if (count <= 3) return `Leo saved ${count} important reviews for this week.`;
  return `Leo saved a few important reviews so you can catch up calmly.`;
}

async function moveStaleJourneysToRevisionBank(input: {
  context: LearnMobileStudentContext;
  todayKey: string;
  journeys: ILearnSubjectJourney[];
}) {
  if (!input.context.classGroupId) return input.journeys;

  const kept: ILearnSubjectJourney[] = [];

  for (const journey of input.journeys) {
    const ageDays = daysBetweenDateKeys(journey.date, input.todayKey);
    const isLowPriority = journey.priorityScore < 45 && journey.completionPercent < 35;

    if (ageDays > MAX_CATCH_UP_AGE_DAYS && isLowPriority) {
      await LearnSubjectJourney.updateOne(
        { _id: journey._id },
        { $set: { status: "moved_to_revision_bank" } }
      );

      const existing = await RevisionBankItem.findOne({
        schoolId: input.context.schoolId,
        studentId: input.context.studentId,
        lessonId: journey.lessonSessionId,
        status: "active",
      });

      if (!existing) {
        await RevisionBankItem.create({
          schoolId: input.context.schoolId,
          studentId: input.context.studentId,
          classGroupId: input.context.classGroupId,
          subjectOfferingId: journey.subjectOfferingId ?? null,
          subjectId: journey.subjectId ?? null,
          subjectName: journey.subjectName,
          lessonId: journey.lessonSessionId,
          conceptTitle: journey.topicTitle,
          conceptTags: [journey.topicTitle],
          reason: "spaced_repetition",
          priorityScore: 35,
          status: "active",
        });
      }
      continue;
    }

    kept.push(journey);
  }

  return kept;
}

export async function buildCatchUpVault(
  context: LearnMobileStudentContext
): Promise<JourneyResult<MobileCatchUpVaultResponse>> {
  await connectToDatabase();

  const access = await getStudentLearnAccess({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
  });

  if (!access.hasAccess) {
    return {
      ok: false,
      code: access.schoolEligible ? "LEARN_ACCESS_REQUIRED" : "SCHOOL_NOT_ELIGIBLE",
      message: access.blockedReason || "Learn access required.",
      status: 403,
    };
  }

  const todayKey = dateKeyForSchoolDay(new Date(), JOURNEY_TIMEZONE);

  const rawJourneys = await LearnSubjectJourney.find({
    schoolId: context.schoolId,
    studentId: context.studentId,
    completionPercent: { $lt: 100 },
    status: {
      $in: ["available", "not_started", "in_progress", "saved_for_later"],
    },
    $or: [{ date: { $lt: todayKey } }, { "catchUp.isCatchUp": true }, { status: "saved_for_later" }],
  })
    .sort({ priorityScore: -1, updatedAt: -1 })
    .limit(40)
    .lean<ILearnSubjectJourney[]>();

  const journeys = await moveStaleJourneysToRevisionBank({
    context,
    todayKey,
    journeys: rawJourneys,
  });

  const summaries = journeys
    .map(serializeSubjectJourneySummary)
    .slice(0, MAX_VAULT_VISIBLE);

  const grouped = new Map<CatchUpVaultGroupId, MobileSubjectJourneySummary[]>([
    ["today", []],
    ["this_week", []],
    ["older", []],
  ]);

  for (const item of summaries) {
    const journey = journeys.find((row) => String(row._id) === item.id);
    if (!journey) continue;
    const groupId = groupIdForJourney(todayKey, journey.date);
    grouped.get(groupId)?.push(item);
  }

  const groups: MobileCatchUpVaultGroup[] = (["today", "this_week", "older"] as const)
    .map((id) => ({
      id,
      title: groupTitle(id),
      items: grouped.get(id) ?? [],
    }))
    .filter((group) => group.items.length > 0);

  const totalCount = journeys.length;
  const visibleCount = summaries.length;

  return {
    ok: true,
    data: {
      headline: "Catch-up Vault",
      message: vaultMessage(visibleCount),
      pressure: catchUpPressure(visibleCount),
      totalCount,
      visibleCount,
      groups,
    },
  };
}

export async function saveJourneyForLater(
  context: LearnMobileStudentContext,
  journeyId: string
): Promise<JourneyResult<MobileSubjectJourneyDetail>> {
  await connectToDatabase();

  if (!Types.ObjectId.isValid(journeyId)) {
    return {
      ok: false,
      code: "JOURNEY_NOT_FOUND",
      message: "Subject journey not found.",
      status: 404,
    };
  }

  const journey = await LearnSubjectJourney.findOne({
    _id: journeyId,
    schoolId: context.schoolId,
    studentId: context.studentId,
  });

  if (!journey) {
    return {
      ok: false,
      code: "JOURNEY_NOT_FOUND",
      message: "Subject journey not found.",
      status: 404,
    };
  }

  if (journey.status === "completed" || journey.status === "moved_to_revision_bank") {
    return {
      ok: false,
      code: "JOURNEY_NOT_SAVEABLE",
      message: "This journey cannot be saved for later.",
      status: 400,
    };
  }

  journey.status = "saved_for_later";
  journey.catchUp = {
    ...journey.catchUp,
    isCatchUp: true,
    savedAt: new Date(),
    carryCount: (journey.catchUp?.carryCount ?? 0) + 1,
  };
  await journey.save();

  const detail = await loadSubjectJourneyDetail(context, journeyId);
  return detail;
}
