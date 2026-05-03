import "server-only";

import mongoose from "mongoose";
import { Lesson, type ILesson } from "@/models/Lesson";
import { LessonNote, type ILessonNote } from "@/models/LessonNote";
import { LessonResource } from "@/models/LessonResource";
import { LessonFlashcard } from "@/models/LessonFlashcard";
import { LessonFlashcardDeck } from "@/models/LessonFlashcardDeck";
import { buildPublishedSnapshotFromLessonNote } from "@/lib/lessons/published-snapshot";
import type { LessonsModuleSettings } from "@/lib/lessons/settings";
import { normalizeSafeExternalUrl, sanitizeLessonHtml } from "@/lib/lessons/content-safety";

export type LessonPublishChecklistItem = {
  key: string;
  label: string;
  status: "passed" | "warning" | "failed";
  message?: string;
};

export type LessonPublishChecklistResult = {
  canPublish: boolean;
  items: LessonPublishChecklistItem[];
  lesson: ILesson | null;
  sourceNote: ILessonNote | null;
};

function item(
  key: string,
  label: string,
  status: LessonPublishChecklistItem["status"],
  message?: string
): LessonPublishChecklistItem {
  return { key, label, status, ...(message ? { message } : {}) };
}

export async function buildLessonPublishChecklist(input: {
  schoolId: mongoose.Types.ObjectId;
  lessonId: mongoose.Types.ObjectId;
  settings: LessonsModuleSettings;
}): Promise<LessonPublishChecklistResult> {
  const items: LessonPublishChecklistItem[] = [];
  const lesson = (await Lesson.findOne({
    _id: input.lessonId,
    schoolId: input.schoolId,
  }).lean()) as ILesson | null;

  if (!lesson) {
    items.push(item("lesson_exists", "Lesson exists", "failed", "Lesson was not found."));
    return { canPublish: false, items, lesson: null, sourceNote: null };
  }
  items.push(item("lesson_exists", "Lesson exists", "passed"));

  const sourceNote = (await LessonNote.findOne({
    _id: lesson.lessonNoteId,
    schoolId: input.schoolId,
  }).lean()) as ILessonNote | null;
  if (!sourceNote) {
    items.push(item("source_note", "Source Lesson Note exists", "failed", "The source Lesson Note is missing."));
  } else {
    items.push(item("source_note", "Source Lesson Note exists", "passed"));
  }

  if (lesson.teacherId && lesson.classGroupId && lesson.subjectId) {
    items.push(item("context", "Teacher, class, and subject are set", "passed"));
  } else {
    items.push(item("context", "Teacher, class, and subject are set", "failed", "Lesson needs teacher, class, and subject context."));
  }

  if (input.settings.requireApprovedLessonNoteToPublish && sourceNote?.status !== "approved") {
    items.push(
      item(
        "lesson_note_approved",
        "Source Lesson Note is approved",
        "failed",
        "This school requires approved Lesson Notes before publishing lessons."
      )
    );
  } else {
    items.push(item("lesson_note_approved", "Source Lesson Note approval rule", "passed"));
  }

  const snapshot = lesson.publishedSnapshot ?? (sourceNote ? buildPublishedSnapshotFromLessonNote(sourceNote) : null);
  const hasStudentContent =
    Boolean(sanitizeLessonHtml(lesson.studentContent?.summaryHtml).trim()) ||
    Boolean(lesson.studentContent?.keyPoints?.length) ||
    Boolean(lesson.studentContent?.studentInstructions?.trim()) ||
    Boolean(snapshot);
  items.push(
    hasStudentContent
      ? item("student_content", "Student-facing content is available", "passed")
      : item("student_content", "Student-facing content is available", "failed", "Add student content or publishable Lesson Note content.")
  );

  if (
    input.settings.requireTeacherReviewForAiContent &&
    lesson.studentContent?.aiGenerated &&
    !lesson.studentContent?.teacherReviewed
  ) {
    items.push(
      item(
        "ai_reviewed",
        "AI content reviewed",
        "failed",
        "AI-generated student content must be reviewed before publishing."
      )
    );
  } else {
    items.push(item("ai_reviewed", "AI content reviewed", "passed"));
  }

  const publicResources = await LessonResource.find({
    schoolId: input.schoolId,
    lessonId: input.lessonId,
    visibility: { $in: ["students", "students_and_parents"] },
  })
    .select("kind url fileUrl")
    .lean();
  const unsafeResource = publicResources.find((resource) => {
    if (resource.kind === "link") return !normalizeSafeExternalUrl(resource.url ?? "");
    if (resource.kind === "file") return !normalizeSafeExternalUrl(resource.fileUrl ?? "");
    return false;
  });
  items.push(
    unsafeResource
      ? item("resources_safe", "Student-visible resources are safe", "failed", "A student-visible resource has an unsafe or invalid URL.")
      : item("resources_safe", "Student-visible resources are safe", publicResources.length ? "passed" : "warning", "No student-visible resources attached.")
  );

  const publishedDeckIds = await LessonFlashcardDeck.find({
    schoolId: input.schoolId,
    lessonId: input.lessonId,
    status: "published",
  }).distinct("_id");
  if (publishedDeckIds.length) {
    const validCardCount = await LessonFlashcard.countDocuments({
      schoolId: input.schoolId,
      deckId: { $in: publishedDeckIds },
      front: { $type: "string", $ne: "" },
      back: { $type: "string", $ne: "" },
    });
    items.push(
      validCardCount > 0
        ? item("flashcards_valid", "Published flashcard decks have cards", "passed")
        : item("flashcards_valid", "Published flashcard decks have cards", "failed", "Published decks need at least one card.")
    );
  } else {
    items.push(item("flashcards_valid", "Published flashcard decks have cards", "warning", "No published flashcard decks yet."));
  }

  return {
    canPublish: !items.some((row) => row.status === "failed"),
    items,
    lesson,
    sourceNote,
  };
}
