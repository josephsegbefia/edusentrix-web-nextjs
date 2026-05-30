import { Schema, model, models, Types, type Model } from "mongoose";
import type {
  ExamIncidentSeverity,
  ExamIncidentStatus,
  ExamIncidentType,
} from "@/types/academics/exam-scheduling-engine";
import {
  EXAM_INCIDENT_SEVERITIES,
  EXAM_INCIDENT_STATUSES,
  EXAM_INCIDENT_TYPES,
} from "@/constants/academics/exam-scheduling-engine";

export interface IExamIncidentReport {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  examSessionId: Types.ObjectId;
  examTimetableEntryId: Types.ObjectId;
  reportedBy: Types.ObjectId;
  type: ExamIncidentType;
  severity: ExamIncidentSeverity;
  description: string;
  actionTaken?: string | null;
  status: ExamIncidentStatus;
  createdAt: Date;
  updatedAt: Date;
}

const examIncidentReportSchema = new Schema<IExamIncidentReport>(
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
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [...EXAM_INCIDENT_TYPES],
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: [...EXAM_INCIDENT_SEVERITIES],
      required: true,
      index: true,
    },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    actionTaken: { type: String, default: null, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: [...EXAM_INCIDENT_STATUSES],
      required: true,
      default: "open",
      index: true,
    },
  },
  { timestamps: true }
);

examIncidentReportSchema.index(
  { schoolId: 1, examTimetableEntryId: 1, createdAt: -1 },
  { name: "exam_incident_by_entry" }
);

export const ExamIncidentReport: Model<IExamIncidentReport> =
  (models.ExamIncidentReport as Model<IExamIncidentReport>) ||
  model<IExamIncidentReport>("ExamIncidentReport", examIncidentReportSchema);
