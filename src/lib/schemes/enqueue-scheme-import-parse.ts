import "server-only";

import mongoose from "mongoose";
import { enqueueBackgroundJob } from "@/lib/background/enqueue-job";
import {
  assertPdfSchemeImportEnabled,
  assertSchemeImportEnabled,
  isTrustedSchemeImportFileUrl,
} from "@/lib/schemes/scheme-import-gate";
import { isPdfSource } from "@/lib/schemes/scheme-import-pdf-utils";
import { serializeSchemeImportJob } from "@/lib/schemes/scheme-import-serialize";
import { parseStoredAssetId } from "@/lib/storage/urls";
import { SchemeImportJob } from "@/models/SchemeImportJob";
import { StoredAsset } from "@/models/StoredAsset";

export { requeueSchemeImportParse } from "@/lib/background/domain-enqueue";

export type EnqueueSchemeImportInput = {
  schoolId: mongoose.Types.ObjectId;
  createdByUserId: mongoose.Types.ObjectId;
  fileUrl: string;
  fileName: string;
  fileKey?: string | null;
  mimeType?: string | null;
};

export function schemeImportActionUrl(schemeImportJobId: string) {
  return `/admin/schemes/import?jobId=${schemeImportJobId}`;
}

export async function assertSchemeImportStoredAsset(input: {
  fileUrl: string;
  schoolId: string;
}): Promise<{ ok: true; assetId: string } | { ok: false; error: string; status: number }> {
  if (!isTrustedSchemeImportFileUrl(input.fileUrl)) {
    return { ok: false, error: "Untrusted file URL", status: 400 };
  }
  const assetId = parseStoredAssetId(input.fileUrl);
  if (!assetId) {
    return { ok: false, error: "Untrusted file URL", status: 400 };
  }
  const asset = await StoredAsset.findById(assetId);
  if (!asset || asset.status !== "ready") {
    return { ok: false, error: "Uploaded file not found", status: 404 };
  }
  if (String(asset.schoolId) !== String(input.schoolId)) {
    return { ok: false, error: "Untrusted file URL", status: 400 };
  }
  if (asset.kind !== "scheme_import") {
    return { ok: false, error: "Untrusted file URL", status: 400 };
  }
  return { ok: true, assetId };
}

export async function enqueueSchemeImportParse(input: EnqueueSchemeImportInput): Promise<
  | {
      ok: true;
      job: ReturnType<typeof serializeSchemeImportJob>;
      jobId: string;
      schemeImportJobId: string;
    }
  | { ok: false; error: string; status: number }
> {
  const asset = await assertSchemeImportStoredAsset({
    fileUrl: input.fileUrl,
    schoolId: String(input.schoolId),
  });
  if (!asset.ok) return asset;

  const pdfMode = isPdfSource(input.fileName, input.mimeType);
  const gate = pdfMode
    ? await assertPdfSchemeImportEnabled(input.schoolId)
    : await assertSchemeImportEnabled(input.schoolId);
  if (!gate.ok) {
    return { ok: false, error: gate.error, status: gate.status };
  }

  const domain = await SchemeImportJob.create({
    schoolId: input.schoolId,
    createdByUserId: input.createdByUserId,
    status: "queued",
    sourceKind: pdfMode ? "pdf_ai" : "spreadsheet",
    fileName: input.fileName,
    fileUrl: input.fileUrl,
    fileKey: input.fileKey ?? null,
    parsedRows: [],
  });

  const queued = await enqueueBackgroundJob({
    kind: "SCHEME_IMPORT",
    schoolId: input.schoolId,
    initiatedByUserId: input.createdByUserId,
    notificationTargetUserId: input.createdByUserId,
    subjectType: "SchemeImportJob",
    subjectId: domain._id,
    idempotencyKey: `scheme-import:${String(input.schoolId)}:${String(domain._id)}`,
    input: { schemeImportJobId: String(domain._id) },
  });

  domain.backgroundJobId = new mongoose.Types.ObjectId(queued.jobId);
  await domain.save();

  return {
    ok: true,
    job: serializeSchemeImportJob(domain.toObject()),
    jobId: queued.jobId,
    schemeImportJobId: String(domain._id),
  };
}
