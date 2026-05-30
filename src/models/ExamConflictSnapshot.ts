import { Schema, model, models, Types, type Model } from "mongoose";
import type {
  ExamConflictSeverity,
  ExamConflictSnapshotStatus,
  ExamConflictType,
} from "@/types/academics/exam-scheduling-engine";
import {
  EXAM_CONFLICT_SEVERITIES,
  EXAM_CONFLICT_SNAPSHOT_STATUSES,
  EXAM_CONFLICT_TYPES,
} from "@/constants/academics/exam-scheduling-engine";

export interface IExamConflictSnapshotConflict {
  key: string;
  type: ExamConflictType;
  severity: ExamConflictSeverity;
  message: string;
  affectedEntryIds: Types.ObjectId[];
  affectedTeacherIds: Types.ObjectId[];
  affectedClassGroupIds: Types.ObjectId[];
  affectedVenueIds: Types.ObjectId[];
  suggestion?: string | null;
  canOverride: boolean;
  overriddenBy?: Types.ObjectId | null;
  overrideReason?: string | null;
  overriddenAt?: Date | null;
}

export interface IExamConflictSnapshot {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  examSessionId: Types.ObjectId;
  generatedAt: Date;
  generatedBy?: Types.ObjectId | null;
  status: ExamConflictSnapshotStatus;
  conflicts: IExamConflictSnapshotConflict[];
  createdAt: Date;
  updatedAt: Date;
}

const examConflictSnapshotConflictSchema = new Schema<IExamConflictSnapshotConflict>(
  {
    key: { type: String, required: true, trim: true },
    type: { type: String, enum: [...EXAM_CONFLICT_TYPES], required: true },
    severity: { type: String, enum: [...EXAM_CONFLICT_SEVERITIES], required: true },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    affectedEntryIds: { type: [Schema.Types.ObjectId], default: [] },
    affectedTeacherIds: { type: [Schema.Types.ObjectId], default: [] },
    affectedClassGroupIds: { type: [Schema.Types.ObjectId], default: [] },
    affectedVenueIds: { type: [Schema.Types.ObjectId], default: [] },
    suggestion: { type: String, default: null, trim: true, maxlength: 1000 },
    canOverride: { type: Boolean, required: true, default: false },
    overriddenBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    overrideReason: { type: String, default: null, trim: true, maxlength: 2000 },
    overriddenAt: { type: Date, default: null },
  },
  { _id: false }
);

const examConflictSnapshotSchema = new Schema<IExamConflictSnapshot>(
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
    generatedAt: { type: Date, required: true, index: true },
    generatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    status: {
      type: String,
      enum: [...EXAM_CONFLICT_SNAPSHOT_STATUSES],
      required: true,
      default: "open",
      index: true,
    },
    conflicts: { type: [examConflictSnapshotConflictSchema], default: [] },
  },
  { timestamps: true }
);

examConflictSnapshotSchema.index(
  { schoolId: 1, examSessionId: 1 },
  { name: "exam_conflict_snapshot_by_session", unique: true }
);

export const ExamConflictSnapshot: Model<IExamConflictSnapshot> =
  (models.ExamConflictSnapshot as Model<IExamConflictSnapshot>) ||
  model<IExamConflictSnapshot>("ExamConflictSnapshot", examConflictSnapshotSchema);
