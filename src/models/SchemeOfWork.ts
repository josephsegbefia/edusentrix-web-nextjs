import { Schema, model, models, type Model, type Types } from "mongoose";

export type SchemeOfWorkStatus =
  | "draft"
  | "submitted"
  | "needs_revision"
  | "approved"
  | "active"
  | "archived"
  | "rejected";

export type SchemeSourceType =
  | "manual"
  | "csv_import"
  | "excel_import"
  | "pdf_import"
  | "ai_generated"
  | "copied";

export interface ISchemeOfWork {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  title: string;
  description?: string;
  academicYearLabel?: string | null;
  termLabel?: string | null;
  academicYearId?: Types.ObjectId | null;
  termId?: Types.ObjectId | null;
  academicPeriodId?: Types.ObjectId | null;
  curriculumId?: Types.ObjectId | null;
  curriculumSubjectId?: Types.ObjectId | null;
  gradeId?: Types.ObjectId | null;
  classGroupId?: Types.ObjectId | null;
  subjectId?: Types.ObjectId | null;
  ownerTeacherId?: Types.ObjectId | null;
  status: SchemeOfWorkStatus;
  sourceType: SchemeSourceType;
  sourceFileUrl?: string | null;
  sourceFileKey?: string | null;
  version: number;
  copiedFromSchemeId?: Types.ObjectId | null;
  submittedAt?: Date | null;
  approvedAt?: Date | null;
  approvedByUserId?: Types.ObjectId | null;
  rejectedAt?: Date | null;
  rejectedByUserId?: Types.ObjectId | null;
  activatedByUserId?: Types.ObjectId | null;
  activatedAt?: Date | null;
  archivedAt?: Date | null;
  createdByUserId: Types.ObjectId;
  updatedByUserId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const schemeOfWorkSchema = new Schema<ISchemeOfWork>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 220 },
    description: { type: String, trim: true, maxlength: 8000 },
    academicYearLabel: { type: String, trim: true, maxlength: 80, default: null },
    termLabel: { type: String, trim: true, maxlength: 80, default: null },
    academicYearId: { type: Schema.Types.ObjectId, ref: "AcademicPeriod", default: null, index: true },
    termId: { type: Schema.Types.ObjectId, ref: "AcademicPeriod", default: null, index: true },
    academicPeriodId: { type: Schema.Types.ObjectId, ref: "AcademicPeriod", default: null, index: true },
    curriculumId: { type: Schema.Types.ObjectId, ref: "Curriculum", default: null, index: true },
    curriculumSubjectId: {
      type: Schema.Types.ObjectId,
      ref: "CurriculumSubject",
      default: null,
      index: true,
    },
    gradeId: { type: Schema.Types.ObjectId, ref: "Grade", default: null, index: true },
    classGroupId: { type: Schema.Types.ObjectId, ref: "ClassGroup", default: null, index: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", default: null, index: true },
    ownerTeacherId: { type: Schema.Types.ObjectId, ref: "Teacher", default: null, index: true },
    status: {
      type: String,
      enum: [
        "draft",
        "submitted",
        "needs_revision",
        "approved",
        "active",
        "archived",
        "rejected",
      ],
      default: "draft",
      index: true,
    },
    sourceType: {
      type: String,
      enum: ["manual", "csv_import", "excel_import", "pdf_import", "ai_generated", "copied"],
      default: "manual",
      index: true,
    },
    sourceFileUrl: { type: String, trim: true, default: null },
    sourceFileKey: { type: String, trim: true, default: null },
    version: { type: Number, min: 1, default: 1 },
    copiedFromSchemeId: { type: Schema.Types.ObjectId, ref: "SchemeOfWork", default: null },
    submittedAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null },
    approvedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    rejectedAt: { type: Date, default: null },
    rejectedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    activatedAt: { type: Date, default: null },
    activatedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    archivedAt: { type: Date, default: null },
    createdByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

schemeOfWorkSchema.index({ schoolId: 1, updatedAt: -1 });
schemeOfWorkSchema.index({ schoolId: 1, gradeId: 1, subjectId: 1, status: 1 });
schemeOfWorkSchema.index({
  schoolId: 1,
  academicPeriodId: 1,
  gradeId: 1,
  classGroupId: 1,
  subjectId: 1,
  status: 1,
});

export const SchemeOfWork: Model<ISchemeOfWork> =
  (models.SchemeOfWork as Model<ISchemeOfWork>) ||
  model<ISchemeOfWork>("SchemeOfWork", schemeOfWorkSchema);
