import { Schema, model, models, Types, type Model } from "mongoose";
import type { ExamTimetableVersionStatus } from "@/types/academics/exam-scheduling-engine";
import { EXAM_TIMETABLE_VERSION_STATUSES } from "@/constants/academics/exam-scheduling-engine";

export interface IExamTimetableVersionSnapshot {
  session: Record<string, unknown>;
  entries: Record<string, unknown>[];
  invigilators: Record<string, unknown>[];
  venues: Record<string, unknown>[];
}

export interface IExamTimetableVersion {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  examSessionId: Types.ObjectId;
  versionNumber: number;
  status: ExamTimetableVersionStatus;
  changeSummary: string;
  snapshot: IExamTimetableVersionSnapshot;
  publishedBy: Types.ObjectId;
  publishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const examTimetableVersionSnapshotSchema = new Schema<IExamTimetableVersionSnapshot>(
  {
    session: { type: Schema.Types.Mixed, required: true },
    entries: { type: [Schema.Types.Mixed], default: [] },
    invigilators: { type: [Schema.Types.Mixed], default: [] },
    venues: { type: [Schema.Types.Mixed], default: [] },
  },
  { _id: false }
);

const examTimetableVersionSchema = new Schema<IExamTimetableVersion>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    examSessionId: {
      type: Schema.Types.ObjectId,
      ref: "ExamSession",
      required: true,
      index: true,
    },
    versionNumber: { type: Number, required: true, min: 1, index: true },
    status: {
      type: String,
      enum: [...EXAM_TIMETABLE_VERSION_STATUSES],
      required: true,
      default: "published",
      index: true,
    },
    changeSummary: { type: String, required: true, trim: true, maxlength: 2000 },
    snapshot: { type: examTimetableVersionSnapshotSchema, required: true },
    publishedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    publishedAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

examTimetableVersionSchema.index(
  { schoolId: 1, examSessionId: 1, versionNumber: 1 },
  { name: "exam_timetable_version_by_session_number", unique: true }
);

examTimetableVersionSchema.index(
  { schoolId: 1, examSessionId: 1, status: 1 },
  { name: "exam_timetable_version_by_session_status" }
);

export const ExamTimetableVersion: Model<IExamTimetableVersion> =
  (models.ExamTimetableVersion as Model<IExamTimetableVersion>) ||
  model<IExamTimetableVersion>("ExamTimetableVersion", examTimetableVersionSchema);
