import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
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

const PostBodySchema = z.object({
  fileUrl: z.string().url(),
  fileName: z.string().trim().min(1).max(400),
  fileKey: z.string().trim().max(500).optional(),
});

function isPdfFileName(name: string): boolean {
  return name.toLowerCase().trim().endsWith(".pdf");
}

export async function POST(req: Request) {
  try {
    const ctx = await requireTeacher();
    if (!can(ctx.permissions, PERMISSIONS.schemeImportUpload)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const parsed = PostBodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (!isTrustedSchemeImportFileUrl(parsed.data.fileUrl)) {
      return Response.json({ success: false, error: "Untrusted file URL" }, { status: 400 });
    }

    await connectToDatabase();

    let buffer: Buffer;
    try {
      const res = await fetch(parsed.data.fileUrl, {
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) {
        return Response.json({ success: false, error: "Could not download uploaded file" }, { status: 502 });
      }
      const maxBytes = 18 * 1024 * 1024;
      const len = Number(res.headers.get("content-length") || 0);
      if (len > maxBytes) {
        return Response.json({ success: false, error: "File is too large" }, { status: 400 });
      }
      const ab = await res.arrayBuffer();
      if (ab.byteLength > maxBytes) {
        return Response.json({ success: false, error: "File is too large" }, { status: 400 });
      }
      buffer = Buffer.from(ab);
    } catch {
      return Response.json({ success: false, error: "Failed to fetch uploaded file" }, { status: 502 });
    }

    const pdfMode = isPdfFileName(parsed.data.fileName);

    if (pdfMode) {
      const pdfGate = await assertPdfSchemeImportEnabled(ctx.schoolId);
      if (!pdfGate.ok) {
        return Response.json({ success: false, error: pdfGate.error }, { status: pdfGate.status });
      }

      let rawText: string;
      try {
        rawText = await extractTextFromPdfBuffer(buffer);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "PDF read failed";
        const job = await SchemeImportJob.create({
          schoolId: ctx.schoolId,
          createdByUserId: ctx.userId,
          status: "failed",
          sourceKind: "pdf_ai",
          fileName: parsed.data.fileName,
          fileUrl: parsed.data.fileUrl,
          fileKey: parsed.data.fileKey ?? null,
          parseError: msg,
          parsedRows: [],
        });
        return Response.json({
          success: true,
          data: { job: serializeSchemeImportJob(job.toObject()) },
        });
      }

      const ai = await extractSchemeRowsWithAiFromPdfText({
        rawText,
        schoolId: ctx.schoolId,
      });

      if (!ai.ok) {
        const job = await SchemeImportJob.create({
          schoolId: ctx.schoolId,
          createdByUserId: ctx.userId,
          status: "failed",
          sourceKind: "pdf_ai",
          fileName: parsed.data.fileName,
          fileUrl: parsed.data.fileUrl,
          fileKey: parsed.data.fileKey ?? null,
          parseError: ai.error,
          parsedRows: [],
        });
        return Response.json({
          success: true,
          data: { job: serializeSchemeImportJob(job.toObject()) },
        });
      }

      if (ai.rows.length === 0) {
        const job = await SchemeImportJob.create({
          schoolId: ctx.schoolId,
          createdByUserId: ctx.userId,
          status: "failed",
          sourceKind: "pdf_ai",
          fileName: parsed.data.fileName,
          fileUrl: parsed.data.fileUrl,
          fileKey: parsed.data.fileKey ?? null,
          parseError: "No scheme rows could be extracted — try CSV/XLSX or a clearer PDF",
          parsedRows: [],
        });
        return Response.json({
          success: true,
          data: { job: serializeSchemeImportJob(job.toObject()) },
        });
      }

      const job = await SchemeImportJob.create({
        schoolId: ctx.schoolId,
        createdByUserId: ctx.userId,
        status: "parsed",
        sourceKind: "pdf_ai",
        fileName: parsed.data.fileName,
        fileUrl: parsed.data.fileUrl,
        fileKey: parsed.data.fileKey ?? null,
        parsedRows: ai.rows,
      });

      return Response.json({
        success: true,
        data: { job: serializeSchemeImportJob(job.toObject()) },
      });
    }

    const gate = await assertSchemeImportEnabled(ctx.schoolId);
    if (!gate.ok) {
      return Response.json({ success: false, error: gate.error }, { status: gate.status });
    }

    let parsedRows;
    try {
      parsedRows = parseSchemeSpreadsheet(buffer, parsed.data.fileName);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Parse failed";
      const job = await SchemeImportJob.create({
        schoolId: ctx.schoolId,
        createdByUserId: ctx.userId,
        status: "failed",
        sourceKind: "spreadsheet",
        fileName: parsed.data.fileName,
        fileUrl: parsed.data.fileUrl,
        fileKey: parsed.data.fileKey ?? null,
        parseError: msg,
        parsedRows: [],
      });
      return Response.json({
        success: true,
        data: { job: serializeSchemeImportJob(job.toObject()) },
      });
    }

    if (parsedRows.length === 0) {
      const job = await SchemeImportJob.create({
        schoolId: ctx.schoolId,
        createdByUserId: ctx.userId,
        status: "failed",
        sourceKind: "spreadsheet",
        fileName: parsed.data.fileName,
        fileUrl: parsed.data.fileUrl,
        fileKey: parsed.data.fileKey ?? null,
        parseError: "No data rows found",
        parsedRows: [],
      });
      return Response.json({
        success: true,
        data: { job: serializeSchemeImportJob(job.toObject()) },
      });
    }

    const job = await SchemeImportJob.create({
      schoolId: ctx.schoolId,
      createdByUserId: ctx.userId,
      status: "parsed",
      sourceKind: "spreadsheet",
      fileName: parsed.data.fileName,
      fileUrl: parsed.data.fileUrl,
      fileKey: parsed.data.fileKey ?? null,
      parsedRows,
    });

    return Response.json({
      success: true,
      data: { job: serializeSchemeImportJob(job.toObject()) },
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 }
    );
  }
}
