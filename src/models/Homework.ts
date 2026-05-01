import { Schema, model, models, Types, type Model } from "mongoose";

export type HomeworkType = "assignment" | "quiz" | "project" | "practice";
export type HomeworkStatus = "draft" | "published" | "closed" | "archived";
export type LatePolicy = "accept" | "reject" | "penalize";

export interface IHomeworkQuestionChoice {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface IHomeworkQuestion {
  id: string;
  prompt: string;
  points: number;
  explanation?: string;
  choices: IHomeworkQuestionChoice[];
}

export interface IHomework {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  subjectId: Types.ObjectId;
  /** Optional V2 linkage: assignment/quiz generated from a specific lesson instance. */
  sourceLessonId?: Types.ObjectId;
  classGroupIds: Types.ObjectId[];
  targetStudentIds?: Types.ObjectId[];
  title: string;
  instructions: string;
  type: HomeworkType;
  dueDate: Date;
  latePolicy: LatePolicy;
  latePenaltyPercent?: number;
  maxScore: number;
  quizTimeLimitMinutes?: number | null;
  rubricId?: Types.ObjectId;
  weight?: number;
  attachments: Array<{
    name: string;
    url: string;
    type: "pdf" | "image" | "video" | "audio" | "link";
    size?: number;
  }>;
  questions: IHomeworkQuestion[];
  status: HomeworkStatus;
  publishedAt?: Date;
  closedAt?: Date;
  submissionCount?: number;
  gradedCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const AttachmentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["pdf", "image", "video", "audio", "link"],
      required: true,
    },
    size: { type: Number, min: 0 },
  },
  { _id: false }
);

const QuestionChoiceSchema = new Schema<IHomeworkQuestionChoice>(
  {
    id: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true },
    isCorrect: { type: Boolean, default: false },
  },
  { _id: false }
);

const QuestionSchema = new Schema<IHomeworkQuestion>(
  {
    id: { type: String, required: true, trim: true },
    prompt: { type: String, required: true, trim: true },
    points: { type: Number, required: true, min: 0, default: 1 },
    explanation: { type: String, trim: true },
    choices: { type: [QuestionChoiceSchema], default: [] },
  },
  { _id: false }
);

const homeworkSchema = new Schema<IHomework>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },
    academicPeriodId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      required: true,
      index: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },
    sourceLessonId: {
      type: Schema.Types.ObjectId,
      ref: "Lesson",
      index: true,
    },
    classGroupIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "ClassGroup",
        required: true,
        index: true,
      },
    ],
    targetStudentIds: [{ type: Schema.Types.ObjectId, ref: "Student" }],
    title: { type: String, required: true, trim: true },
    instructions: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["assignment", "quiz", "project", "practice"],
      required: true,
      index: true,
    },
    dueDate: { type: Date, required: true, index: true },
    latePolicy: {
      type: String,
      enum: ["accept", "reject", "penalize"],
      default: "accept",
    },
    latePenaltyPercent: { type: Number, min: 0, max: 100 },
    maxScore: { type: Number, required: true, min: 0 },
    quizTimeLimitMinutes: { type: Number, min: 1, max: 300, default: null },
    rubricId: { type: Schema.Types.ObjectId, ref: "Rubric" },
    weight: { type: Number, min: 0, max: 100 },
    attachments: { type: [AttachmentSchema], default: [] },
    questions: { type: [QuestionSchema], default: [] },
    status: {
      type: String,
      enum: ["draft", "published", "closed", "archived"],
      default: "draft",
      index: true,
    },
    publishedAt: { type: Date },
    closedAt: { type: Date },
    submissionCount: { type: Number, default: 0 },
    gradedCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

homeworkSchema.index({ schoolId: 1, teacherId: 1, status: 1, createdAt: -1 });
homeworkSchema.index({ schoolId: 1, classGroupIds: 1, status: 1, dueDate: 1 });
homeworkSchema.index({ schoolId: 1, sourceLessonId: 1, type: 1, createdAt: -1 });

const existingHomeworkModel = models.Homework as Model<IHomework> | undefined;
if (
  existingHomeworkModel &&
  (!existingHomeworkModel.schema.path("questions") ||
    !existingHomeworkModel.schema.path("quizTimeLimitMinutes"))
) {
  delete models.Homework;
}

export const Homework =
  (models.Homework as Model<IHomework> | undefined) ||
  model<IHomework>("Homework", homeworkSchema);
