import { Schema, model, models, type Model, type Types } from "mongoose";

export type StudentSessionCompletionStatus = "not_started" | "viewed" | "completed";

export interface IStudentSessionProgress {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;
  studentId: Types.ObjectId;

  viewedAt?: Date;
  completedAt?: Date;
  completionStatus: StudentSessionCompletionStatus;

  lastActivityAt?: Date;
  /** Cumulative opens of the student session page (best-effort; includes duplicate client beacons). */
  viewCount: number;

  createdAt: Date;
  updatedAt: Date;
}

const studentSessionProgressSchema = new Schema<IStudentSessionProgress>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "LessonSession",
      required: true,
      index: true,
    },
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

studentSessionProgressSchema.index({ schoolId: 1, completedAt: 1 });

studentSessionProgressSchema.index(
  { schoolId: 1, studentId: 1, sessionId: 1 },
  { unique: true }
);

export const StudentSessionProgress: Model<IStudentSessionProgress> =
  models.StudentSessionProgress ||
  model<IStudentSessionProgress>("StudentSessionProgress", studentSessionProgressSchema);
