import { Schema, model, models, Types, type Model } from "mongoose";
import type { ReportAttendanceSnapshotSource } from "@/types/academics/assessment-engine";
import { REPORT_ATTENDANCE_SNAPSHOT_SOURCES } from "@/models/academics/assessment-engine-schemas";

export interface IReportAttendanceSnapshot {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  reportCardRunId: Types.ObjectId;
  studentId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  source: ReportAttendanceSnapshotSource;
  totalSchoolDays: number;
  daysPresent: number;
  daysAbsent: number;
  daysLate: number;
  daysExcused: number;
  attendancePercentage: number;
  calculatedFromDate: Date;
  calculatedToDate: Date;
  calculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const reportAttendanceSnapshotSchema = new Schema<IReportAttendanceSnapshot>(
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
    source: {
      type: String,
      enum: [...REPORT_ATTENDANCE_SNAPSHOT_SOURCES],
      required: true,
      default: "homeroom_daily_attendance",
    },
    totalSchoolDays: { type: Number, required: true, default: 0, min: 0 },
    daysPresent: { type: Number, required: true, default: 0, min: 0 },
    daysAbsent: { type: Number, required: true, default: 0, min: 0 },
    daysLate: { type: Number, required: true, default: 0, min: 0 },
    daysExcused: { type: Number, required: true, default: 0, min: 0 },
    attendancePercentage: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    calculatedFromDate: { type: Date, required: true },
    calculatedToDate: { type: Date, required: true },
    calculatedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

reportAttendanceSnapshotSchema.index(
  { reportCardRunId: 1, studentId: 1 },
  { unique: true, name: "ae_report_attendance_snapshot_unique_run_student" }
);

reportAttendanceSnapshotSchema.index(
  { schoolId: 1, academicPeriodId: 1, classGroupId: 1 },
  { name: "ae_report_attendance_snapshot_by_school_period_class" }
);

export const ReportAttendanceSnapshot: Model<IReportAttendanceSnapshot> =
  (models.ReportAttendanceSnapshot as Model<IReportAttendanceSnapshot>) ||
  model<IReportAttendanceSnapshot>(
    "ReportAttendanceSnapshot",
    reportAttendanceSnapshotSchema
  );
