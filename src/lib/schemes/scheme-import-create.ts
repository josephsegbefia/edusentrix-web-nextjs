import type mongoose from "mongoose";
import { enqueueSchemeImportParse } from "@/lib/schemes/enqueue-scheme-import-parse";
import { serializeSchemeImportJob } from "@/lib/schemes/scheme-import-serialize";

type CreateSchemeImportJobInput = {
  schoolId: mongoose.Types.ObjectId;
  createdByUserId: mongoose.Types.ObjectId;
  fileUrl: string;
  fileName: string;
  fileKey?: string | null;
  mimeType?: string | null;
};

export async function createSchemeImportJobFromUpload(input: CreateSchemeImportJobInput): Promise<
  | {
      ok: true;
      job: ReturnType<typeof serializeSchemeImportJob>;
      jobId: string;
      schemeImportJobId: string;
    }
  | { ok: false; error: string; status: number }
> {
  return enqueueSchemeImportParse(input);
}
