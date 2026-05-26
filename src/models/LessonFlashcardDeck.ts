import { Schema, model, models, type Model, type Types } from "mongoose";

/** One class deck per legacy lesson or v2 session; optional per-student Leo deck on same session. */
export interface ILessonFlashcardDeck {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  lessonId?: Types.ObjectId | null;
  sessionId?: Types.ObjectId | null;
  teacherId: Types.ObjectId;
  /** When set, this deck is personal Leo-generated revision for one student (same session). */
  generatedForStudentId?: Types.ObjectId | null;
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
      default: null,
      index: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "LessonSession",
      default: null,
      index: true,
    },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true, index: true },
    generatedForStudentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      default: null,
      index: true,
    },
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
/** One legacy lesson deck per school (session decks keep lessonId unset/null). */
lessonFlashcardDeckSchema.index(
  { schoolId: 1, lessonId: 1 },
  {
    unique: true,
    partialFilterExpression: { lessonId: { $type: "objectId" } },
  }
);
/**
 * One deck per session scope: generatedForStudentId null = class deck,
 * ObjectId = per-student Leo deck.
 */
lessonFlashcardDeckSchema.index(
  { schoolId: 1, sessionId: 1, generatedForStudentId: 1 },
  {
    unique: true,
    partialFilterExpression: { sessionId: { $type: "objectId" } },
  }
);
lessonFlashcardDeckSchema.pre("validate", function validateDeckScope(next) {
  const hasLesson = Boolean(this.lessonId);
  const hasSession = Boolean(this.sessionId);
  if (hasLesson === hasSession) {
    next(new Error("Flashcard deck must reference exactly one of lessonId or sessionId"));
    return;
  }
  next();
});

export const LessonFlashcardDeck: Model<ILessonFlashcardDeck> =
  (models.LessonFlashcardDeck as Model<ILessonFlashcardDeck>) ||
  model<ILessonFlashcardDeck>("LessonFlashcardDeck", lessonFlashcardDeckSchema);
