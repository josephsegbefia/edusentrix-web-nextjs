import { Schema, model, models, type Model, type Types } from "mongoose";

export interface ILessonFlashcard {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  lessonId: Types.ObjectId;
  deckId: Types.ObjectId;
  front: string;
  back: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const lessonFlashcardSchema = new Schema<ILessonFlashcard>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    lessonId: { type: Schema.Types.ObjectId, ref: "Lesson", required: true, index: true },
    deckId: {
      type: Schema.Types.ObjectId,
      ref: "LessonFlashcardDeck",
      required: true,
      index: true,
    },
    front: { type: String, required: true, trim: true, maxlength: 4000 },
    back: { type: String, required: true, trim: true, maxlength: 4000 },
    order: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true }
);

lessonFlashcardSchema.index({ schoolId: 1, deckId: 1, order: 1 });

export const LessonFlashcard: Model<ILessonFlashcard> =
  (models.LessonFlashcard as Model<ILessonFlashcard>) ||
  model<ILessonFlashcard>("LessonFlashcard", lessonFlashcardSchema);
