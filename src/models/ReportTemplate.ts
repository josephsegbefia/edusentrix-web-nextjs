import { Schema, model, models, Types, type Model } from "mongoose";

export type ReportSectionType =
  | "header"
  | "student_info"
  | "subject_grades"
  | "assessment_breakdown"
  | "criteria_detail"
  | "descriptor_levels"
  | "term_summary"
  | "class_position"
  | "attendance"
  | "conduct"
  | "teacher_comments"
  | "head_teacher_comments"
  | "parent_signature"
  | "grading_key"
  | "custom";

export interface IReportSection {
  type: ReportSectionType;
  label: string;
  enabled: boolean;
  order: number;
  config?: Record<string, unknown>;
}

export interface IReportTemplate {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  name: string;
  curriculumCode: string;
  isDefault: boolean;
  orientation: "portrait" | "landscape";
  paperSize: "A4" | "Letter";
  sections: IReportSection[];
  showClassPosition: boolean;
  showAttendance: boolean;
  showConduct: boolean;
  showGradingKey: boolean;
  headerConfig?: {
    showLogo: boolean;
    showSchoolName: boolean;
    showSchoolAddress: boolean;
    showAcademicPeriod: boolean;
    subtitle?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const reportSectionSchema = new Schema<IReportSection>(
  {
    type: {
      type: String,
      enum: [
        "header",
        "student_info",
        "subject_grades",
        "assessment_breakdown",
        "criteria_detail",
        "descriptor_levels",
        "term_summary",
        "class_position",
        "attendance",
        "conduct",
        "teacher_comments",
        "head_teacher_comments",
        "parent_signature",
        "grading_key",
        "custom",
      ],
      required: true,
    },
    label: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    order: { type: Number, required: true },
    config: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const reportTemplateSchema = new Schema<IReportTemplate>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    curriculumCode: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    orientation: {
      type: String,
      enum: ["portrait", "landscape"],
      default: "portrait",
    },
    paperSize: {
      type: String,
      enum: ["A4", "Letter"],
      default: "A4",
    },
    sections: { type: [reportSectionSchema], default: [] },
    showClassPosition: { type: Boolean, default: true },
    showAttendance: { type: Boolean, default: true },
    showConduct: { type: Boolean, default: true },
    showGradingKey: { type: Boolean, default: true },
    headerConfig: {
      showLogo: { type: Boolean, default: true },
      showSchoolName: { type: Boolean, default: true },
      showSchoolAddress: { type: Boolean, default: true },
      showAcademicPeriod: { type: Boolean, default: true },
      subtitle: { type: String, default: null },
    },
  },
  { timestamps: true }
);

reportTemplateSchema.index(
  { schoolId: 1, name: 1 },
  { unique: true, name: "unique_template_per_school" }
);

reportTemplateSchema.index(
  { schoolId: 1, isDefault: 1 },
  { name: "by_school_default" }
);

export const ReportTemplate: Model<IReportTemplate> =
  (models.ReportTemplate as Model<IReportTemplate>) ||
  model<IReportTemplate>("ReportTemplate", reportTemplateSchema);
