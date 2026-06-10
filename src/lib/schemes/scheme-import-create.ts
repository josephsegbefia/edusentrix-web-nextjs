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
import { resolvePdfStructuredRows } from "@/lib/schemes/scheme-import-pdf-structured";
import { isPdfSource } from "@/lib/schemes/scheme-import-pdf-utils";
import { parseSchemeSpreadsheet } from "@/lib/schemes/scheme-import-parse";
import { serializeSchemeImportJob } from "@/lib/schemes/scheme-import-serialize";
import { validateSchemeImportFileBuffer } from "@/lib/schemes/scheme-import-validate-file";
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
    return `${message} Leo tried AI extraction first, then fell back to local/manual PDF parsing.${suffix}`;
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
    sourceKind:
      | "pdf_ai"
      | "pdf_manual"
      | "pdf_parse_tables"
      | "pdf_excavator"
      | "pdf_text_grid"
      | "spreadsheet";
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

  const layoutCheck = await validateSchemeImportFileBuffer(
    downloaded.buffer,
    input.fileName,
    input.mimeType,
  );
  if (!layoutCheck.ok) {
    await cleanupUploadedImportFile(input);
    return {
      ok: false,
      error: layoutCheck.error,
      status: 422,
    };
  }

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

    console.info("[scheme-import] resolving PDF rows (Leo AI → local tables → manual)…");

    let rawText: string;
    try {
      console.info("[scheme-import] extracting PDF text for Leo…");
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

    const aiParsed = await resolvePdfSchemeParsedRows({
      rawText,
      schoolId: input.schoolId,
      mode: "ai-only",
    });
    console.info("[scheme-import] Leo AI parse result", {
      ok: aiParsed.ok,
      sourceKind: aiParsed.ok ? aiParsed.sourceKind : null,
      rows: aiParsed.ok ? aiParsed.rows.length : 0,
      primaryError: aiParsed.ok ? null : aiParsed.primaryError,
    });

    if (aiParsed.ok) {
      const job = await SchemeImportJob.create({
        schoolId: input.schoolId,
        createdByUserId: input.createdByUserId,
        status: "parsed",
        sourceKind: aiParsed.sourceKind,
        fileName: input.fileName,
        fileUrl: input.fileUrl,
        fileKey: input.fileKey ?? null,
        parseWarning: null,
        parsedRows: aiParsed.rows,
      });
      return { ok: true, job: serializeSchemeImportJob(job.toObject()) };
    }

    const aiFailureNote = aiParsed.error;

    console.info("[scheme-import] Leo AI parse failed; trying local table/text extraction…", {
      error: aiFailureNote,
    });
    const structured = await resolvePdfStructuredRows(downloaded.buffer);
    if (structured.ok) {
      console.info("[scheme-import] structured PDF parse ok", {
        sourceKind: structured.sourceKind,
        rows: structured.rows.length,
      });
      const localMethod =
        structured.sourceKind === "pdf_parse_tables"
          ? "pdf-parse table detection"
          : structured.sourceKind === "pdf_text_grid"
            ? "text-based scheme layout detection"
            : "PDFExcavator table detection";
      const job = await SchemeImportJob.create({
        schoolId: input.schoolId,
        createdByUserId: input.createdByUserId,
        status: "parsed",
        sourceKind: structured.sourceKind,
        fileName: input.fileName,
        fileUrl: input.fileUrl,
        fileKey: input.fileKey ?? null,
        parseWarning: `Leo could not extract rows from this PDF (${aiFailureNote}). Rows below were extracted using ${localMethod} — review before confirming.`,
        parsedRows: structured.rows,
      });
      return { ok: true, job: serializeSchemeImportJob(job.toObject()) };
    }

    console.info("[scheme-import] structured PDF parse failed", { errors: structured.errors });

    const manualParsed = await resolvePdfSchemeParsedRows({
      rawText,
      schoolId: input.schoolId,
      mode: "manual-only",
    });
    console.info("[scheme-import] manual PDF parse result", {
      ok: manualParsed.ok,
      rows: manualParsed.ok ? manualParsed.rows.length : 0,
    });

    if (!manualParsed.ok) {
      const structuredNote = structured.errors.length
        ? ` Local table extraction also failed (${structured.errors.join("; ")}).`
        : "";
      const errMsg = `${aiFailureNote}${structuredNote}`;
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

    const structuredNote = structured.errors.length
      ? ` Local table extraction also failed (${structured.errors.join("; ")}).`
      : "";
    const job = await SchemeImportJob.create({
      schoolId: input.schoolId,
      createdByUserId: input.createdByUserId,
      status: "parsed",
      sourceKind: "pdf_manual",
      fileName: input.fileName,
      fileUrl: input.fileUrl,
      fileKey: input.fileKey ?? null,
      parseWarning: `Leo could not extract rows from this PDF (${aiFailureNote}).${structuredNote} Rows below were extracted by the manual PDF parser — many columns may be empty; review before confirming or re-upload as CSV/XLSX.`,
      parsedRows: manualParsed.rows,
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
