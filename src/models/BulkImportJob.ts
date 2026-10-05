import { Schema, model, models, type Model, type Types } from "mongoose";

export const BULK_IMPORT_TARGET_KINDS = ["students", "teachers"] as const;
export type BulkImportTargetKind = (typeof BULK_IMPORT_TARGET_KINDS)[number];

export const BULK_IMPORT_STATUSES = [
  "pending",
  "processing",
  "completed",
  "completed_with_errors",
  "failed",
] as const;
export type BulkImportStatus = (typeof BULK_IMPORT_STATUSES)[number];

export interface IBulkImportError {
  row: number;
  message: string;
}

export interface IBulkImportJob {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  createdBy: Types.ObjectId;
  targetKind: BulkImportTargetKind;
  status: BulkImportStatus;
  fileName: string;
  mimeType?: string | null;
  fileBytes?: Buffer | null;
  classGroupId?: Types.ObjectId | null;
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  rowErrors: IBulkImportError[];
  result?: Record<string, unknown> | null;
  backgroundJobId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const errorSchema = new Schema<IBulkImportError>(
  {
    row: { type: Number, required: true },
    message: { type: String, required: true, maxlength: 500 },
  },
  { _id: false }
);

const bulkImportJobSchema = new Schema<IBulkImportJob>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetKind: { type: String, enum: BULK_IMPORT_TARGET_KINDS, required: true },
    status: {
      type: String,
      enum: BULK_IMPORT_STATUSES,
      default: "pending",
      index: true,
    },
    fileName: { type: String, required: true, trim: true, maxlength: 400 },
    mimeType: { type: String, trim: true, maxlength: 160, default: null },
    fileBytes: { type: Buffer, default: null },
    classGroupId: { type: Schema.Types.ObjectId, ref: "ClassGroup", default: null },
    totalRows: { type: Number, default: 0 },
    successfulRows: { type: Number, default: 0 },
    failedRows: { type: Number, default: 0 },
    rowErrors: { type: [errorSchema], default: [] },
    result: { type: Schema.Types.Mixed, default: null },
    backgroundJobId: { type: Schema.Types.ObjectId, ref: "BackgroundJob", default: null },
  },
  { timestamps: true, suppressReservedKeysWarning: true }
);

bulkImportJobSchema.index({ schoolId: 1, createdAt: -1 });

export const BulkImportJob: Model<IBulkImportJob> =
  (models.BulkImportJob as Model<IBulkImportJob>) ||
  model<IBulkImportJob>("BulkImportJob", bulkImportJobSchema);
