import { Schema, model, models, Types, type Model } from "mongoose";
import type {
  ExamInvigilatorRole,
  ExamInvigilatorStatus,
} from "@/types/academics/exam-scheduling-engine";
import {
  examInvigilatorRoleEnum,
  examInvigilatorStatusEnum,
} from "@/models/academics/exam-scheduling-engine-schemas";

export interface IExamInvigilatorAssignment {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  examSessionId: Types.ObjectId;
  examTimetableEntryId: Types.ObjectId;
  teacherId: Types.ObjectId;
  role: ExamInvigilatorRole;
  status: ExamInvigilatorStatus;
  assignedBy: Types.ObjectId;
  assignedAt: Date;
  acknowledgedAt?: Date | null;
  declinedAt?: Date | null;
  replacedByTeacherId?: Types.ObjectId | null;
  replacementReason?: string | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const examInvigilatorAssignmentSchema = new Schema<IExamInvigilatorAssignment>(
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
    examTimetableEntryId: {
      type: Schema.Types.ObjectId,
      ref: "ExamTimetableEntry",
      required: true,
      index: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: examInvigilatorRoleEnum,
      required: true,
      default: "lead",
      index: true,
    },
    status: {
      type: String,
      enum: examInvigilatorStatusEnum,
      required: true,
      default: "assigned",
      index: true,
    },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedAt: { type: Date, required: true, default: Date.now },
    acknowledgedAt: { type: Date, default: null },
    declinedAt: { type: Date, default: null },
    replacedByTeacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      default: null,
    },
    replacementReason: { type: String, default: null, trim: true, maxlength: 1000 },
    notes: { type: String, default: null, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

examInvigilatorAssignmentSchema.index(
  { schoolId: 1, teacherId: 1 },
  { name: "exam_invigilator_by_school_teacher" }
);

examInvigilatorAssignmentSchema.index(
  { examSessionId: 1, teacherId: 1 },
  { name: "exam_invigilator_by_session_teacher" }
);

examInvigilatorAssignmentSchema.index(
  { examTimetableEntryId: 1, teacherId: 1, role: 1 },
  {
    name: "exam_invigilator_unique_entry_teacher_role",
    unique: true,
  }
);

export const ExamInvigilatorAssignment: Model<IExamInvigilatorAssignment> =
  (models.ExamInvigilatorAssignment as Model<IExamInvigilatorAssignment>) ||
  model<IExamInvigilatorAssignment>(
    "ExamInvigilatorAssignment",
    examInvigilatorAssignmentSchema
  );
