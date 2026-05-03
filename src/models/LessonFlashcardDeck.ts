import { Schema, model, models, type Model, type Types } from "mongoose";

/** One deck per lesson (MVP). */
export interface ILessonFlashcardDeck {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  lessonId: Types.ObjectId;
  teacherId: Types.ObjectId;
  title: string;
  description?: string;
  status: "draft" | "published" | "archived";
  publishToClassGroupIds: Types.ObjectId[];
  availableFrom?: Date;
  availableUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const lessonFlashcardDeckSchema = new Schema<ILessonFlashcardDeck>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    lessonId: {
      type: Schema.Types.ObjectId,
      ref: "Lesson",
      required: true,
      index: true,
    },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true, index: true },
    title: { type: String, default: "Flashcards", trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000 },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },
    publishToClassGroupIds: [{ type: Schema.Types.ObjectId, ref: "ClassGroup", index: true }],
    availableFrom: { type: Date },
    availableUntil: { type: Date },
  },
  { timestamps: true }
);

lessonFlashcardDeckSchema.index({ schoolId: 1, lessonId: 1, status: 1 });

export const LessonFlashcardDeck: Model<ILessonFlashcardDeck> =
  (models.LessonFlashcardDeck as Model<ILessonFlashcardDeck>) ||
  model<ILessonFlashcardDeck>("LessonFlashcardDeck", lessonFlashcardDeckSchema);
