import { Schema, model, models, type Model, type Types } from "mongoose";

export type FlashcardProgressStatus = "new" | "learning" | "known" | "needs_review";

export interface IStudentFlashcardProgress {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  deckId: Types.ObjectId;
  flashcardId: Types.ObjectId;
  status: FlashcardProgressStatus;
  lastReviewedAt?: Date;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const studentFlashcardProgressSchema = new Schema<IStudentFlashcardProgress>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    deckId: {
      type: Schema.Types.ObjectId,
      ref: "LessonFlashcardDeck",
      required: true,
      index: true,
    },
    flashcardId: {
      type: Schema.Types.ObjectId,
      ref: "LessonFlashcard",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["new", "learning", "known", "needs_review"],
      default: "new",
      index: true,
    },
    lastReviewedAt: { type: Date },
    reviewCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

studentFlashcardProgressSchema.index(
  { schoolId: 1, studentId: 1, flashcardId: 1 },
  { unique: true }
);

studentFlashcardProgressSchema.index({ schoolId: 1, studentId: 1, deckId: 1 });

export const StudentFlashcardProgress: Model<IStudentFlashcardProgress> =
  (models.StudentFlashcardProgress as Model<IStudentFlashcardProgress>) ||
  model<IStudentFlashcardProgress>("StudentFlashcardProgress", studentFlashcardProgressSchema);
