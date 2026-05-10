import type mongoose from "mongoose";
import { SchemeImportJob } from "@/models/SchemeImportJob";
import {
  assertPdfSchemeImportEnabled,
  assertSchemeImportEnabled,
  isTrustedSchemeImportFileUrl,
} from "@/lib/schemes/scheme-import-gate";
import { extractSchemeRowsWithAiFromPdfText } from "@/lib/schemes/scheme-import-pdf-ai";
import { extractTextFromPdfBuffer } from "@/lib/schemes/scheme-import-pdf-text";
import { parseSchemeSpreadsheet } from "@/lib/schemes/scheme-import-parse";
import { serializeSchemeImportJob } from "@/lib/schemes/scheme-import-serialize";

type CreateSchemeImportJobInput = {
  schoolId: mongoose.Types.ObjectId;
  createdByUserId: mongoose.Types.ObjectId;
  fileUrl: string;
  fileName: string;
  fileKey?: string | null;
};

function isPdfFileName(name: string): boolean {
  return name.toLowerCase().trim().endsWith(".pdf");
}

async function downloadImportFile(fileUrl: string): Promise<
  | { ok: true; buffer: Buffer }
  | { ok: false; error: string; status: number }
> {
  if (!isTrustedSchemeImportFileUrl(fileUrl)) {
    return { ok: false, error: "Untrusted file URL", status: 400 };
  }

  try {
    const res = await fetch(fileUrl, {
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      return { ok: false, error: "Could not download uploaded file", status: 502 };
    }
    const maxBytes = 18 * 1024 * 1024;
    const len = Number(res.headers.get("content-length") || 0);
    if (len > maxBytes) {
      return { ok: false, error: "File is too large", status: 400 };
    }
    const ab = await res.arrayBuffer();
    if (ab.byteLength > maxBytes) {
      return { ok: false, error: "File is too large", status: 400 };
    }
    return { ok: true, buffer: Buffer.from(ab) };
  } catch {
    return { ok: false, error: "Failed to fetch uploaded file", status: 502 };
  }
}

async function createFailedImportJob(
  input: CreateSchemeImportJobInput & {
    sourceKind: "pdf_ai" | "spreadsheet";
    parseError: string;
  }
) {
  const job = await SchemeImportJob.create({
    schoolId: input.schoolId,
    createdByUserId: input.createdByUserId,
    status: "failed",
    sourceKind: input.sourceKind,
    fileName: input.fileName,
    fileUrl: input.fileUrl,
    fileKey: input.fileKey ?? null,
    parseError: input.parseError,
    parsedRows: [],
  });
  return serializeSchemeImportJob(job.toObject());
}

export async function createSchemeImportJobFromUpload(input: CreateSchemeImportJobInput): Promise<
  | { ok: true; job: ReturnType<typeof serializeSchemeImportJob> }
  | { ok: false; error: string; status: number }
> {
  const downloaded = await downloadImportFile(input.fileUrl);
  if (!downloaded.ok) return downloaded;

  const pdfMode = isPdfFileName(input.fileName);

  if (pdfMode) {
    const pdfGate = await assertPdfSchemeImportEnabled(input.schoolId);
    if (!pdfGate.ok) {
      return { ok: false, error: pdfGate.error, status: pdfGate.status };
    }

    let rawText: string;
    try {
      rawText = await extractTextFromPdfBuffer(downloaded.buffer);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "PDF read failed";
      const job = await createFailedImportJob({ ...input, sourceKind: "pdf_ai", parseError: msg });
      return { ok: true, job };
    }

    const ai = await extractSchemeRowsWithAiFromPdfText({
      rawText,
      schoolId: input.schoolId,
    });

    if (!ai.ok) {
      const job = await createFailedImportJob({ ...input, sourceKind: "pdf_ai", parseError: ai.error });
      return { ok: true, job };
    }

    if (ai.rows.length === 0) {
      const job = await createFailedImportJob({
        ...input,
        sourceKind: "pdf_ai",
        parseError: "No scheme rows could be extracted - try CSV/XLSX or a clearer PDF",
      });
      return { ok: true, job };
    }

    const job = await SchemeImportJob.create({
      schoolId: input.schoolId,
      createdByUserId: input.createdByUserId,
      status: "parsed",
      sourceKind: "pdf_ai",
      fileName: input.fileName,
      fileUrl: input.fileUrl,
      fileKey: input.fileKey ?? null,
      parsedRows: ai.rows,
    });

    return { ok: true, job: serializeSchemeImportJob(job.toObject()) };
  }

  const gate = await assertSchemeImportEnabled(input.schoolId);
  if (!gate.ok) {
    return { ok: false, error: gate.error, status: gate.status };
  }

  let parsedRows;
  try {
    parsedRows = parseSchemeSpreadsheet(downloaded.buffer, input.fileName);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Parse failed";
    const job = await createFailedImportJob({ ...input, sourceKind: "spreadsheet", parseError: msg });
    return { ok: true, job };
  }

  if (parsedRows.length === 0) {
    const job = await createFailedImportJob({ ...input, sourceKind: "spreadsheet", parseError: "No data rows found" });
    return { ok: true, job };
  }

  const job = await SchemeImportJob.create({
    schoolId: input.schoolId,
    createdByUserId: input.createdByUserId,
    status: "parsed",
    sourceKind: "spreadsheet",
    fileName: input.fileName,
    fileUrl: input.fileUrl,
    fileKey: input.fileKey ?? null,
    parsedRows,
  });

  return { ok: true, job: serializeSchemeImportJob(job.toObject()) };
}
