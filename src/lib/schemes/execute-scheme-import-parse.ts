import "server-only";

import mongoose from "mongoose";
import { BackgroundJobError } from "@/lib/background/errors";
import type { TrackedJobContext } from "@/lib/background/worker-wrapper";
import { schemeImportActionUrl } from "@/lib/schemes/enqueue-scheme-import-parse";
import { isAiConnectivityError } from "@/lib/schemes/scheme-import-ai-error";
import { downloadSchemeImportFile } from "@/lib/schemes/scheme-import-download";
import {
  assertPdfSchemeImportEnabled,
  assertSchemeImportEnabled,
} from "@/lib/schemes/scheme-import-gate";
import { parseSchemeSpreadsheet } from "@/lib/schemes/scheme-import-parse";
import { resolvePdfSchemeParsedRows } from "@/lib/schemes/scheme-import-pdf-resolve";
import { resolvePdfStructuredRows } from "@/lib/schemes/scheme-import-pdf-structured";
import { extractTextFromPdfBuffer } from "@/lib/schemes/scheme-import-pdf-text";
import { isPdfSource } from "@/lib/schemes/scheme-import-pdf-utils";
import { validateSchemeImportFileBuffer } from "@/lib/schemes/scheme-import-validate-file";
import type { HydratedDocument } from "mongoose";
import {
  SchemeImportJob,
  type ISchemeImportJob,
  type SchemeImportSourceKind,
} from "@/models/SchemeImportJob";

type SchemeImportDoc = HydratedDocument<ISchemeImportJob>;

const TRANSIENT_ERROR_PATTERN =
  /connection|network|timeout|timed out|fetch|socket|econn|etimedout|eai_again|rate limit|429|500|502|503|504/i;

function isTransientError(message: string) {
  return TRANSIENT_ERROR_PATTERN.test(message) || isAiConnectivityError(message);
}

function cleanupParseError(message: string) {
  if (/timed out before the API returned/i.test(message)) {
    return `${message} Large PDFs can take up to 2 minutes per provider. Wait a moment and retry.`;
  }
  if (isAiConnectivityError(message)) {
    return `${message} Leo tried AI extraction first, then fell back to local/manual PDF parsing.`;
  }
  return message;
}

async function persistParsed(
  job: SchemeImportDoc,
  input: {
    sourceKind: SchemeImportSourceKind;
    parsedRows: ISchemeImportJob["parsedRows"];
    parseWarning?: string | null;
  }
) {
  job.status = "parsed";
  job.sourceKind = input.sourceKind;
  job.parsedRows = input.parsedRows;
  job.parseError = null;
  job.parseWarning = input.parseWarning ?? null;
  await job.save();
}

async function persistFailed(job: SchemeImportDoc, parseError: string, sourceKind?: SchemeImportSourceKind) {
  job.status = "failed";
  job.parseError = parseError.slice(0, 4000);
  if (sourceKind) job.sourceKind = sourceKind;
  await job.save();
}

function readyNotification(schemeImportJobId: string) {
  return {
    title: "Scheme import ready",
    body: "Scheme import is ready for review.",
    actionUrl: schemeImportActionUrl(schemeImportJobId),
  };
}

export async function executeSchemeImportParse(
  tracked: TrackedJobContext
): Promise<Record<string, unknown>> {
  const schemeImportJobId =
    typeof tracked.job.input?.schemeImportJobId === "string"
      ? tracked.job.input.schemeImportJobId
      : null;
  if (!schemeImportJobId || !mongoose.Types.ObjectId.isValid(schemeImportJobId)) {
    throw new BackgroundJobError({
      message: "schemeImportJobId is required",
      category: "PREREQUISITE_FAILED",
    });
  }

  const job = await SchemeImportJob.findById(schemeImportJobId);
  if (!job) {
    throw new BackgroundJobError({
      message: "Scheme import job not found",
      category: "PREREQUISITE_FAILED",
    });
  }
  if (String(job.schoolId) !== String(tracked.job.schoolId)) {
    throw new BackgroundJobError({
      message: "Scheme import tenant mismatch",
      category: "PREREQUISITE_FAILED",
    });
  }

  if (["parsed", "confirmed", "cancelled"].includes(job.status)) {
    return {
      schemeImportJobId,
      status: job.status,
      notification: readyNotification(schemeImportJobId),
    };
  }

  if (job.status === "failed" && job.parseError && !isTransientError(job.parseError)) {
    throw new BackgroundJobError({
      message: job.parseError,
      category: "PERMANENT",
    });
  }

  const claimed = await SchemeImportJob.findOneAndUpdate(
    {
      _id: job._id,
      schoolId: job.schoolId,
      status: { $in: ["queued", "parsing", "failed"] },
    },
    { $set: { status: "parsing", parseError: null } },
    { new: true }
  );
  if (!claimed) {
    const latest = await SchemeImportJob.findById(job._id);
    return {
      schemeImportJobId,
      status: latest?.status ?? "unknown",
      notification: readyNotification(schemeImportJobId),
    };
  }

  await tracked.throwIfCancellationRequested();
  await tracked.updateProgress({
    progressPercent: 5,
    progressStage: "loading_file",
    progressMessage: "Loading uploaded scheme file",
  });

  const pdfMode = isPdfSource(claimed.fileName, null);
  if (!claimed.fileUrl) {
    await persistFailed(claimed, "Uploaded file is missing", pdfMode ? "pdf_ai" : "spreadsheet");
    throw new BackgroundJobError({
      message: "Uploaded file is missing",
      category: "PERMANENT",
    });
  }

  const downloaded = await downloadSchemeImportFile({
    fileUrl: claimed.fileUrl,
    fileKey: claimed.fileKey,
    schoolId: String(claimed.schoolId),
    expectPdf: pdfMode,
  });
  if (!downloaded.ok) {
    const transient = downloaded.status >= 500 || isTransientError(downloaded.error);
    if (!transient) {
      await persistFailed(claimed, downloaded.error, pdfMode ? "pdf_ai" : "spreadsheet");
    }
    throw new BackgroundJobError({
      message: downloaded.error,
      category: transient ? "RETRYABLE" : "PERMANENT",
    });
  }

  await tracked.updateProgress({
    progressPercent: 20,
    progressStage: "parsing",
    progressMessage: "Parsing scheme document",
  });

  const layoutCheck = await validateSchemeImportFileBuffer(
    downloaded.buffer,
    claimed.fileName,
    null
  );
  if (!layoutCheck.ok) {
    await persistFailed(claimed, layoutCheck.error, pdfMode ? "pdf_ai" : "spreadsheet");
    throw new BackgroundJobError({
      message: layoutCheck.error,
      category: "PERMANENT",
    });
  }

  if (pdfMode) {
    const pdfGate = await assertPdfSchemeImportEnabled(claimed.schoolId);
    if (!pdfGate.ok) {
      await persistFailed(claimed, pdfGate.error, "pdf_ai");
      throw new BackgroundJobError({
        message: pdfGate.error,
        category: "PERMANENT",
      });
    }

    let rawText: string;
    try {
      rawText = await extractTextFromPdfBuffer(downloaded.buffer);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "PDF read failed";
      if (isTransientError(msg)) {
        throw new BackgroundJobError({ message: msg, category: "RETRYABLE" });
      }
      await persistFailed(claimed, cleanupParseError(msg), "pdf_ai");
      throw new BackgroundJobError({ message: msg, category: "PERMANENT" });
    }

    const aiParsed = await resolvePdfSchemeParsedRows({
      rawText,
      schoolId: claimed.schoolId,
      mode: "ai-only",
    });
    if (aiParsed.ok) {
      await tracked.updateProgress({
        progressPercent: 45,
        progressStage: "validating",
        progressMessage: "Validating extracted rows",
      });
      await tracked.throwIfCancellationRequested();
      await tracked.updateProgress({
        progressPercent: 90,
        progressStage: "saving",
        progressMessage: "Saving parsed scheme",
      });
      await persistParsed(claimed, {
        sourceKind: aiParsed.sourceKind,
        parsedRows: aiParsed.rows,
      });
      return {
        schemeImportJobId,
        status: "parsed",
        rowCount: aiParsed.rows.length,
        notification: readyNotification(schemeImportJobId),
      };
    }

    const aiFailureNote = aiParsed.error;
    if (isTransientError(aiFailureNote)) {
      throw new BackgroundJobError({
        message: aiFailureNote,
        category: "RETRYABLE",
      });
    }

    const structured = await resolvePdfStructuredRows(downloaded.buffer);
    if (structured.ok) {
      const localMethod =
        structured.sourceKind === "pdf_parse_tables"
          ? "pdf-parse table detection"
          : structured.sourceKind === "pdf_text_grid"
            ? "text-based scheme layout detection"
            : "PDFExcavator table detection";
      await tracked.throwIfCancellationRequested();
      await persistParsed(claimed, {
        sourceKind: structured.sourceKind,
        parsedRows: structured.rows,
        parseWarning: `Leo could not extract rows from this PDF (${aiFailureNote}). Rows below were extracted using ${localMethod} — review before confirming.`,
      });
      return {
        schemeImportJobId,
        status: "parsed",
        rowCount: structured.rows.length,
        notification: readyNotification(schemeImportJobId),
      };
    }

    const manualParsed = await resolvePdfSchemeParsedRows({
      rawText,
      schoolId: claimed.schoolId,
      mode: "manual-only",
    });
    if (!manualParsed.ok) {
      const structuredNote = structured.errors.length
        ? ` Local table extraction also failed (${structured.errors.join("; ")}).`
        : "";
      const errMsg = cleanupParseError(`${aiFailureNote}${structuredNote}`);
      await persistFailed(claimed, errMsg, "pdf_ai");
      throw new BackgroundJobError({
        message: errMsg,
        category: isTransientError(errMsg) ? "RETRYABLE" : "PERMANENT",
      });
    }

    const structuredNote = structured.errors.length
      ? ` Local table extraction also failed (${structured.errors.join("; ")}).`
      : "";
    await tracked.throwIfCancellationRequested();
    await persistParsed(claimed, {
      sourceKind: "pdf_manual",
      parsedRows: manualParsed.rows,
      parseWarning: `Leo could not extract rows from this PDF (${aiFailureNote}).${structuredNote} Rows below were extracted by the manual PDF parser — many columns may be empty; review before confirming or re-upload as CSV/XLSX.`,
    });
    return {
      schemeImportJobId,
      status: "parsed",
      rowCount: manualParsed.rows.length,
      notification: readyNotification(schemeImportJobId),
    };
  }

  const gate = await assertSchemeImportEnabled(claimed.schoolId);
  if (!gate.ok) {
    await persistFailed(claimed, gate.error, "spreadsheet");
    throw new BackgroundJobError({
      message: gate.error,
      category: "PERMANENT",
    });
  }

  let parsedRows;
  try {
    parsedRows = parseSchemeSpreadsheet(downloaded.buffer, claimed.fileName);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Parse failed";
    await persistFailed(claimed, cleanupParseError(msg), "spreadsheet");
    throw new BackgroundJobError({
      message: msg,
      category: isTransientError(msg) ? "RETRYABLE" : "PERMANENT",
    });
  }

  if (parsedRows.length === 0) {
    await persistFailed(
      claimed,
      "No data rows found.",
      "spreadsheet"
    );
    throw new BackgroundJobError({
      message: "No data rows found.",
      category: "PERMANENT",
    });
  }

  await tracked.updateProgress({
    progressPercent: 45,
    progressStage: "validating",
    progressMessage: "Validating extracted rows",
  });
  await tracked.throwIfCancellationRequested();
  await tracked.updateProgress({
    progressPercent: 90,
    progressStage: "saving",
    progressMessage: "Saving parsed scheme",
  });
  await persistParsed(claimed, {
    sourceKind: "spreadsheet",
    parsedRows,
  });
  return {
    schemeImportJobId,
    status: "parsed",
    rowCount: parsedRows.length,
    notification: readyNotification(schemeImportJobId),
  };
}
