import "server-only";

import mongoose from "mongoose";
import { InternalTestGeneratedRecord } from "@/models/InternalTestGeneratedRecord";

export type GenerationCtx = {
  schoolId: mongoose.Types.ObjectId;
  jobId: mongoose.Types.ObjectId;
  batchId: string;
};

export async function registerGenerated(
  ctx: GenerationCtx,
  collectionName: string,
  documentId: mongoose.Types.ObjectId,
  module: string
) {
  await InternalTestGeneratedRecord.create({
    schoolId: ctx.schoolId,
    testDataBatchId: ctx.batchId,
    generationJobId: ctx.jobId,
    collectionName,
    documentId,
    module,
  });
}
