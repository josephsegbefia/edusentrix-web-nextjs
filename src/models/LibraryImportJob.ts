import { Schema, model, models, type Model, type Types } from "mongoose";

export type LibraryImportJobType = "books" | "copies" | "books_and_copies";

export type LibraryImportJobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "completed_with_errors";

export interface ILibraryImportJobError {
  rowNumber: number;
  field?: string;
  message: string;
  raw?: Record<string, unknown>;
}

export interface ILibraryImportJob {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  type: LibraryImportJobType;
  status: LibraryImportJobStatus;
  fileName: string;
  fileUrl?: string;
  /** Raw CSV payload while `pending` / `processing`; removed after the job finishes. */
  csvText?: string;
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  errors: ILibraryImportJobError[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const errorSchema = new Schema<ILibraryImportJobError>(
  {
    rowNumber: { type: Number, required: true },
    field: { type: String },
    message: { type: String, required: true },
    raw: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const libraryImportJobSchema = new Schema<ILibraryImportJob>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    type: {
      type: String,
      enum: ["books", "copies", "books_and_copies"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed", "completed_with_errors"],
      default: "pending",
      index: true,
    },
    fileName: { type: String, required: true, trim: true },
    fileUrl: { type: String },
    csvText: { type: String, maxlength: 2_000_000 },
    totalRows: { type: Number, default: 0, min: 0 },
    successfulRows: { type: Number, default: 0, min: 0 },
    failedRows: { type: Number, default: 0, min: 0 },
    errors: { type: [errorSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, suppressReservedKeysWarning: true }
);

libraryImportJobSchema.index({ schoolId: 1, createdAt: -1 });

export const LibraryImportJob: Model<ILibraryImportJob> =
  models.LibraryImportJob || model<ILibraryImportJob>("LibraryImportJob", libraryImportJobSchema);
