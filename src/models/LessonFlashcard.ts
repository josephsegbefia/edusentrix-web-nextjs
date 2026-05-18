import { Schema, model, models, type Model, type Types } from "mongoose";

export interface ILessonFlashcard {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  lessonId?: Types.ObjectId | null;
  sessionId?: Types.ObjectId | null;
  deckId: Types.ObjectId;
  front: string;
  back: string;
  hint?: string;
  explanation?: string;
  imageUrl?: string;
  difficulty?: "easy" | "medium" | "hard";
  cardType?: "qa" | "term_definition" | "image_prompt" | "concept_example";
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const lessonFlashcardSchema = new Schema<ILessonFlashcard>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    lessonId: { type: Schema.Types.ObjectId, ref: "Lesson", default: null, index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "LessonSession", default: null, index: true },
    deckId: {
      type: Schema.Types.ObjectId,
      ref: "LessonFlashcardDeck",
      required: true,
      index: true,
    },
    front: { type: String, required: true, trim: true, maxlength: 4000 },
    back: { type: String, required: true, trim: true, maxlength: 4000 },
    hint: { type: String, trim: true, maxlength: 2000 },
    explanation: { type: String, trim: true, maxlength: 4000 },
    imageUrl: { type: String, trim: true, maxlength: 2000 },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
    cardType: {
      type: String,
      enum: ["qa", "term_definition", "image_prompt", "concept_example"],
      default: "qa",
    },
    order: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true }
);

lessonFlashcardSchema.index({ schoolId: 1, deckId: 1, order: 1 });
lessonFlashcardSchema.pre("validate", function validateCardScope(next) {
  const hasLesson = Boolean(this.lessonId);
  const hasSession = Boolean(this.sessionId);
  if (hasLesson === hasSession) {
    next(new Error("Flashcard must reference exactly one of lessonId or sessionId"));
    return;
  }
  next();
});

export const LessonFlashcard: Model<ILessonFlashcard> =
  (models.LessonFlashcard as Model<ILessonFlashcard>) ||
  model<ILessonFlashcard>("LessonFlashcard", lessonFlashcardSchema);
