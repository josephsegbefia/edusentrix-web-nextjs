import { NextRequest, NextResponse, after } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { LIBRARY_PERMISSIONS } from "@/lib/library/library.permissions";
import { auditLibraryImportCompleted } from "@/lib/library/library-audit";
import { libraryImportBodySchema } from "@/lib/library/library.validators";
import { serializeImportJob } from "@/lib/library/library-import.shared";
import {
  enqueueLibraryImport,
  executeLibraryImportJob,
} from "@/lib/library/library-import.service";
import type { ILibraryImportJob } from "@/models/LibraryImportJob";

function toOid(id: unknown) {
  return new mongoose.Types.ObjectId(String(id));
}

export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireSchoolAdminOrDelegatedAnyPermission([
      LIBRARY_PERMISSIONS.BOOKS_CREATE,
    ]);
    await connectToDatabase();
    const body = (await req.json()) as unknown;
    const parsed = libraryImportBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: parsed.error.message } },
        { status: 400 }
      );
    }
    let job: ILibraryImportJob;
    try {
      job = await enqueueLibraryImport(toOid(schoolId), toOid(userId), parsed.data);
    } catch (err) {
      const m = err instanceof Error ? err.message : "Enqueue failed";
      return NextResponse.json(
        { success: false, error: { code: "validation", message: m } },
        { status: 400 }
      );
    }
    const jobOid = job._id as mongoose.Types.ObjectId;

    after(async () => {
      try {
        await connectToDatabase();
        const finished = await executeLibraryImportJob(toOid(schoolId), jobOid, toOid(userId));
        if (finished) {
          await auditLibraryImportCompleted(req, toOid(schoolId), toOid(userId), jobOid, {
            type: finished.type,
            fileName: finished.fileName,
            status: finished.status,
            totalRows: finished.totalRows,
            successfulRows: finished.successfulRows,
            failedRows: finished.failedRows,
          });
        }
      } catch (e) {
        console.error("library import worker:", e);
      }
    });

    return NextResponse.json(
      { success: true, data: serializeImportJob(job), jobId: String(jobOid) },
      { status: 202 }
    );
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json(
      { success: false, error: { code: "error", message: msg } },
      { status: 500 }
    );
  }
}
