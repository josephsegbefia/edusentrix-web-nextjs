import { Schema, model, models, Types } from "mongoose";

export type ReportExportStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed";

export type ReportExportFormat = "csv" | "pdf";

export type ReportExportRangeMode = "range" | "all_time" | "period";

export interface IReportExport {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  requestedBy: Types.ObjectId;
  reportKey: string;
  reportLabel?: string | null;
  format: ReportExportFormat;
  status: ReportExportStatus;
  rangeMode: ReportExportRangeMode;
  range: {
    startDate: Date;
    endDate: Date;
    periodId?: Types.ObjectId | null;
    periodLabel?: string | null;
    source: string;
  };
  filters?: Record<string, unknown>;
  rowCount?: number | null;
  fileName?: string | null;
  error?: string | null;
  completedAt?: Date | null;
  downloadedAt?: Date | null;
  limit?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const reportExportSchema = new Schema<IReportExport>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reportKey: { type: String, required: true, index: true },
    reportLabel: { type: String, default: null },
    format: {
      type: String,
      enum: ["csv", "pdf"],
      default: "csv",
      required: true,
    },
    status: {
      type: String,
      enum: ["queued", "processing", "completed", "failed"],
      default: "queued",
      required: true,
    },
    rangeMode: {
      type: String,
      enum: ["range", "all_time", "period"],
      default: "range",
      required: true,
    },
    range: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      periodId: { type: Schema.Types.ObjectId, ref: "AcademicPeriod", default: null },
      periodLabel: { type: String, default: null },
      source: { type: String, default: "custom" },
    },
    filters: { type: Schema.Types.Mixed, default: {} },
    rowCount: { type: Number, default: null },
    fileName: { type: String, default: null },
    error: { type: String, default: null },
    completedAt: { type: Date, default: null },
    downloadedAt: { type: Date, default: null },
    limit: { type: Number, default: null },
  },
  { timestamps: true }
);

reportExportSchema.index({ schoolId: 1, createdAt: -1 });
reportExportSchema.index({ schoolId: 1, reportKey: 1, createdAt: -1 });

export const ReportExport =
  models.ReportExport || model<IReportExport>("ReportExport", reportExportSchema);
