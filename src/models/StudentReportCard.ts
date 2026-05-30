import { Schema, model, models, Types, type Model } from "mongoose";
import type { StudentReportCardStatus } from "@/types/academics/assessment-engine";
import { STUDENT_REPORT_CARD_STATUSES } from "@/models/academics/assessment-engine-schemas";

export interface IStudentReportCard {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  reportCardRunId: Types.ObjectId;
  studentId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  gradeId: Types.ObjectId;
  gradingPolicySnapshot: Record<string, unknown>;
  assessmentPlanSnapshot: Record<string, unknown>;
  reportTemplateSnapshot: Record<string, unknown>;
  studentSnapshot: Record<string, unknown>;
  schoolSnapshot: Record<string, unknown>;
  attendanceSnapshot: Record<string, unknown>;
  subjectResultsSnapshot: unknown[];
  termSummarySnapshot: Record<string, unknown>;
  commentsSnapshot: Record<string, unknown>;
  conductSnapshot?: Record<string, unknown> | null;
  promotionSnapshot?: Record<string, unknown> | null;
  verificationId?: Types.ObjectId | null;
  pdfUrl?: string | null;
  status: StudentReportCardStatus;
  compiledAt?: Date | null;
  approvedAt?: Date | null;
  releasedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const studentReportCardSchema = new Schema<IStudentReportCard>(
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
    reportCardRunId: {
      type: Schema.Types.ObjectId,
      ref: "ReportCardRun",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
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
    },
    gradingPolicySnapshot: { type: Schema.Types.Mixed, required: true },
    assessmentPlanSnapshot: { type: Schema.Types.Mixed, required: true },
    reportTemplateSnapshot: { type: Schema.Types.Mixed, required: true },
    studentSnapshot: { type: Schema.Types.Mixed, required: true },
    schoolSnapshot: { type: Schema.Types.Mixed, required: true },
    attendanceSnapshot: { type: Schema.Types.Mixed, required: true },
    subjectResultsSnapshot: {
      type: Array,
      of: Schema.Types.Mixed,
      default: [],
    },
    termSummarySnapshot: { type: Schema.Types.Mixed, required: true },
    commentsSnapshot: { type: Schema.Types.Mixed, required: true },
    conductSnapshot: { type: Schema.Types.Mixed, default: null },
    promotionSnapshot: { type: Schema.Types.Mixed, default: null },
    verificationId: {
      type: Schema.Types.ObjectId,
      ref: "ReportVerification",
      default: null,
    },
    pdfUrl: { type: String, default: null },
    status: {
      type: String,
      enum: [...STUDENT_REPORT_CARD_STATUSES],
      required: true,
      default: "draft",
      index: true,
    },
    compiledAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null },
    releasedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

studentReportCardSchema.index(
  { reportCardRunId: 1, studentId: 1 },
  { unique: true, name: "ae_student_report_card_unique_run_student" }
);

studentReportCardSchema.index(
  { schoolId: 1, academicPeriodId: 1, studentId: 1 },
  { name: "ae_student_report_card_by_school_period_student" }
);

studentReportCardSchema.index(
  { schoolId: 1, status: 1 },
  { name: "ae_student_report_card_by_school_status" }
);

export const StudentReportCard: Model<IStudentReportCard> =
  (models.StudentReportCard as Model<IStudentReportCard>) ||
  model<IStudentReportCard>("StudentReportCard", studentReportCardSchema);
