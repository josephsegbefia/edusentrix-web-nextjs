import { Schema, model, models, type Model, type Types } from "mongoose";

export type GenerationStepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export type InternalTestJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface IInternalTestDataGenerationJob {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  requestedBy: Types.ObjectId;
  testDataBatchId: string;
  scope: "core_v1" | "extended_v2";
  status: InternalTestJobStatus;
  academicPeriods: Array<{
    name: string;
    termLabel: string;
    startDate: Date;
    endDate: Date;
    isCurrent: boolean;
  }>;
  counts: {
    studentsPerClassGroup: number;
    teachers: number;
    parentsPerStudentRatio: number;
  };
  steps: Array<{
    key: string;
    label: string;
    status: GenerationStepStatus;
    startedAt?: Date;
    completedAt?: Date;
    createdCount?: number;
    updatedCount?: number;
    error?: string;
    skipReason?: string;
  }>;
  createdCounts: Record<string, number>;
  errors: Array<{ step: string; message: string; details?: unknown }>;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const stepSchema = new Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed", "skipped"],
      default: "pending",
    },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    createdCount: { type: Number, default: undefined },
    updatedCount: { type: Number, default: undefined },
    error: { type: String, default: undefined },
    skipReason: { type: String, default: undefined },
  },
  { _id: false }
);

const internalTestDataGenerationJobSchema = new Schema<IInternalTestDataGenerationJob>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    testDataBatchId: { type: String, required: true, trim: true, index: true },
    scope: { type: String, enum: ["core_v1", "extended_v2"], required: true },
    status: {
      type: String,
      enum: ["queued", "running", "completed", "failed", "cancelled"],
      default: "queued",
      index: true,
    },
    academicPeriods: [
      {
        name: { type: String, required: true },
        termLabel: { type: String, required: true },
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        isCurrent: { type: Boolean, required: true },
      },
    ],
    counts: {
      studentsPerClassGroup: { type: Number, required: true },
      teachers: { type: Number, required: true },
      parentsPerStudentRatio: { type: Number, required: true },
    },
    steps: { type: [stepSchema], default: [] },
    createdCounts: { type: Schema.Types.Mixed, default: {} },
    errors: {
      type: [
        {
          step: { type: String, required: true },
          message: { type: String, required: true },
          details: { type: Schema.Types.Mixed, default: null },
        },
      ],
      default: [],
    },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

internalTestDataGenerationJobSchema.index({ schoolId: 1, createdAt: -1 });

export const InternalTestDataGenerationJob: Model<IInternalTestDataGenerationJob> =
  (models.InternalTestDataGenerationJob as Model<IInternalTestDataGenerationJob>) ||
  model<IInternalTestDataGenerationJob>(
    "InternalTestDataGenerationJob",
    internalTestDataGenerationJobSchema
  );
