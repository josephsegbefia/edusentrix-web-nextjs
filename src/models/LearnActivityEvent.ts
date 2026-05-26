import { Schema, model, models, Types, type Model } from "mongoose";

export type LearnActivityEventType =
  | "quest_completed"
  | "leo_tutor_message"
  | "flashcard_reviewed"
  | "revision_session"
  | "exam_prep_practice"
  | "explore_with_leo"
  | "language_practice"
  | "assignment_help"
  | "login";

export interface ILearnActivityEvent {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  accountId?: Types.ObjectId | null;
  gradeId?: Types.ObjectId | null;
  classGroupId?: Types.ObjectId | null;
  subjectOfferingId?: Types.ObjectId | null;
  subjectId?: Types.ObjectId | null;
  eventType: LearnActivityEventType;
  occurredAt: Date;
  durationSeconds?: number | null;
  score?: number | null;
  topic?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const learnActivityEventSchema = new Schema<ILearnActivityEvent>(
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
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "LearnStudentAccount",
      default: null,
      index: true,
    },
    gradeId: { type: Schema.Types.ObjectId, ref: "Grade", default: null, index: true },
    classGroupId: {
      type: Schema.Types.ObjectId,
      ref: "ClassGroup",
      default: null,
      index: true,
    },
    subjectOfferingId: {
      type: Schema.Types.ObjectId,
      ref: "SubjectOffering",
      default: null,
      index: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      default: null,
      index: true,
    },
    eventType: {
      type: String,
      enum: [
        "quest_completed",
        "leo_tutor_message",
        "flashcard_reviewed",
        "revision_session",
        "exam_prep_practice",
        "explore_with_leo",
        "language_practice",
        "assignment_help",
        "login",
      ],
      required: true,
      index: true,
    },
    occurredAt: { type: Date, required: true, default: () => new Date(), index: true },
    durationSeconds: { type: Number, default: null, min: 0 },
    score: { type: Number, default: null },
    topic: { type: String, default: null, trim: true },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

learnActivityEventSchema.index({ schoolId: 1, occurredAt: -1 });
learnActivityEventSchema.index({ classGroupId: 1, occurredAt: -1 });
learnActivityEventSchema.index({ studentId: 1, occurredAt: -1 });

export const LearnActivityEvent: Model<ILearnActivityEvent> =
  (models.LearnActivityEvent as Model<ILearnActivityEvent>) ||
  model<ILearnActivityEvent>("LearnActivityEvent", learnActivityEventSchema);
