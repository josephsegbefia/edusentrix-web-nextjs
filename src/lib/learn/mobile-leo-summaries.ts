import "server-only";

import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import { LearnActivityEvent } from "@/models/LearnActivityEvent";
import { LeoConversation } from "@/models/LeoConversation";
import { LeoMessage } from "@/models/LeoMessage";

export type LeoUsageSummaryAudience = "student" | "parent" | "teacher" | "admin";

export type MobileLeoUsageSummary = {
  studentId: string;
  periodDays: number;
  conversationCount: number;
  messageCount: number;
  tutorSessions: number;
  safetyEvents: number;
  lastActiveAt: string | null;
  highlights: string[];
  privacyNote: string;
};

function tutorRoute(studentId: Types.ObjectId) {
  return `learn-mobile-tutor:${String(studentId)}`;
}

export async function getMobileLeoUsageSummary(input: {
  context: LearnMobileStudentContext;
  audience: LeoUsageSummaryAudience;
  periodDays?: number;
}): Promise<MobileLeoUsageSummary> {
  await connectToDatabase();

  const periodDays = input.periodDays ?? 7;
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
  const route = tutorRoute(input.context.studentId);

  const [conversationCount, messageCount, activityRows] = await Promise.all([
    LeoConversation.countDocuments({
      schoolId: input.context.schoolId,
      userId: input.context.accountId,
      sourceRoute: route,
      archivedAt: null,
    }),
    LeoMessage.countDocuments({
      schoolId: input.context.schoolId,
      userId: input.context.accountId,
      createdAt: { $gte: since },
    }),
    LearnActivityEvent.find({
      schoolId: input.context.schoolId,
      studentId: input.context.studentId,
      occurredAt: { $gte: since },
      eventType: "leo_tutor_message",
    })
      .select("occurredAt metadata")
      .sort({ occurredAt: -1 })
      .limit(200)
      .lean<Array<{ occurredAt: Date; metadata?: Record<string, unknown> }>>(),
  ]);

  const tutorSessions = activityRows.filter(
    (row) => row.metadata?.phase !== "safety_review",
  ).length;
  const safetyEvents = activityRows.filter(
    (row) => row.metadata?.phase === "safety_review",
  ).length;
  const lastActiveAt = activityRows[0]?.occurredAt?.toISOString() ?? null;

  const highlights: string[] = [];
  if (tutorSessions > 0) {
    highlights.push(
      input.audience === "parent"
        ? `Your child used Leo for learning help ${tutorSessions} time${tutorSessions === 1 ? "" : "s"} this week.`
        : `You used Leo ${tutorSessions} time${tutorSessions === 1 ? "" : "s"} this week.`,
    );
  } else {
    highlights.push("No Leo tutor sessions recorded in this period yet.");
  }

  if (safetyEvents > 0 && input.audience !== "student") {
    highlights.push(
      `${safetyEvents} safety review${safetyEvents === 1 ? "" : "s"} logged. Message content is not shown.`,
    );
  }

  if (input.audience === "admin") {
    highlights.push(
      `Messages in period: ${messageCount}. Active conversations: ${conversationCount}.`,
    );
  }

  return {
    studentId: String(input.context.studentId),
    periodDays,
    conversationCount,
    messageCount,
    tutorSessions,
    safetyEvents,
    lastActiveAt,
    highlights,
    privacyNote:
      "Summaries include usage counts and safe highlights only — not full chat transcripts.",
  };
}
