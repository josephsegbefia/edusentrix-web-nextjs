import type mongoose from "mongoose";
import { SchemeImportJob } from "@/models/SchemeImportJob";
import {
  assertPdfSchemeImportEnabled,
  assertSchemeImportEnabled,
} from "@/lib/schemes/scheme-import-gate";
import { downloadSchemeImportFile } from "@/lib/schemes/scheme-import-download";
import { isAiConnectivityError } from "@/lib/schemes/scheme-import-ai-error";
import { resolvePdfSchemeParsedRows } from "@/lib/schemes/scheme-import-pdf-resolve";
import { extractTextFromPdfBuffer } from "@/lib/schemes/scheme-import-pdf-text";
import { isPdfSource } from "@/lib/schemes/scheme-import-pdf-utils";
import { parseSchemeSpreadsheet } from "@/lib/schemes/scheme-import-parse";
import { serializeSchemeImportJob } from "@/lib/schemes/scheme-import-serialize";
import { deleteUploadedFile } from "@/lib/uploads/delete";

type CreateSchemeImportJobInput = {
  schoolId: mongoose.Types.ObjectId;
  createdByUserId: mongoose.Types.ObjectId;
  fileUrl: string;
  fileName: string;
  fileKey?: string | null;
  mimeType?: string | null;
};

const TRANSIENT_ERROR_PATTERN =
  /connection|network|timeout|timed out|fetch|socket|econn|etimedout|eai_again|rate limit|429|500|502|503|504/i;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientError(message: string) {
  return TRANSIENT_ERROR_PATTERN.test(message);
}

function shouldKeepUploadedFileOnPdfParseFailure(error: string): boolean {
  if (/monthly ai|entitlement/i.test(error)) {
    return false;
  }
  return true;
}

function cleanupParseError(message: string, options?: { fileRemoved: boolean }) {
  const fileRemoved = options?.fileRemoved !== false;
  const suffix = fileRemoved
    ? " The uploaded file was removed because the import did not complete."
    : " Your uploaded file was kept — use Retry import without re-uploading after fixing the issue below.";

  if (/timed out before the API returned/i.test(message)) {
    return `${message} Large PDFs can take up to 2 minutes per provider. Wait a moment and retry.${suffix}`;
  }
  if (isAiConnectivityError(message)) {
    return `${message} The app tried OpenAI first, then attempted manual PDF parsing.${suffix}`;
  }
  return `${message}${suffix}`;
}

async function cleanupUploadedImportFile(input: CreateSchemeImportJobInput) {
  const deleted = await deleteUploadedFile(input.fileUrl);
  if (!deleted) {
    console.error("Scheme import upload cleanup failed:", {
      fileUrl: input.fileUrl,
      fileKey: input.fileKey ?? null,
    });
  }
  return deleted;
}

async function retryTransient<T>(
  operation: () => Promise<T>,
  isRetryableResult: (result: T) => boolean,
) {
  const delays = [700, 1_800];
  let result = await operation();
  for (const delay of delays) {
    if (!isRetryableResult(result)) break;
    await sleep(delay);
    result = await operation();
  }
  return result;
}

async function createFailedImportJob(
  input: CreateSchemeImportJobInput & {
    sourceKind: "pdf_ai" | "pdf_manual" | "spreadsheet";
    parseError: string;
    keepUploadedFile?: boolean;
  }
) {
  const job = await SchemeImportJob.create({
    schoolId: input.schoolId,
    createdByUserId: input.createdByUserId,
    status: "failed",
    sourceKind: input.sourceKind,
    fileName: input.fileName,
    fileUrl: input.keepUploadedFile ? input.fileUrl : null,
    fileKey: input.keepUploadedFile ? input.fileKey ?? null : null,
    parseError: input.parseError,
    parsedRows: [],
  });
  return serializeSchemeImportJob(job.toObject());
}

export async function createSchemeImportJobFromUpload(input: CreateSchemeImportJobInput): Promise<
  | { ok: true; job: ReturnType<typeof serializeSchemeImportJob> }
  | { ok: false; error: string; status: number }
> {
  const pdfMode = isPdfSource(input.fileName, input.mimeType);

  const downloaded = await retryTransient(
    () =>
      downloadSchemeImportFile({
        fileUrl: input.fileUrl,
        fileKey: input.fileKey,
        expectPdf: pdfMode,
      }),
    (result) => !result.ok && result.status >= 500,
  );
  if (!downloaded.ok) {
    await cleanupUploadedImportFile(input);
    return {
      ...downloaded,
      error: `${downloaded.error}. The uploaded file was removed because the import did not complete.`,
    };
  }

  console.info("[scheme-import] downloaded", {
    fileName: input.fileName,
    pdfMode,
    bytes: downloaded.buffer.length,
  });

  if (pdfMode) {
    const pdfGate = await assertPdfSchemeImportEnabled(input.schoolId);
    if (!pdfGate.ok) {
      await cleanupUploadedImportFile(input);
      return {
        ok: false,
        error: `${pdfGate.error} The uploaded file was removed because the import did not complete.`,
        status: pdfGate.status,
      };
    }

    let rawText: string;
    try {
      console.info("[scheme-import] extracting PDF text…");
      rawText = await extractTextFromPdfBuffer(downloaded.buffer);
      console.info("[scheme-import] PDF text chars", rawText.length);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "PDF read failed";
      await cleanupUploadedImportFile(input);
      const job = await createFailedImportJob({
        ...input,
        sourceKind: "pdf_ai",
        parseError: cleanupParseError(msg),
      });
      return { ok: true, job };
    }

    console.info("[scheme-import] resolving PDF rows (OpenAI, then manual fallback)…");
    const parsed = await resolvePdfSchemeParsedRows({
      rawText,
      schoolId: input.schoolId,
    });
    console.info("[scheme-import] PDF parse result", {
      ok: parsed.ok,
      sourceKind: parsed.ok ? parsed.sourceKind : null,
      rows: parsed.ok ? parsed.rows.length : 0,
      primaryError: parsed.ok ? parsed.primaryError : parsed.primaryError,
    });

    if (!parsed.ok) {
      const errMsg = parsed.error;
      const keepFile = shouldKeepUploadedFileOnPdfParseFailure(errMsg);
      if (!keepFile) {
        await cleanupUploadedImportFile(input);
      }
      const job = await createFailedImportJob({
        ...input,
        sourceKind: "pdf_ai",
        keepUploadedFile: keepFile,
        parseError: cleanupParseError(errMsg, { fileRemoved: !keepFile }),
      });
      return { ok: true, job };
    }

    const parseWarning =
      parsed.sourceKind === "pdf_manual" && parsed.primaryError
        ? `OpenAI could not extract rows (${parsed.primaryError}). Rows below were extracted by the manual PDF parser — review before confirming.`
        : parsed.sourceKind === "pdf_manual"
          ? "Rows were extracted by the manual PDF parser. Review each row before confirming."
          : null;

    const job = await SchemeImportJob.create({
      schoolId: input.schoolId,
      createdByUserId: input.createdByUserId,
      status: "parsed",
      sourceKind: parsed.sourceKind,
      fileName: input.fileName,
      fileUrl: input.fileUrl,
      fileKey: input.fileKey ?? null,
      parseWarning,
      parsedRows: parsed.rows,
    });

    return { ok: true, job: serializeSchemeImportJob(job.toObject()) };
  }

  const gate = await assertSchemeImportEnabled(input.schoolId);
  if (!gate.ok) {
    await cleanupUploadedImportFile(input);
    return {
      ok: false,
      error: `${gate.error} The uploaded file was removed because the import did not complete.`,
      status: gate.status,
    };
  }

  let parsedRows;
  try {
    parsedRows = parseSchemeSpreadsheet(downloaded.buffer, input.fileName);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Parse failed";
    await cleanupUploadedImportFile(input);
    const job = await createFailedImportJob({
      ...input,
      sourceKind: "spreadsheet",
      parseError: cleanupParseError(msg),
    });
    return { ok: true, job };
  }

  if (parsedRows.length === 0) {
    await cleanupUploadedImportFile(input);
    const job = await createFailedImportJob({
      ...input,
      sourceKind: "spreadsheet",
      parseError:
        "No data rows found. The uploaded file was removed because the import did not complete.",
    });
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
