import type { Types } from "mongoose";

/** Shared Explore enums and document shapes (Slice 2). Zod validation added in Slice 3. */

export type ExploreGenerationJobStatus =
  | "pending"
  | "generating"
  | "safety_checking"
  | "repairing"
  | "ready"
  | "failed"
  | "blocked";

export type ExploreGenerationMode =
  | "recommended"
  | "go_deeper"
  | "mistake_buster"
  | "challenge";

export type ExploreAdventureStatus =
  | "ready"
  | "teacher_review_recommended"
  | "teacher_approved"
  | "hidden"
  | "blocked"
  | "reported"
  | "archived";

export type ExploreAdventureReviewStatus =
  | "not_reviewed"
  | "reviewed"
  | "approved"
  | "needs_changes"
  | "rejected";

export type ExploreMissionType =
  | "detective"
  | "field_trip"
  | "story_lab"
  | "maker_challenge"
  | "culture_link"
  | "home_lab"
  | "career_link"
  | "ghana_connection"
  | "future_world"
  | "mistake_buster"
  | "leo_rescue"
  | "parent_challenge";

export type ExploreDifficulty = "easy" | "standard" | "stretch";

export type ExploreAdventureCreatedBy = "leo_ai" | "teacher" | "platform_admin";

export type ExploreSchemaVersion = "explore_adventure_v2";

export type ExploreSafetyResultStatus =
  | "passed"
  | "repaired"
  | "blocked"
  | "teacher_review_required";

export type ExploreVisibleRole =
  | "student"
  | "parent"
  | "class_teacher"
  | "school_admin"
  | "platform_admin";

export type StudentExploreStatus =
  | "not_started"
  | "in_progress"
  | "quiz_submitted"
  | "completed";

export type ExploreReviewAction =
  | "approved"
  | "hidden"
  | "reported"
  | "requested_changes"
  | "marked_safe"
  | "marked_too_hard"
  | "marked_too_easy"
  | "marked_not_relevant";

export type ExploreReviewerRole =
  | "parent"
  | "class_teacher"
  | "school_admin"
  | "platform_admin";

/** Payload stored on ExploreContentSnapshot.content — validated via explore-schemas.ts */
export type { GuidedAdventureContentV2, ExploreAiGenerationOutput } from "@/lib/learn/explore/explore-schemas";

export interface ExploreSourceContext {
  schoolId: string;
  classGroupId: string;
  subjectId: string;
  lessonId: string;
  lessonTitle: string;
  gradeLevel: string;
  curriculum?: string;
  academicYearId?: string;
  termId?: string;
}

/** Approved class lesson text used for Explore prompts (Slice 5). */
export interface ExploreLessonBrief {
  classroomBrief: string;
  planNotes: string;
  topicKeywords: string;
}

/** Resolved student + class + covered lesson context for lazy generation (Slice 5). */
export interface ResolvedExploreGenerationContext {
  studentId: string;
  schoolId: string;
  classGroupId: string;
  gradeId: string | null;
  gradeLevel: string;
  gradeName: string;
  subjectOfferingId: string;
  subjectName: string;
  lessonId: string;
  lessonTitle: string;
  lessonBrief: ExploreLessonBrief;
  sourceContext: ExploreSourceContext;
  generationKey: string;
  curriculum?: string;
  academicYearName?: string;
  termName?: string;
  relatedLessonTitles: string[];
  flashcardHints: Array<{ front: string; back: string }>;
}

export interface ExploreAiMetadata {
  provider: string;
  model: string;
  promptVersion: string;
  generatedBy: "backend_ai";
  generationPromptSummary: string;
  temperature?: number;
}

export interface ExploreSafetyCheck {
  name: string;
  passed: boolean;
  severity: "info" | "warning" | "critical";
  note?: string;
}

export interface ExploreSafetyResult {
  status: ExploreSafetyResultStatus;
  checks: ExploreSafetyCheck[];
  repairAttempts: number;
  finalNotes: string[];
}

export interface ExploreQuizAnswer {
  questionId: string;
  selectedOptionId: string;
  correct: boolean;
}

/** Params for building generationKey (Slice 4). */
export interface ExploreGenerationKeyParams {
  schoolId: Types.ObjectId | string;
  classGroupId: Types.ObjectId | string;
  subjectId: Types.ObjectId | string;
  lessonId: Types.ObjectId | string;
  gradeLevel: string;
  contentVersion?: string;
}

export const EXPLORE_BASE_CONTENT_VERSION = "1";
