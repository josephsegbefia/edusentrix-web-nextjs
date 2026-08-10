import { Schema, model, models, type Model, type Types } from "mongoose";

export type SchemeImportJobStatus = "parsed" | "confirmed" | "cancelled" | "failed";

export type SchemeImportSourceKind =
  | "spreadsheet"
  | "pdf_parse_tables"
  | "pdf_excavator"
  | "pdf_text_grid"
  | "pdf_ai"
  | "pdf_gemini"
  | "pdf_manual";

export interface ISchemeImportParsedRow {
  rowIndex: number;
  weekNumber: number | null;
  weekEnding?: string | null;
  title: string;
  strand?: string | null;
  subStrand?: string | null;
  contentStandard?: string | null;
  indicators?: string[];
  learningOutcomes?: string[];
  teachingLearningActivities?: string | null;
  resources?: string[];
  assessment?: string[];
  learningObjective: string | null;
  notes: string | null;
  rowType?: "teaching" | "revision" | "examination" | "holiday" | "other";
  skipped: boolean;
  errors: string[];
  /** Model-estimated parse confidence for PDF/AI imports (0–1); absent for CSV/XLSX. */
  confidence?: number | null;
  rawText?: string | null;
}

export interface ISchemeImportJob {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  createdByUserId: Types.ObjectId;
  status: SchemeImportJobStatus;
  /** Spreadsheet parse vs PDF text + AI extraction. */
  sourceKind?: SchemeImportSourceKind;
  fileName: string;
  fileUrl?: string | null;
  /** UploadThing key when applicable */
  fileKey?: string | null;
  parseError?: string | null;
  /** Shown when import succeeded via offline PDF parse or Leo was skipped. */
  parseWarning?: string | null;
  parsedRows: ISchemeImportParsedRow[];
  resultSchemeId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const parsedRowSchema = new Schema<ISchemeImportParsedRow>(
  {
    rowIndex: { type: Number, required: true, min: 0 },
    weekNumber: { type: Number, default: null },
    weekEnding: { type: String, trim: true, maxlength: 120, default: null },
    title: { type: String, required: true, trim: true, maxlength: 260 },
    strand: { type: String, trim: true, maxlength: 260, default: null },
    subStrand: { type: String, trim: true, maxlength: 260, default: null },
    contentStandard: { type: String, trim: true, maxlength: 600, default: null },
    indicators: [{ type: String, trim: true, maxlength: 600 }],
    learningOutcomes: [{ type: String, trim: true, maxlength: 1000 }],
    teachingLearningActivities: { type: String, trim: true, maxlength: 8000, default: null },
    resources: [{ type: String, trim: true, maxlength: 500 }],
    assessment: [{ type: String, trim: true, maxlength: 1000 }],
    learningObjective: { type: String, trim: true, maxlength: 5000, default: null },
    notes: { type: String, trim: true, maxlength: 5000, default: null },
    rowType: {
      type: String,
      enum: ["teaching", "revision", "examination", "holiday", "other"],
      default: "teaching",
    },
    skipped: { type: Boolean, default: false },
    errors: { type: [String], default: [] },
    confidence: { type: Number, min: 0, max: 1, default: null },
    rawText: { type: String, trim: true, maxlength: 4000, default: null },
  },
  { _id: false, suppressReservedKeysWarning: true }
);

const schemeImportJobSchema = new Schema<ISchemeImportJob>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    createdByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sourceKind: {
      type: String,
    enum: [
      "spreadsheet",
      "pdf_parse_tables",
      "pdf_excavator",
      "pdf_text_grid",
      "pdf_ai",
      "pdf_gemini",
      "pdf_manual",
    ],
      default: "spreadsheet",
      index: true,
    },
    status: {
      type: String,
      enum: ["parsed", "confirmed", "cancelled", "failed"],
      default: "parsed",
      index: true,
    },
    fileName: { type: String, required: true, trim: true, maxlength: 400 },
    fileUrl: { type: String, trim: true, maxlength: 2000, default: null },
    fileKey: { type: String, trim: true, maxlength: 500, default: null },
    parseError: { type: String, trim: true, maxlength: 4000, default: null },
    parseWarning: { type: String, trim: true, maxlength: 4000, default: null },
    parsedRows: { type: [parsedRowSchema], default: [] },
    resultSchemeId: { type: Schema.Types.ObjectId, ref: "SchemeOfWork", default: null },
  },
  { timestamps: true, suppressReservedKeysWarning: true }
);

schemeImportJobSchema.index({ schoolId: 1, createdAt: -1 });

const existingSchemeImportJob = models.SchemeImportJob as Model<ISchemeImportJob> | undefined;
if (existingSchemeImportJob) {
  const sourceKindPath = existingSchemeImportJob.schema.path("sourceKind");
  const enumValues =
    sourceKindPath && "enumValues" in sourceKindPath
      ? (sourceKindPath.enumValues as string[])
      : [];
  if (!enumValues.includes("pdf_manual")) {
    delete models.SchemeImportJob;
  }
}

export const SchemeImportJob: Model<ISchemeImportJob> =
  (models.SchemeImportJob as Model<ISchemeImportJob>) ||
  model<ISchemeImportJob>("SchemeImportJob", schemeImportJobSchema);
