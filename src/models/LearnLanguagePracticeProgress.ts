import { Schema, model, models, Types, type Model } from "mongoose";

export interface ILearnLanguagePracticeProgress {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  accountId?: Types.ObjectId | null;
  languageCode: string;
  languageName: string;
  level?: string | null;
  sessionsCompleted: number;
  practiceMinutes: number;
  lastPracticedAt?: Date | null;
  weakAreas?: string[];
  strengths?: string[];
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const learnLanguagePracticeProgressSchema =
  new Schema<ILearnLanguagePracticeProgress>(
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
      languageCode: { type: String, required: true, trim: true, lowercase: true },
      languageName: { type: String, required: true, trim: true },
      level: { type: String, default: null, trim: true },
      sessionsCompleted: { type: Number, default: 0, min: 0 },
      practiceMinutes: { type: Number, default: 0, min: 0 },
      lastPracticedAt: { type: Date, default: null, index: true },
      weakAreas: [{ type: String, trim: true }],
      strengths: [{ type: String, trim: true }],
      metadata: { type: Schema.Types.Mixed, default: null },
    },
    { timestamps: true }
  );

learnLanguagePracticeProgressSchema.index(
  { studentId: 1, languageCode: 1 },
  { unique: true }
);
learnLanguagePracticeProgressSchema.index({ schoolId: 1, lastPracticedAt: -1 });

export const LearnLanguagePracticeProgress: Model<ILearnLanguagePracticeProgress> =
  (models.LearnLanguagePracticeProgress as Model<ILearnLanguagePracticeProgress>) ||
  model<ILearnLanguagePracticeProgress>(
    "LearnLanguagePracticeProgress",
    learnLanguagePracticeProgressSchema
  );
