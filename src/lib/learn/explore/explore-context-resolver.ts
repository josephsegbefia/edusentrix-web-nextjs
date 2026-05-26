import "server-only";

import { Types } from "mongoose";

import { connectToDatabase } from "@/db/connectToDatabase";
import { buildExploreGenerationKey } from "@/lib/learn/explore/build-generation-key";
import {
  buildExploreLessonBrief,
  parseExploreLessonId,
  parseExploreSubjectOfferingId,
} from "@/lib/learn/explore/explore-lesson-context";
import type { ResolvedExploreGenerationContext } from "@/lib/learn/explore/explore-types";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import { loadMobileStudentBundle } from "@/lib/learn/mobile-student-profile";
import {
  defaultSinceDays,
  findCoveredLessonSessions,
  findLatestCoveredLessonSession,
  loadCoveredLessonSessionById,
} from "@/lib/learn/covered-lesson-sessions";
import { resolveSessionFlashcardsForStudent } from "@/lib/learn/leo-session-flashcards";
import { SubjectOffering } from "@/models/SubjectOffering";

export const EXPLORE_NO_CONTEXT_FRIENDLY_MESSAGE =
  "Your Explore missions will appear after your teacher covers a lesson in class.";

type ExploreSessionRow = {
  _id: Types.ObjectId;
  title: string;
  subjectOfferingId: Types.ObjectId;
  ownerTeacherId: Types.ObjectId;
  planNotes?: string | null;
  contentBlocks?: Array<{ type?: string; title?: string | null; bodyHtml?: string }>;
};

export type ResolveExploreContextInput = {
  auth: LearnMobileStudentContext;
  /** Lesson session id (`session-<id>` or raw ObjectId). Must be class-covered when set. */
  lessonId?: string;
  /** Subject offering id — must match the resolved covered lesson. */
  subjectId?: string;
};

export type ResolveExploreContextResult =
  | { ok: true; context: ResolvedExploreGenerationContext }
  | {
      ok: false;
      code:
        | "NO_EXPLORE_CONTEXT"
        | "NO_STUDENT_PROFILE"
        | "LESSON_NOT_COVERED"
        | "SUBJECT_LESSON_MISMATCH";
      message: string;
      friendlyMessage: string;
      status: number;
    };

const SESSION_SELECT =
  "_id title subjectOfferingId ownerTeacherId planNotes contentBlocks";

export {
  buildExploreLessonBrief,
  parseExploreLessonId,
  parseExploreSubjectOfferingId,
} from "@/lib/learn/explore/explore-lesson-context";

async function subjectNameForOffering(
  schoolId: Types.ObjectId,
  offeringId: Types.ObjectId
) {
  const row = await SubjectOffering.findOne({ _id: offeringId, schoolId })
    .select("displayName shortName curriculumCode")
    .lean<{
      displayName?: string;
      shortName?: string;
      curriculumCode?: string;
    } | null>();

  return {
    subjectName: row?.shortName || row?.displayName || "Subject",
    curriculum: row?.curriculumCode,
  };
}

async function loadRelatedLessonTitles(
  schoolId: Types.ObjectId,
  classGroupId: Types.ObjectId,
  session: ExploreSessionRow
) {
  const sessions = await findCoveredLessonSessions<{
    _id: Types.ObjectId;
    title: string;
    subjectOfferingId: Types.ObjectId;
  }>({
    schoolId,
    classGroupId,
    since: defaultSinceDays(45),
    limit: 24,
    select: "_id title subjectOfferingId",
  });

  return sessions
    .filter((row) => String(row._id) !== String(session._id))
    .filter(
      (row) => String(row.subjectOfferingId) === String(session.subjectOfferingId)
    )
    .map((row) => row.title)
    .slice(0, 6);
}

async function findLatestCoveredLessonForSubject(input: {
  schoolId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  subjectOfferingId: Types.ObjectId;
}): Promise<ExploreSessionRow | null> {
  const sessions = await findCoveredLessonSessions<ExploreSessionRow>({
    schoolId: input.schoolId,
    classGroupId: input.classGroupId,
    since: defaultSinceDays(21),
    limit: 16,
    select: SESSION_SELECT,
  });

  return (
    sessions.find(
      (row) => String(row.subjectOfferingId) === String(input.subjectOfferingId)
    ) ?? null
  );
}

type CoveredSessionFailureCode =
  | "NO_EXPLORE_CONTEXT"
  | "LESSON_NOT_COVERED"
  | "SUBJECT_LESSON_MISMATCH";

async function resolveCoveredSession(input: {
  schoolId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  lessonId?: string;
  subjectOfferingId?: Types.ObjectId | null;
}): Promise<
  | { ok: true; session: ExploreSessionRow }
  | { ok: false; code: CoveredSessionFailureCode; message: string }
> {
  let sessionId: Types.ObjectId | null = null;

  if (input.lessonId) {
    sessionId = parseExploreLessonId(input.lessonId);
    if (!sessionId) {
      return {
        ok: false,
        code: "LESSON_NOT_COVERED",
        message: "Invalid lesson id.",
      };
    }

    const session = await loadCoveredLessonSessionById<ExploreSessionRow>({
      schoolId: input.schoolId,
      classGroupId: input.classGroupId,
      sessionId,
      select: SESSION_SELECT,
    });

    if (!session) {
      return {
        ok: false,
        code: "LESSON_NOT_COVERED",
        message: "Lesson is not covered or not visible to this class.",
      };
    }

    if (
      input.subjectOfferingId &&
      String(session.subjectOfferingId) !== String(input.subjectOfferingId)
    ) {
      return {
        ok: false,
        code: "SUBJECT_LESSON_MISMATCH",
        message: "Lesson does not belong to the requested subject.",
      };
    }

    return { ok: true, session };
  }

  if (input.subjectOfferingId) {
    const session = await findLatestCoveredLessonForSubject({
      schoolId: input.schoolId,
      classGroupId: input.classGroupId,
      subjectOfferingId: input.subjectOfferingId,
    });

    if (!session) {
      return {
        ok: false,
        code: "NO_EXPLORE_CONTEXT",
        message: "No covered lesson found for this subject.",
      };
    }

    return { ok: true, session };
  }

  const latest = await findLatestCoveredLessonSession<ExploreSessionRow>({
    schoolId: input.schoolId,
    classGroupId: input.classGroupId,
    since: defaultSinceDays(21),
    select: SESSION_SELECT,
  });

  if (!latest) {
    return {
      ok: false,
      code: "NO_EXPLORE_CONTEXT",
      message: "No covered lessons available for Explore.",
    };
  }

  return { ok: true, session: latest };
}

/**
 * Resolves authenticated student + class-scoped covered lesson context for lazy Explore.
 * Version one: only approved class lesson data — no arbitrary student topics.
 */
export async function resolveExploreGenerationContext(
  input: ResolveExploreContextInput
): Promise<ResolveExploreContextResult> {
  const { auth } = input;

  if (!auth.classGroupId) {
    return {
      ok: false,
      code: "NO_STUDENT_PROFILE",
      message: "Class group not found for student.",
      friendlyMessage: "We could not find your class yet. Please ask your school administrator.",
      status: 404,
    };
  }

  await connectToDatabase();

  const bundle = await loadMobileStudentBundle({
    schoolId: auth.schoolId,
    studentId: auth.studentId,
    accountId: auth.accountId,
  });

  if (!bundle) {
    return {
      ok: false,
      code: "NO_STUDENT_PROFILE",
      message: "Student profile not found.",
      friendlyMessage: "We could not find your student profile yet.",
      status: 404,
    };
  }

  const gradeName = bundle.gradeName?.trim() || "Your grade";
  const gradeLevel = gradeName;
  const requestedSubjectId = input.subjectId
    ? parseExploreSubjectOfferingId(input.subjectId)
    : null;

  if (input.subjectId && !requestedSubjectId) {
    return {
      ok: false,
      code: "NO_EXPLORE_CONTEXT",
      message: "Invalid subject id.",
      friendlyMessage: EXPLORE_NO_CONTEXT_FRIENDLY_MESSAGE,
      status: 404,
    };
  }

  const sessionResult = await resolveCoveredSession({
    schoolId: auth.schoolId,
    classGroupId: auth.classGroupId,
    lessonId: input.lessonId,
    subjectOfferingId: requestedSubjectId,
  });

  if (!sessionResult.ok) {
    const friendlyByCode: Record<string, string> = {
      NO_EXPLORE_CONTEXT: EXPLORE_NO_CONTEXT_FRIENDLY_MESSAGE,
      LESSON_NOT_COVERED:
        "That lesson is not available for Explore yet. Pick another lesson from your class.",
      SUBJECT_LESSON_MISMATCH:
        "That lesson does not match the subject you selected. Try again from your class lessons.",
    };

    return {
      ok: false,
      code: sessionResult.code,
      message: sessionResult.message,
      friendlyMessage:
        friendlyByCode[sessionResult.code] ?? EXPLORE_NO_CONTEXT_FRIENDLY_MESSAGE,
      status: sessionResult.code === "SUBJECT_LESSON_MISMATCH" ? 400 : 404,
    };
  }

  const session = sessionResult.session;
  const { subjectName, curriculum } = await subjectNameForOffering(
    auth.schoolId,
    session.subjectOfferingId
  );

  const lessonBrief = buildExploreLessonBrief(session);
  const relatedLessonTitles = await loadRelatedLessonTitles(
    auth.schoolId,
    auth.classGroupId,
    session
  );

  const flashcardResolution = await resolveSessionFlashcardsForStudent({
    schoolId: auth.schoolId,
    classGroupId: auth.classGroupId,
    studentId: auth.studentId,
    session,
    cardLimit: 6,
    generateIfMissing: false,
  });

  const flashcardHints =
    flashcardResolution?.cards.map((card) => ({
      front: card.front,
      back: card.back,
    })) ?? [];

  const sourceContext = {
    schoolId: String(auth.schoolId),
    classGroupId: String(auth.classGroupId),
    subjectId: String(session.subjectOfferingId),
    lessonId: String(session._id),
    lessonTitle: session.title,
    gradeLevel,
    curriculum,
    academicYearName: bundle.academicYearName,
    termName: bundle.termName,
  };

  const generationKey = buildExploreGenerationKey({
    schoolId: auth.schoolId,
    classGroupId: auth.classGroupId,
    subjectId: session.subjectOfferingId,
    lessonId: session._id,
    gradeLevel,
  });

  return {
    ok: true,
    context: {
      studentId: String(auth.studentId),
      schoolId: String(auth.schoolId),
      classGroupId: String(auth.classGroupId),
      gradeId: auth.gradeId ? String(auth.gradeId) : null,
      gradeLevel,
      gradeName,
      subjectOfferingId: String(session.subjectOfferingId),
      subjectName,
      lessonId: String(session._id),
      lessonTitle: session.title,
      lessonBrief,
      sourceContext,
      generationKey,
      curriculum,
      academicYearName: bundle.academicYearName,
      termName: bundle.termName,
      relatedLessonTitles,
      flashcardHints,
    },
  };
}
