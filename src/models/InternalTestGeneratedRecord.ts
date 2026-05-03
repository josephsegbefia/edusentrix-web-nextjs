import { Schema, model, models, type Model, type Types } from "mongoose";

/** Tracks documents created by internal-test seed jobs for batch reset (spec §11). */
export interface IInternalTestGeneratedRecord {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  testDataBatchId: string;
  generationJobId: Types.ObjectId;
  collectionName: string;
  documentId: Types.ObjectId;
  module: string;
  createdAt: Date;
}

const internalTestGeneratedRecordSchema = new Schema<IInternalTestGeneratedRecord>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    testDataBatchId: { type: String, required: true, index: true, trim: true },
    generationJobId: {
      type: Schema.Types.ObjectId,
      ref: "InternalTestDataGenerationJob",
      required: true,
      index: true,
    },
    collectionName: { type: String, required: true, trim: true, index: true },
    documentId: { type: Schema.Types.ObjectId, required: true },
    module: { type: String, required: true, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

internalTestGeneratedRecordSchema.index(
  { schoolId: 1, testDataBatchId: 1, collectionName: 1 }
);

export const InternalTestGeneratedRecord: Model<IInternalTestGeneratedRecord> =
  (models.InternalTestGeneratedRecord as Model<IInternalTestGeneratedRecord>) ||
  model<IInternalTestGeneratedRecord>(
    "InternalTestGeneratedRecord",
    internalTestGeneratedRecordSchema
  );
