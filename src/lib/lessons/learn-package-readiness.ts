import "server-only";

import type { Types } from "mongoose";
import { LessonFlashcard } from "@/models/LessonFlashcard";
import { LessonFlashcardDeck } from "@/models/LessonFlashcardDeck";
import { LessonSession } from "@/models/LessonSession";
import { LessonDelivery } from "@/models/LessonDelivery";
import { getTeacherSessionExploreStatus } from "@/lib/learn/teacher-session-explore.service";
import { linkedAssignmentsSummaryForSession } from "@/lib/lessons/linked-session-assignments";
import { canStudentViewNotebookNotes } from "@/lib/lessons/notebook-notes-visibility";

export type LearnPackageItemId = "notebook" | "flashcards" | "explore" | "assignment" | "publish";

export type LearnPackageItemStatus =
  | "ready"
  | "needs_action"
  | "optional"
  | "unavailable"
  | "locked";

export type LearnPackageJourneyStep = {
  key: string;
  label: string;
  included: boolean;
  required: boolean;
};

export type TeacherSessionLearnPackage = {
  sessionId: string;
  sessionTitle: string;
  headline: string;
  message: string;
  readyCount: number;
  totalCount: number;
  publishReady: boolean;
  learnTeacherPriority: boolean;
  studentPreviewAvailable: boolean;
  items: Array<{
    id: LearnPackageItemId;
    label: string;
    status: LearnPackageItemStatus;
    message: string;
    studentVisible: boolean;
  }>;
  journeySteps: LearnPackageJourneyStep[];
};

function itemStatusMessage(status: LearnPackageItemStatus, ready: string, action: string) {
  if (status === "ready") return ready;
  if (status === "needs_action") return action;
  if (status === "optional") return "Optional in Today's Journey";
  if (status === "locked") return "Unlocks after you mark this class complete";
  return "Not set up yet";
}

export async function getTeacherSessionLearnPackage(input: {
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;
  classGroupId?: Types.ObjectId | null;
}): Promise<TeacherSessionLearnPackage | null> {
  const session = await LessonSession.findOne({
    _id: input.sessionId,
    schoolId: input.schoolId,
  })
    .select("title boardNotes notebookNotesPublished studentVisibility learnTeacherPriority classGroupId")
    .lean<{
      _id: Types.ObjectId;
      title: string;
      boardNotes?: { contentHtml?: string } | null;
      notebookNotesPublished?: boolean;
      studentVisibility?: "hidden" | "published";
      learnTeacherPriority?: boolean;
      classGroupId: Types.ObjectId;
    } | null>();

  if (!session) return null;

  const classGroupId = input.classGroupId ?? session.classGroupId;
  const delivery = await LessonDelivery.findOne({
    schoolId: input.schoolId,
    sessionId: input.sessionId,
    classGroupId,
  })
    .select("status")
    .lean<{ status?: string } | null>();

  const deliveryStatus = delivery?.status ?? null;
  const deliveryComplete = deliveryStatus === "completed";
  const boardHtml = session.boardNotes?.contentHtml?.trim() ?? "";
  const hasNotebookContent = boardHtml.length > 0;
  const notebookStudentVisible = canStudentViewNotebookNotes({
    notebookNotesPublished: Boolean(session.notebookNotesPublished),
    boardNotesHtml: boardHtml,
    deliveryStatus,
  });

  let notebookStatus: LearnPackageItemStatus = "unavailable";
  if (!deliveryComplete) {
    notebookStatus = "locked";
  } else if (notebookStudentVisible) {
    notebookStatus = "ready";
  } else if (hasNotebookContent) {
    notebookStatus = "needs_action";
  }

  const deck = await LessonFlashcardDeck.findOne({
    schoolId: input.schoolId,
    sessionId: input.sessionId,
  })
    .select("_id status")
    .lean<{ _id: Types.ObjectId; status?: string } | null>();

  const flashcardCount = deck
    ? await LessonFlashcard.countDocuments({
        schoolId: input.schoolId,
        deckId: deck._id,
      })
    : 0;

  let flashcardsStatus: LearnPackageItemStatus = "optional";
  if (!deliveryComplete) {
    flashcardsStatus = "locked";
  } else if (deck?.status === "published" && flashcardCount > 0) {
    flashcardsStatus = "ready";
  } else if (flashcardCount > 0) {
    flashcardsStatus = "needs_action";
  }

  const exploreResult = await getTeacherSessionExploreStatus({
    schoolId: input.schoolId,
    sessionId: input.sessionId,
    classGroupId: classGroupId ? String(classGroupId) : null,
  });
  const explore = exploreResult ?? {
    sessionId: String(input.sessionId),
    adventureId: null,
    generationKey: null,
    status: "not_started" as const,
    title: null,
    introPreview: null,
    estimatedMinutes: null,
    message: "Explore not set up yet.",
  };

  let exploreStatus: LearnPackageItemStatus = "optional";
  if (!deliveryComplete) {
    exploreStatus = "locked";
  } else if (explore.status === "published") {
    exploreStatus = "ready";
  } else if (explore.status === "ready_for_review" || explore.status === "generating") {
    exploreStatus = "needs_action";
  } else if (explore.status === "failed") {
    exploreStatus = "needs_action";
  }

  const assignmentSummary = await linkedAssignmentsSummaryForSession(input.schoolId, input.sessionId);
  let assignmentStatus: LearnPackageItemStatus = "optional";
  if (!deliveryComplete) {
    assignmentStatus = "locked";
  } else if ((assignmentSummary?.published ?? 0) > 0) {
    assignmentStatus = "ready";
  } else if ((assignmentSummary?.total ?? 0) > 0) {
    assignmentStatus = "needs_action";
  }

  const sessionPublished = session.studentVisibility === "published";
  let publishStatus: LearnPackageItemStatus = "needs_action";
  if (!deliveryComplete) {
    publishStatus = "locked";
  } else if (sessionPublished) {
    publishStatus = "ready";
  }

  const items = [
    {
      id: "notebook" as const,
      label: "Notebook notes",
      status: notebookStatus,
      message: itemStatusMessage(
        notebookStatus,
        "Students can review notebook notes in Learn",
        "Publish notebook notes for students",
      ),
      studentVisible: notebookStudentVisible,
    },
    {
      id: "flashcards" as const,
      label: "Flashcards",
      status: flashcardsStatus,
      message: itemStatusMessage(
        flashcardsStatus,
        `${flashcardCount} flashcard${flashcardCount === 1 ? "" : "s"} ready in Learn`,
        "Publish the flashcard deck for this class",
      ),
      studentVisible: flashcardsStatus === "ready",
    },
    {
      id: "explore" as const,
      label: "Explore",
      status: exploreStatus,
      message:
        exploreStatus === "ready"
          ? explore.message
          : exploreStatus === "needs_action"
            ? explore.message
            : itemStatusMessage(exploreStatus, explore.message, explore.message),
      studentVisible: explore.status === "published",
    },
    {
      id: "assignment" as const,
      label: "Assignment",
      status: assignmentStatus,
      message: itemStatusMessage(
        assignmentStatus,
        `${assignmentSummary?.published ?? 0} published task${(assignmentSummary?.published ?? 0) === 1 ? "" : "s"} linked`,
        assignmentSummary?.draft
          ? `${assignmentSummary.draft} draft task${assignmentSummary.draft === 1 ? "" : "s"} need publishing`
          : "Create or publish a linked assignment if you want this step",
      ),
      studentVisible: (assignmentSummary?.published ?? 0) > 0,
    },
    {
      id: "publish" as const,
      label: "Publish to Learn",
      status: publishStatus,
      message: itemStatusMessage(
        publishStatus,
        "Session content is published to students",
        "Publish session content when your class package is ready",
      ),
      studentVisible: sessionPublished,
    },
  ];

  const readyCount = items.filter((item) => item.status === "ready").length;
  const publishReady = notebookStatus === "ready" && sessionPublished;

  const journeySteps: LearnPackageJourneyStep[] = [
    { key: "notebook_notes", label: "Notebook notes", included: true, required: true },
    {
      key: "flashcards",
      label: "Flashcards",
      included: flashcardsStatus === "ready" || flashcardCount > 0,
      required: flashcardsStatus === "ready",
    },
    {
      key: "explore",
      label: "Explore",
      included: explore.status !== "not_started",
      required: false,
    },
    { key: "extra_ai", label: "Leo help", included: true, required: false },
    {
      key: "assignment",
      label: "Assignment",
      included: (assignmentSummary?.total ?? 0) > 0,
      required: assignmentStatus === "ready",
    },
    { key: "reflection", label: "Reflection", included: true, required: true },
  ];

  return {
    sessionId: String(session._id),
    sessionTitle: session.title,
    headline: "After-class Learn package",
    message:
      readyCount >= 3
        ? "Students will see a clear subject journey in EduSentrix Learn."
        : "Finish the checklist below so Leo can build a helpful after-class journey.",
    readyCount,
    totalCount: items.length,
    publishReady,
    learnTeacherPriority: Boolean(session.learnTeacherPriority),
    studentPreviewAvailable: deliveryComplete,
    items,
    journeySteps,
  };
}
