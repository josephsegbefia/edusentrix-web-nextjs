import { Schema, model, models, type Model, type Types } from "mongoose";

export type StudentLessonCompletionStatus = "not_started" | "viewed" | "completed";

export interface IStudentLessonProgress {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  lessonId: Types.ObjectId;
  studentId: Types.ObjectId;

  viewedAt?: Date;
  completedAt?: Date;
  completionStatus: StudentLessonCompletionStatus;

  lastActivityAt?: Date;
  /** Cumulative opens of the student lesson page (best-effort; incl. duplicate client beacons). */
  viewCount: number;

  createdAt: Date;
  updatedAt: Date;
}

const studentLessonProgressSchema = new Schema<IStudentLessonProgress>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    lessonId: { type: Schema.Types.ObjectId, ref: "Lesson", required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },

    viewedAt: { type: Date },
    completedAt: { type: Date },
    completionStatus: {
      type: String,
      enum: ["not_started", "viewed", "completed"],
      default: "not_started",
      index: true,
    },

    lastActivityAt: { type: Date, index: true },
    viewCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

studentLessonProgressSchema.index({ schoolId: 1, completedAt: 1 });

studentLessonProgressSchema.index(
  { schoolId: 1, studentId: 1, lessonId: 1 },
  { unique: true }
);

export const StudentLessonProgress: Model<IStudentLessonProgress> =
  models.StudentLessonProgress ||
  model<IStudentLessonProgress>("StudentLessonProgress", studentLessonProgressSchema);
