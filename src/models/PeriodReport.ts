import { Schema, model, models, Types, type Model } from "mongoose";

export type PeriodReportType = "term" | "weekly" | "biweekly" | "monthly";

export interface IPeriodReportSuggestion {
  text: string;
  category?: string;
  status?: "pending" | "in_progress" | "done" | "deferred";
  checkedInPeriodId?: Types.ObjectId | null;
}

export interface IPeriodReportSection {
  title: string;
  content: string;
  highlights?: string[];
}

export interface IPeriodReport {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  reportType: PeriodReportType;
  dateRange?: {
    startDate: Date;
    endDate: Date;
  } | null;
  content: {
    summary: string;
    sections: IPeriodReportSection[];
    suggestions: IPeriodReportSuggestion[];
  };
  generatedAt: Date;
  generatedBy?: Types.ObjectId | null;
  dataFingerprint: string;
  createdAt: Date;
  updatedAt: Date;
}

const suggestionSchema = new Schema(
  {
    text: { type: String, required: true },
    category: { type: String, default: null },
    status: {
      type: String,
      enum: ["pending", "in_progress", "done", "deferred"],
      default: "pending",
    },
    checkedInPeriodId: { type: Schema.Types.ObjectId, ref: "AcademicPeriod", default: null },
  },
  { _id: false }
);

const sectionSchema = new Schema(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    highlights: { type: [String], default: [] },
  },
  { _id: false }
);

const periodReportSchema = new Schema<IPeriodReport>(
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
    reportType: {
      type: String,
      enum: ["term", "weekly", "biweekly", "monthly"],
      required: true,
      index: true,
    },
    dateRange: {
      startDate: { type: Date, default: null },
      endDate: { type: Date, default: null },
    },
    content: {
      summary: { type: String, required: true, default: "" },
      sections: { type: [sectionSchema], default: [] },
      suggestions: { type: [suggestionSchema], default: [] },
    },
    generatedAt: { type: Date, default: Date.now },
    generatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    dataFingerprint: { type: String, required: true },
  },
  { timestamps: true }
);

periodReportSchema.index({ schoolId: 1, academicPeriodId: 1, reportType: 1 });

export const PeriodReport: Model<IPeriodReport> =
  (models.PeriodReport as Model<IPeriodReport>) ||
  model<IPeriodReport>("PeriodReport", periodReportSchema);
