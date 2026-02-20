import { Schema, model, models, Types, type Model } from "mongoose";

export type SubmissionStatus =
  | "not_started"
  | "draft"
  | "submitted"
  | "late"
  | "returned"
  | "graded";

export interface ISubmission {
  _id: Types.ObjectId;
  homeworkId: Types.ObjectId;
  studentId: Types.ObjectId;
  schoolId: Types.ObjectId;
  content?: string;
  attachments: Array<{
    name: string;
    url: string;
    type: string;
    size?: number;
  }>;
  questionResponses: Array<{
    questionId: string;
    selectedChoiceId: string | null;
    isCorrect?: boolean;
    pointsAwarded?: number;
  }>;
  status: SubmissionStatus;
  submittedAt?: Date;
  quizStartedAt?: Date;
  quizExpiresAt?: Date;
  autoSubmittedAt?: Date;
  isLate?: boolean;
  score?: number;
  feedback?: string;
  rubricScores?: Record<string, number>;
  gradedBy?: Types.ObjectId;
  gradedAt?: Date;
  publishedAt?: Date;
  returnedAt?: Date;
  returnReason?: string;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

const AttachmentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    size: { type: Number, min: 0 },
  },
  { _id: false }
);

const QuestionResponseSchema = new Schema(
  {
    questionId: { type: String, required: true, trim: true },
    selectedChoiceId: { type: String, default: null, trim: true },
    isCorrect: { type: Boolean },
    pointsAwarded: { type: Number, min: 0 },
  },
  { _id: false }
);

const submissionSchema = new Schema<ISubmission>(
  {
    homeworkId: {
      type: Schema.Types.ObjectId,
      ref: "Homework",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    content: { type: String, trim: true },
    attachments: { type: [AttachmentSchema], default: [] },
    questionResponses: { type: [QuestionResponseSchema], default: [] },
    status: {
      type: String,
      enum: [
        "not_started",
        "draft",
        "submitted",
        "late",
        "returned",
        "graded",
      ],
      default: "not_started",
      index: true,
    },
    submittedAt: { type: Date },
    quizStartedAt: { type: Date },
    quizExpiresAt: { type: Date },
    autoSubmittedAt: { type: Date },
    isLate: { type: Boolean, default: false },
    score: { type: Number, min: 0 },
    feedback: { type: String, trim: true },
    rubricScores: { type: Schema.Types.Mixed },
    gradedBy: { type: Schema.Types.ObjectId, ref: "User" },
    gradedAt: { type: Date },
    publishedAt: { type: Date },
    returnedAt: { type: Date },
    returnReason: { type: String, trim: true },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

submissionSchema.index({ homeworkId: 1, studentId: 1 }, { unique: true });
submissionSchema.index({ homeworkId: 1, status: 1 });
submissionSchema.index({ schoolId: 1, studentId: 1, status: 1 });

const existingSubmissionModel = models.Submission as Model<ISubmission> | undefined;
if (
  existingSubmissionModel &&
  (!existingSubmissionModel.schema.path("questionResponses") ||
    !existingSubmissionModel.schema.path("quizExpiresAt"))
) {
  delete models.Submission;
}

export const Submission =
  (models.Submission as Model<ISubmission> | undefined) ||
  model<ISubmission>("Submission", submissionSchema);
