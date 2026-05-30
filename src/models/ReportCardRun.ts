import { Schema, model, models, Types, type Model } from "mongoose";
import type {
  ReportCardRunIssueSummary,
  ReportCardRunReadinessSnapshot,
  ReportCardRunStatus,
} from "@/types/academics/assessment-engine";
import {
  REPORT_CARD_RUN_STATUSES,
  reportCardRunIssueSummarySchema,
  reportCardRunReadinessSnapshotSchema,
} from "@/models/academics/assessment-engine-schemas";

export interface IReportCardRun {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  gradeId: Types.ObjectId;
  homeroomTeacherId: Types.ObjectId;
  gradingPolicyId: Types.ObjectId;
  assessmentPlanId: Types.ObjectId;
  reportTemplateId?: Types.ObjectId | null;
  status: ReportCardRunStatus;
  openedBy?: Types.ObjectId | null;
  openedAt?: Date | null;
  compiledBy?: Types.ObjectId | null;
  compiledAt?: Date | null;
  submittedBy?: Types.ObjectId | null;
  submittedAt?: Date | null;
  approvedBy?: Types.ObjectId | null;
  approvedAt?: Date | null;
  releasedBy?: Types.ObjectId | null;
  releasedAt?: Date | null;
  releaseVisibility?: Record<string, unknown> | null;
  readinessSnapshot?: ReportCardRunReadinessSnapshot | null;
  issueSummary?: ReportCardRunIssueSummary[] | null;
  createdAt: Date;
  updatedAt: Date;
}

const reportCardRunSchema = new Schema<IReportCardRun>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    academicPeriodId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      required: true,
      index: true,
    },
    classGroupId: {
      type: Schema.Types.ObjectId,
      ref: "ClassGroup",
      required: true,
      index: true,
    },
    gradeId: {
      type: Schema.Types.ObjectId,
      ref: "Grade",
      required: true,
      index: true,
    },
    homeroomTeacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },
    gradingPolicyId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicGradingPolicy",
      required: true,
    },
    assessmentPlanId: {
      type: Schema.Types.ObjectId,
      ref: "AssessmentPlan",
      required: true,
    },
    reportTemplateId: {
      type: Schema.Types.ObjectId,
      ref: "ReportTemplate",
      default: null,
    },
    status: {
      type: String,
      enum: [...REPORT_CARD_RUN_STATUSES],
      required: true,
      default: "draft",
      index: true,
    },
    openedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    openedAt: { type: Date, default: null },
    compiledBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    compiledAt: { type: Date, default: null },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    submittedAt: { type: Date, default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    releasedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    releasedAt: { type: Date, default: null },
    releaseVisibility: { type: Schema.Types.Mixed, default: null },
    readinessSnapshot: {
      type: reportCardRunReadinessSnapshotSchema,
      default: null,
    },
    issueSummary: {
      type: [reportCardRunIssueSummarySchema],
      default: [],
    },
  },
  { timestamps: true }
);

reportCardRunSchema.index(
  { schoolId: 1, academicPeriodId: 1, classGroupId: 1 },
  { unique: true, name: "ae_report_card_run_unique_class_period" }
);

reportCardRunSchema.index(
  { schoolId: 1, status: 1 },
  { name: "ae_report_card_run_by_school_status" }
);

reportCardRunSchema.index(
  { schoolId: 1, homeroomTeacherId: 1, status: 1 },
  { name: "ae_report_card_run_by_homeroom_teacher_status" }
);

export const ReportCardRun: Model<IReportCardRun> =
  (models.ReportCardRun as Model<IReportCardRun>) ||
  model<IReportCardRun>("ReportCardRun", reportCardRunSchema);
