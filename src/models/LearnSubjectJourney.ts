import { Schema, model, models, type Model, type Types } from "mongoose";

export type LearnSubjectJourneyStatus =
  | "locked"
  | "available"
  | "not_started"
  | "in_progress"
  | "completed"
  | "saved_for_later"
  | "moved_to_revision_bank"
  | "expired";

export type LearnJourneyStepKey =
  | "notebook_notes"
  | "flashcards"
  | "explore"
  | "extra_ai"
  | "assignment"
  | "reflection";

export type LearnJourneyStepStatus =
  | "locked"
  | "available"
  | "not_started"
  | "in_progress"
  | "completed"
  | "skipped";

export type LearnJourneyPriorityReason =
  | "taught_today"
  | "started_but_incomplete"
  | "weak_topic"
  | "spaced_repetition"
  | "teacher_priority"
  | "assignment_due"
  | "exam_relevant";

export interface ILearnJourneyStepProgress {
  key: LearnJourneyStepKey;
  status: LearnJourneyStepStatus;
  required: boolean;
  estimatedMinutes: number;
  xpReward: number;
  progressPercent: number;
  startedAt?: Date | null;
  completedAt?: Date | null;
  lastActivityAt?: Date | null;
}

export interface ILearnSubjectJourney {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  accountId?: Types.ObjectId | null;
  classGroupId: Types.ObjectId;
  gradeId?: Types.ObjectId | null;
  academicYearId?: Types.ObjectId | null;
  termId?: Types.ObjectId | null;

  date: string;
  timezone: string;
  boardId?: Types.ObjectId | null;

  lessonSessionId: Types.ObjectId;
  lessonDeliveryId?: Types.ObjectId | null;
  lessonNoteId?: Types.ObjectId | null;
  schemeItemId?: Types.ObjectId | null;
  subjectOfferingId?: Types.ObjectId | null;
  subjectId?: Types.ObjectId | null;

  subjectName: string;
  topicTitle: string;
  teacherId?: Types.ObjectId | null;
  teacherName?: string | null;
  coveredAt: Date;

  status: LearnSubjectJourneyStatus;
  required: boolean;
  displayOrder: number;
  priorityScore: number;
  priorityReason: LearnJourneyPriorityReason;

  steps: ILearnJourneyStepProgress[];

  linkedFlashcardDeckId?: Types.ObjectId | null;
  linkedExploreAdventureId?: Types.ObjectId | null;
  linkedAssignmentIds: Types.ObjectId[];

  completionPercent: number;
  xpEarned: number;
  totalXpAvailable: number;

  masterySignal: {
    confidence: "low" | "medium" | "high" | "unknown";
    lastScorePercent?: number | null;
    weakConcepts: string[];
    misconceptionTags: string[];
    nextReviewAt?: Date | null;
  };

  catchUp: {
    isCatchUp: boolean;
    sourceJourneyId?: Types.ObjectId | null;
    savedAt?: Date | null;
    carryCount: number;
  };

  reflection?: {
    confidence?: "not_yet" | "a_little" | "good" | "very_well" | null;
    studentNote?: string | null;
    submittedAt?: Date | null;
  } | null;

  createdAt: Date;
  updatedAt: Date;
}

const journeyStepSchema = new Schema<ILearnJourneyStepProgress>(
  {
    key: {
      type: String,
      enum: [
        "notebook_notes",
        "flashcards",
        "explore",
        "extra_ai",
        "assignment",
        "reflection",
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ["locked", "available", "not_started", "in_progress", "completed", "skipped"],
      default: "locked",
      required: true,
    },
    required: { type: Boolean, default: true },
    estimatedMinutes: { type: Number, default: 5, min: 0 },
    xpReward: { type: Number, default: 10, min: 0 },
    progressPercent: { type: Number, default: 0, min: 0, max: 100 },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    lastActivityAt: { type: Date, default: null },
  },
  { _id: false }
);

const masterySignalSchema = new Schema<ILearnSubjectJourney["masterySignal"]>(
  {
    confidence: {
      type: String,
      enum: ["low", "medium", "high", "unknown"],
      default: "unknown",
    },
    lastScorePercent: { type: Number, default: null, min: 0, max: 100 },
    weakConcepts: { type: [String], default: [] },
    misconceptionTags: { type: [String], default: [] },
    nextReviewAt: { type: Date, default: null },
  },
  { _id: false }
);

const catchUpSchema = new Schema<ILearnSubjectJourney["catchUp"]>(
  {
    isCatchUp: { type: Boolean, default: false },
    sourceJourneyId: { type: Schema.Types.ObjectId, ref: "LearnSubjectJourney", default: null },
    savedAt: { type: Date, default: null },
    carryCount: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const learnSubjectJourneySchema = new Schema<ILearnSubjectJourney>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    accountId: { type: Schema.Types.ObjectId, ref: "LearnStudentAccount", default: null },
    classGroupId: {
      type: Schema.Types.ObjectId,
      ref: "ClassGroup",
      required: true,
      index: true,
    },
    gradeId: { type: Schema.Types.ObjectId, ref: "Grade", default: null },
    academicYearId: { type: Schema.Types.ObjectId, ref: "AcademicPeriod", default: null },
    termId: { type: Schema.Types.ObjectId, ref: "AcademicPeriod", default: null },

    date: { type: String, required: true, trim: true, index: true },
    timezone: { type: String, default: "Africa/Accra", trim: true },
    boardId: { type: Schema.Types.ObjectId, ref: "DailyQuestBoard", default: null },

    lessonSessionId: {
      type: Schema.Types.ObjectId,
      ref: "LessonSession",
      required: true,
      index: true,
    },
    lessonDeliveryId: { type: Schema.Types.ObjectId, ref: "LessonDelivery", default: null },
    lessonNoteId: { type: Schema.Types.ObjectId, ref: "LessonNote", default: null },
    schemeItemId: { type: Schema.Types.ObjectId, default: null },
    subjectOfferingId: { type: Schema.Types.ObjectId, ref: "SubjectOffering", default: null },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", default: null },

    subjectName: { type: String, required: true, trim: true, maxlength: 120 },
    topicTitle: { type: String, required: true, trim: true, maxlength: 200 },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", default: null },
    teacherName: { type: String, trim: true, maxlength: 120, default: null },
    coveredAt: { type: Date, required: true },

    status: {
      type: String,
      enum: [
        "locked",
        "available",
        "not_started",
        "in_progress",
        "completed",
        "saved_for_later",
        "moved_to_revision_bank",
        "expired",
      ],
      default: "available",
      index: true,
    },
    required: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0, min: 0 },
    priorityScore: { type: Number, default: 0, min: 0 },
    priorityReason: {
      type: String,
      enum: [
        "taught_today",
        "started_but_incomplete",
        "weak_topic",
        "spaced_repetition",
        "teacher_priority",
        "assignment_due",
        "exam_relevant",
      ],
      default: "taught_today",
    },

    steps: { type: [journeyStepSchema], default: [] },

    linkedFlashcardDeckId: {
      type: Schema.Types.ObjectId,
      ref: "LessonFlashcardDeck",
      default: null,
    },
    linkedExploreAdventureId: {
      type: Schema.Types.ObjectId,
      ref: "ExploreAdventure",
      default: null,
    },
    linkedAssignmentIds: [{ type: Schema.Types.ObjectId, ref: "Homework" }],

    completionPercent: { type: Number, default: 0, min: 0, max: 100 },
    xpEarned: { type: Number, default: 0, min: 0 },
    totalXpAvailable: { type: Number, default: 0, min: 0 },

    masterySignal: { type: masterySignalSchema, default: () => ({}) },
    catchUp: { type: catchUpSchema, default: () => ({ isCatchUp: false, carryCount: 0 }) },
    reflection: {
      confidence: {
        type: String,
        enum: ["not_yet", "a_little", "good", "very_well", null],
        default: null,
      },
      studentNote: { type: String, trim: true, maxlength: 500, default: null },
      submittedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

learnSubjectJourneySchema.index({ schoolId: 1, studentId: 1, date: 1 });
learnSubjectJourneySchema.index({ schoolId: 1, classGroupId: 1, date: 1 });
learnSubjectJourneySchema.index(
  { schoolId: 1, studentId: 1, lessonSessionId: 1, date: 1 },
  { unique: true }
);
learnSubjectJourneySchema.index({ studentId: 1, status: 1, updatedAt: -1 });
learnSubjectJourneySchema.index({ studentId: 1, "catchUp.isCatchUp": 1, status: 1 });

export const LearnSubjectJourney =
  (models.LearnSubjectJourney as Model<ILearnSubjectJourney> | undefined) ??
  model<ILearnSubjectJourney>("LearnSubjectJourney", learnSubjectJourneySchema);
