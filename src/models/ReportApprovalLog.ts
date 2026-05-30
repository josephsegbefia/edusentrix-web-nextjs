import { Schema, model, models, Types, type Model } from "mongoose";
import type {
  ReportApprovalAction,
  ReportApprovalEntityType,
} from "@/types/academics/assessment-engine";
import {
  REPORT_APPROVAL_ACTIONS,
  REPORT_APPROVAL_ENTITY_TYPES,
} from "@/models/academics/assessment-engine-schemas";

export interface IReportApprovalLog {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  reportCardRunId: Types.ObjectId;
  studentReportCardId?: Types.ObjectId | null;
  entityType: ReportApprovalEntityType;
  entityId: Types.ObjectId;
  action: ReportApprovalAction | string;
  actorId: Types.ObjectId;
  actorRole: string;
  note?: string | null;
  beforeStatus?: string | null;
  afterStatus?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

const reportApprovalLogSchema = new Schema<IReportApprovalLog>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    reportCardRunId: {
      type: Schema.Types.ObjectId,
      ref: "ReportCardRun",
      required: true,
      index: true,
    },
    studentReportCardId: {
      type: Schema.Types.ObjectId,
      ref: "StudentReportCard",
      default: null,
    },
    entityType: {
      type: String,
      enum: [...REPORT_APPROVAL_ENTITY_TYPES],
      required: true,
      index: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: [...REPORT_APPROVAL_ACTIONS],
      required: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    actorRole: { type: String, required: true, trim: true },
    note: { type: String, default: null, maxlength: 2000 },
    beforeStatus: { type: String, default: null },
    afterStatus: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

reportApprovalLogSchema.index(
  { reportCardRunId: 1, createdAt: -1 },
  { name: "ae_report_approval_log_by_run_created" }
);

reportApprovalLogSchema.index(
  { schoolId: 1, entityType: 1, entityId: 1 },
  { name: "ae_report_approval_log_by_school_entity" }
);

export const ReportApprovalLog: Model<IReportApprovalLog> =
  (models.ReportApprovalLog as Model<IReportApprovalLog>) ||
  model<IReportApprovalLog>("ReportApprovalLog", reportApprovalLogSchema);
