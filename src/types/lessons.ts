import type { LessonNoteDetail } from "@/types/lesson-notes";
import type { StudentLessonCompletionStatus } from "@/models/StudentLessonProgress";

/**
 * Student-facing lessons (delivery layer) — API shapes for teacher UI.
 */

export type LessonDeliveryStatus = "draft" | "published" | "archived";

export const LESSON_STATUS_LABELS: Record<LessonDeliveryStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export const LESSON_STATUS_COLORS: Record<LessonDeliveryStatus, string> = {
  draft: "bg-amber-500/20 text-amber-200",
  published: "bg-emerald-500/20 text-emerald-200",
  archived: "bg-white/10 text-white/70",
};

export type LessonTeachingSegmentDto = {
  title: string;
  durationMinutes: number | null;
  teacherPrompt: string | null;
  learnerActivity: string | null;
  notes: string | null;
};

export type LessonTeachingModeDto = {
  segments: LessonTeachingSegmentDto[];
};

export interface TeacherLessonRow {
  id: string;
  schoolId: string;
  teacherId: string;
  lessonNoteId: string;
  lessonNoteTopic: string | null;
  classGroupId: string;
  subjectId: string | null;
  academicPeriodId: string | null;
  title: string;
  scheduledAt: string | null;
  status: LessonDeliveryStatus;
  publishedAt: string | null;
  /** Present after publish; instructional frozen copy for students. */
  publishedSnapshot: unknown | null;
  /** Teacher delivery plan (optional). */
  teachingMode: LessonTeachingModeDto | null;
  /** Set on detail GET — class label for display. */
  classDisplayLabel?: string | null;
  subjectName?: string | null;
  /** Present when `includeDisplayNote=1` and `publishedSnapshot` exists. */
  displayNote?: LessonNoteDetail | null;
  /** HTML authored by teacher; parents may see it when the school enables summaries in Settings → Features. */
  parentSummaryHtml?: string | null;
  collaboratorTeacherIds?: string[];
  /** Optional curriculum alignment (copied from lesson note or set on lesson). */
  schemeId?: string | null;
  schemeItemIds?: string[];
  collaboration?: {
    role: "owner" | "collaborator";
    collaborators: Array<{
      teacherId: string;
      userId: string;
      name: string;
    }>;
  };
  /** School-wide flag: are parent-facing lesson summaries enabled for guardians? */
  parentSummaryVisibleToParents?: boolean;
  /**
   * Detail GET only: assignment/quiz items created from this lesson via sourceLessonId link.
   * Null when none exist or when caller lacks assignments-view permissions.
   */
  linkedAssignmentsSummary?: {
    total: number;
    published: number;
    draft: number;
    quizCount: number;
    assignmentCount: number;
  } | null;
  createdAt: string | null;
  updatedAt: string | null;
  /**
   * Detail GET only (published/archived): active students in class vs those who self-reported “studied”.
   * Omitted or null for drafts.
   */
  studentCompletionSnapshot?: {
    classActiveStudentsTotal: number;
    studiedCount: number;
    studiedPercent: number | null;
  } | null;
  /**
   * List GET only (published/archived): batched self-reported studied counts vs class roster.
   * `null` for drafts.
   */
  studentStudiedSummary?: {
    studiedCount: number;
    classActiveStudentsTotal: number;
    studiedPercent: number | null;
  } | null;
}

export interface TeacherLessonsListResponse {
  success: boolean;
  data: { entries: TeacherLessonRow[] };
  error?: string;
}

export interface TeacherLessonDetailResponse {
  success: boolean;
  data: TeacherLessonRow;
  error?: string;
}

export interface LessonCollaborationCommentRow {
  id: string;
  lessonId: string;
  comment: string;
  status: "open" | "resolved";
  authorTeacherId: string;
  authorName: string;
  resolvedAt: string | null;
  resolvedByTeacherId: string | null;
  resolvedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LessonCollaborationCommentsResponse {
  success: boolean;
  data: {
    comments: LessonCollaborationCommentRow[];
  };
  error?: string;
}

export type TeacherLessonsFilters = {
  lessonNoteId?: string;
  limit?: number;
};

// —— Student API (read-only published lessons for learner's class) ——

export interface StudentLessonListItem {
  id: string;
  title: string;
  subjectName: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  /** Present when the student has marked this published lesson as studied. */
  studied?: boolean;
}

export interface StudentLessonsListResponse {
  success: boolean;
  data: {
    lessons: StudentLessonListItem[];
    /** All published lessons for the student's class (not capped by list limit). */
    progress: {
      publishedLessonsTotal: number;
      studiedLessonsCount: number;
      studiedPercent: number | null;
      /** V2 revision analytics (flashcard mastery + short-term activity). */
      revision?: {
        flashcardsTrackedTotal: number;
        flashcardsKnownCount: number;
        flashcardsNeedsReviewCount: number;
        flashcardsLearningCount: number;
        flashcardsNewCount: number;
        reviewedFlashcardsCount: number;
        reviewEventsTotal: number;
        recentCompletionStreakDays: number;
        completedLessonsInLast7Days: number;
      };
    };
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  };
  error?: string;
}

export interface StudentLessonDetailResponse {
  success: boolean;
  data: {
    lesson: {
      id: string;
      title: string;
      publishedAt: string | null;
      scheduledAt: string | null;
    };
    displayNote: LessonNoteDetail;
    /** Present when the student row exists in `StudentLessonProgress`. */
    progress: {
      completionStatus: StudentLessonCompletionStatus;
      completedAt: string | null;
      viewedAt: string | null;
    } | null;
  };
  error?: string;
}
