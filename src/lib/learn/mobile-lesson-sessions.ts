import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import { getStudentLearnAccess } from "@/lib/learn/access";
import { findCoveredLessonSessions } from "@/lib/learn/covered-lesson-sessions";
import { canStudentViewNotebookNotes } from "@/lib/lessons/notebook-notes-visibility";
import { LessonDelivery } from "@/models/LessonDelivery";
import { LessonSession } from "@/models/LessonSession";
import { SubjectOffering } from "@/models/SubjectOffering";

export type MobileLessonNotebookSummary = {
  id: string;
  title: string;
  subjectName: string;
  coveredLabel: string;
  hasNotebookNotes: boolean;
  notebookPreview: string | null;
  publishedAt: string | null;
};

export type MobileLessonNotebookDetail = {
  id: string;
  title: string;
  subjectName: string;
  coveredAt: string | null;
  notebookNotes: {
    contentHtml: string;
    publishedAt: string | null;
    aiGenerated: boolean;
  };
};

export type MobileLessonNotebooksListData = {
  header: { title: string; leoTip: string };
  sessions: MobileLessonNotebookSummary[];
};

function stripHtmlPreview(html: string, maxLen = 140) {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

function formatCoveredLabel(date: Date) {
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return "Covered today";
  if (diffDays === 1) return "Covered yesterday";
  if (diffDays < 7) return "Covered this week";
  return `Covered ${date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

async function assertLessonSessionAccess(context: LearnMobileStudentContext) {
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

export async function buildMobileLessonNotebooksList(context: LearnMobileStudentContext) {
  await connectToDatabase();
  const gate = await assertLessonSessionAccess(context);
  if (!gate.ok) return gate;

  const coveredSessions = await findCoveredLessonSessions({
    schoolId: context.schoolId,
    classGroupId: context.classGroupId,
    limit: 40,
  });

  const sessionIds = coveredSessions.map((session) => session._id);
  const [sessions, deliveries] = await Promise.all([
    sessionIds.length
      ? LessonSession.find({
          _id: { $in: sessionIds },
          schoolId: context.schoolId,
        })
          .select(
            "_id title subjectOfferingId scheduledDate boardNotes notebookNotesPublished",
          )
          .lean<
            Array<{
              _id: Types.ObjectId;
              title: string;
              subjectOfferingId?: Types.ObjectId | null;
              scheduledDate: Date;
              boardNotes?: { contentHtml?: string; generatedAt?: Date } | null;
              notebookNotesPublished?: boolean;
            }>
          >()
      : Promise.resolve([]),
    sessionIds.length
      ? LessonDelivery.find({
          schoolId: context.schoolId,
          classGroupId: context.classGroupId,
          sessionId: { $in: sessionIds },
        })
          .select("sessionId status")
          .lean<Array<{ sessionId: Types.ObjectId; status: string }>>()
      : Promise.resolve([]),
  ]);

  const deliveryMap = new Map(
    deliveries.map((row) => [String(row.sessionId), row.status]),
  );

  const offeringIds = Array.from(
    new Set(sessions.map((row) => String(row.subjectOfferingId)).filter(Boolean)),
  );
  const offerings = offeringIds.length
    ? await SubjectOffering.find({ _id: { $in: offeringIds }, schoolId: context.schoolId })
        .select("_id displayName shortName")
        .lean<Array<{ _id: Types.ObjectId; displayName: string; shortName?: string }>>()
    : [];
  const offeringMap = new Map(
    offerings.map((row) => [String(row._id), row.shortName || row.displayName || "Subject"]),
  );

  const rows: MobileLessonNotebookSummary[] = sessions
    .map((session) => {
      const deliveryStatus = deliveryMap.get(String(session._id)) ?? null;
      const boardHtml = session.boardNotes?.contentHtml ?? "";
      const canView = canStudentViewNotebookNotes({
        notebookNotesPublished: Boolean(session.notebookNotesPublished),
        boardNotesHtml: boardHtml,
        deliveryStatus,
      });

      return {
        id: String(session._id),
        title: session.title,
        subjectName: session.subjectOfferingId
          ? offeringMap.get(String(session.subjectOfferingId)) || "Subject"
          : "Subject",
        coveredLabel: formatCoveredLabel(session.scheduledDate),
        hasNotebookNotes: canView,
        notebookPreview: canView ? stripHtmlPreview(boardHtml) : null,
        publishedAt: session.boardNotes?.generatedAt?.toISOString() ?? null,
      };
    })
    .filter((row) => row.hasNotebookNotes);

  return {
    ok: true as const,
    data: {
      header: {
        title: "My notebooks",
        leoTip:
          rows.length > 0
            ? "Copy these notes into your school notebook after class."
            : "Notebook notes appear when your teacher shares them from class.",
      },
      sessions: rows,
    } satisfies MobileLessonNotebooksListData,
  };
}

export async function buildMobileLessonNotebookDetail(
  context: LearnMobileStudentContext,
  sessionId: string,
) {
  await connectToDatabase();
  const gate = await assertLessonSessionAccess(context);
  if (!gate.ok) return gate;

  if (!Types.ObjectId.isValid(sessionId)) {
    return {
      ok: false as const,
      code: "INVALID_SESSION_ID",
      message: "Invalid lesson session id.",
      status: 400,
    };
  }

  const session = await LessonSession.findOne({
    _id: sessionId,
    schoolId: context.schoolId,
    classGroupId: context.classGroupId,
  })
    .select(
      "_id title subjectOfferingId scheduledDate boardNotes notebookNotesPublished",
    )
    .lean<{
      _id: Types.ObjectId;
      title: string;
      subjectOfferingId?: Types.ObjectId | null;
      scheduledDate: Date;
      boardNotes?: { contentHtml?: string; generatedAt?: Date; aiGenerated?: boolean } | null;
      notebookNotesPublished?: boolean;
    } | null>();

  if (!session) {
    return {
      ok: false as const,
      code: "SESSION_NOT_FOUND",
      message: "Lesson session not found.",
      status: 404,
    };
  }

  const delivery = await LessonDelivery.findOne({
    schoolId: context.schoolId,
    classGroupId: context.classGroupId,
    sessionId: session._id,
  })
    .select("status completedAt")
    .lean<{ status: string; completedAt?: Date | null } | null>();

  const boardHtml = session.boardNotes?.contentHtml ?? "";
  const canView = canStudentViewNotebookNotes({
    notebookNotesPublished: Boolean(session.notebookNotesPublished),
    boardNotesHtml: boardHtml,
    deliveryStatus: delivery?.status ?? null,
  });

  if (!canView) {
    return {
      ok: false as const,
      code: "NOTEBOOK_NOT_SHARED",
      message: "Notebook notes are not shared for this lesson yet.",
      status: 403,
    };
  }

  const offering = session.subjectOfferingId
    ? await SubjectOffering.findOne({
        _id: session.subjectOfferingId,
        schoolId: context.schoolId,
      })
        .select("displayName shortName")
        .lean<{ displayName: string; shortName?: string } | null>()
    : null;

  return {
    ok: true as const,
    data: {
      id: String(session._id),
      title: session.title,
      subjectName: offering?.shortName || offering?.displayName || "Subject",
      coveredAt: delivery?.completedAt?.toISOString() ?? session.scheduledDate.toISOString(),
      notebookNotes: {
        contentHtml: boardHtml,
        publishedAt: session.boardNotes?.generatedAt?.toISOString() ?? null,
        aiGenerated: Boolean(session.boardNotes?.aiGenerated),
      },
    } satisfies MobileLessonNotebookDetail,
  };
}
