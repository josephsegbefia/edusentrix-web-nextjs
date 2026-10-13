import mongoose from "mongoose";
import { BulkImportJob, type IBulkImportJob } from "@/models/BulkImportJob";

export const LEGACY_BULK_IMPORT_SUPERSEDED_CODE = "LEGACY_IMPORT_SUPERSEDED";
export const LEGACY_BULK_IMPORT_SUPERSEDED_MESSAGE =
  "This pre-review bulk import was superseded by the staged import workflow. Re-upload the file to analyze, review, and explicitly confirm it.";

export async function quarantineLegacyBulkImport(input: {
  bulkImportJobId: string | mongoose.Types.ObjectId;
  schoolId: string | mongoose.Types.ObjectId;
}): Promise<IBulkImportJob | null> {
  return BulkImportJob.findOneAndUpdate(
    {
      _id: input.bulkImportJobId,
      schoolId: input.schoolId,
      status: { $in: ["pending", "processing"] },
    },
    {
      $set: {
        status: "superseded",
        rowErrors: [{ row: 0, message: LEGACY_BULK_IMPORT_SUPERSEDED_MESSAGE }],
        result: { errorCode: LEGACY_BULK_IMPORT_SUPERSEDED_CODE },
      },
    },
    { new: true }
  );
}
