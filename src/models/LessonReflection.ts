import { Schema, model, models, type Model, type Types } from "mongoose";

export type LessonObjectivesMet = "yes" | "partially" | "no";

export interface ILessonReflection {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  lessonId: Types.ObjectId;
  teacherId: Types.ObjectId;

  completed: boolean;
  objectivesMet: LessonObjectivesMet;
  notes?: string;

  /** Free-text identifiers (e.g. names) or future student ids — max length per entry enforced in API. */
  studentsWhoStruggled: string[];

  followUpRequired: boolean;
  followUpNotes?: string;

  nextStep?: string;

  createdAt: Date;
  updatedAt: Date;
}

const lessonReflectionSchema = new Schema<ILessonReflection>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    lessonId: { type: Schema.Types.ObjectId, ref: "Lesson", required: true, index: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true, index: true },

    completed: { type: Boolean, default: false, index: true },
    objectivesMet: {
      type: String,
      enum: ["yes", "partially", "no"],
      default: "partially",
    },
    notes: { type: String, trim: true, maxlength: 8000 },

    studentsWhoStruggled: {
      type: [String],
      default: [],
      validate: {
        validator: (v: string[]) => v.length <= 60,
        message: "At most 60 entries",
      },
    },

    followUpRequired: { type: Boolean, default: false },
    followUpNotes: { type: String, trim: true, maxlength: 4000 },

    nextStep: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

lessonReflectionSchema.index({ schoolId: 1, lessonId: 1 }, { unique: true });

export const LessonReflection: Model<ILessonReflection> =
  (models.LessonReflection as Model<ILessonReflection>) ||
  model<ILessonReflection>("LessonReflection", lessonReflectionSchema);
