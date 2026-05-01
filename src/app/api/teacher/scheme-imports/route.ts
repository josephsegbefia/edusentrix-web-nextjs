import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { SchemeImportJob } from "@/models/SchemeImportJob";
import { assertSchemeImportEnabled, isTrustedSchemeImportFileUrl } from "@/lib/schemes/scheme-import-gate";
import { parseSchemeSpreadsheet } from "@/lib/schemes/scheme-import-parse";
import { serializeSchemeImportJob } from "@/lib/schemes/scheme-import-serialize";

const PostBodySchema = z.object({
  fileUrl: z.string().url(),
  fileName: z.string().trim().min(1).max(400),
  fileKey: z.string().trim().max(500).optional(),
});

export async function POST(req: Request) {
  try {
    const ctx = await requireTeacher();
    if (!can(ctx.permissions, PERMISSIONS.schemeImportUpload)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const gate = await assertSchemeImportEnabled(ctx.schoolId);
    if (!gate.ok) {
      return Response.json({ success: false, error: gate.error }, { status: gate.status });
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

    let parsedRows;
    try {
      parsedRows = parseSchemeSpreadsheet(buffer, parsed.data.fileName);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Parse failed";
      const job = await SchemeImportJob.create({
        schoolId: ctx.schoolId,
        createdByUserId: ctx.userId,
        status: "failed",
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
