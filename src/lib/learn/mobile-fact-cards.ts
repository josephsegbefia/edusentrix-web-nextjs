import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import { getStudentLearnAccess } from "@/lib/learn/access";
import { findCoveredLessonSessions } from "@/lib/learn/covered-lesson-sessions";
import { LearnFactCard } from "@/models/LearnFactCard";
import { LessonSession } from "@/models/LessonSession";
import { SubjectOffering } from "@/models/SubjectOffering";

export type MobileFactCardRow = {
  id: string;
  sessionId: string;
  sessionTitle: string;
  subjectName: string;
  fact: string;
  detail: string;
  tags: string[];
  illustrationUrl: string | null;
  publishedAt: string | null;
};

export type MobileFactCardsListData = {
  header: { title: string; leoTip: string };
  cards: MobileFactCardRow[];
};

async function assertFactCardAccess(context: LearnMobileStudentContext) {
  const access = await getStudentLearnAccess({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
  });

  if (!access.hasAccess) {
    return {
      ok: false as const,
      code: access.schoolEligible ? "LEARN_ACCESS_REQUIRED" : "SCHOOL_NOT_ELIGIBLE",
      message: access.blockedReason || "Learn access required.",
      status: 403,
    };
  }

  if (!context.classGroupId) {
    return {
      ok: false as const,
      code: "NO_STUDENT_PROFILE",
      message: "Class group not found.",
      status: 404,
    };
  }

  return { ok: true as const };
}

export async function buildMobileFactCardsList(context: LearnMobileStudentContext) {
  await connectToDatabase();
  const gate = await assertFactCardAccess(context);
  if (!gate.ok) return gate;

  const coveredSessions = await findCoveredLessonSessions({
    schoolId: context.schoolId,
    classGroupId: context.classGroupId,
    limit: 80,
  });

  const sessionIds = coveredSessions.map((session) => session._id);
  if (!sessionIds.length) {
    return {
      ok: true as const,
      data: {
        header: {
          title: "Did you know?",
          leoTip: "Your teacher will share interesting facts from class soon.",
        },
        cards: [],
      } satisfies MobileFactCardsListData,
    };
  }

  const cards = await LearnFactCard.find({
    schoolId: context.schoolId,
    classGroupId: context.classGroupId,
    sessionId: { $in: sessionIds },
    publishedToLearn: true,
    status: "published",
  })
    .sort({ publishedAt: -1, createdAt: -1 })
    .limit(100)
    .lean<
      Array<{
        _id: Types.ObjectId;
        sessionId: Types.ObjectId;
        subjectOfferingId?: Types.ObjectId | null;
        fact: string;
        detail: string;
        tags?: string[];
        illustrationUrl?: string | null;
        publishedAt?: Date | null;
      }>
    >();

  const offeringIds = Array.from(
    new Set(cards.map((card) => String(card.subjectOfferingId)).filter(Boolean)),
  );
  const offerings = offeringIds.length
    ? await SubjectOffering.find({ _id: { $in: offeringIds }, schoolId: context.schoolId })
        .select("_id displayName shortName")
        .lean<Array<{ _id: Types.ObjectId; displayName: string; shortName?: string }>>()
    : [];
  const offeringMap = new Map(
    offerings.map((row) => [String(row._id), row.shortName || row.displayName || "Subject"]),
  );

  const sessionMap = new Map(
    coveredSessions.map((session) => [String(session._id), session.title]),
  );

  const rows: MobileFactCardRow[] = cards.map((card) => ({
    id: String(card._id),
    sessionId: String(card.sessionId),
    sessionTitle: sessionMap.get(String(card.sessionId)) || "Class lesson",
    subjectName: card.subjectOfferingId
      ? offeringMap.get(String(card.subjectOfferingId)) || "Subject"
      : "Subject",
    fact: card.fact,
    detail: card.detail,
    tags: card.tags ?? [],
    illustrationUrl: card.illustrationUrl ?? null,
    publishedAt: card.publishedAt?.toISOString() ?? null,
  }));

  return {
    ok: true as const,
    data: {
      header: {
        title: "Did you know?",
        leoTip:
          rows.length > 0
            ? "Swipe through facts your teacher picked from class."
            : "Your teacher will share interesting facts from class soon.",
      },
      cards: rows,
    } satisfies MobileFactCardsListData,
  };
}

export async function buildMobileFactCardDetail(
  context: LearnMobileStudentContext,
  cardId: string,
) {
  await connectToDatabase();
  const gate = await assertFactCardAccess(context);
  if (!gate.ok) return gate;

  if (!Types.ObjectId.isValid(cardId)) {
    return {
      ok: false as const,
      code: "INVALID_CARD_ID",
      message: "Invalid fact card id.",
      status: 400,
    };
  }

  const card = await LearnFactCard.findOne({
    _id: cardId,
    schoolId: context.schoolId,
    classGroupId: context.classGroupId,
    publishedToLearn: true,
    status: "published",
  }).lean<{
    _id: Types.ObjectId;
    sessionId: Types.ObjectId;
    subjectOfferingId?: Types.ObjectId | null;
    fact: string;
    detail: string;
    tags?: string[];
    illustrationUrl?: string | null;
    publishedAt?: Date | null;
  } | null>();

  if (!card) {
    return {
      ok: false as const,
      code: "FACT_CARD_NOT_FOUND",
      message: "Fact card not found.",
      status: 404,
    };
  }

  const session = await LessonSession.findOne({
    _id: card.sessionId,
    schoolId: context.schoolId,
  })
    .select("title studentVisibility")
    .lean<{ title: string } | null>();

  const offering = card.subjectOfferingId
    ? await SubjectOffering.findOne({ _id: card.subjectOfferingId, schoolId: context.schoolId })
        .select("displayName shortName")
        .lean<{ displayName: string; shortName?: string } | null>()
    : null;

  return {
    ok: true as const,
    data: {
      id: String(card._id),
      sessionId: String(card.sessionId),
      sessionTitle: session?.title || "Class lesson",
      subjectName: offering?.shortName || offering?.displayName || "Subject",
      fact: card.fact,
      detail: card.detail,
      tags: card.tags ?? [],
      illustrationUrl: card.illustrationUrl ?? null,
      publishedAt: card.publishedAt?.toISOString() ?? null,
    } satisfies MobileFactCardRow,
  };
}
