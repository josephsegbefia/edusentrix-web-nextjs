import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { LIBRARY_PERMISSIONS } from "@/lib/library/library.permissions";
import { serializeImportJob } from "@/lib/library/library-import.shared";
import { getLibraryImportJob } from "@/lib/library/library-import.service";

function toOid(id: unknown) {
  return new mongoose.Types.ObjectId(String(id));
}

type RouteCtx = { params: Promise<{ jobId: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedAnyPermission([
      LIBRARY_PERMISSIONS.BOOKS_CREATE,
      LIBRARY_PERMISSIONS.BOOKS_READ,
    ]);
    const { jobId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: "Invalid job id" } },
        { status: 400 }
      );
    }
    await connectToDatabase();
    const job = await getLibraryImportJob(toOid(schoolId), new mongoose.Types.ObjectId(jobId));
    if (!job) {
      return NextResponse.json(
        { success: false, error: { code: "not_found", message: "Job not found" } },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: serializeImportJob(job) });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json(
      { success: false, error: { code: "error", message: msg } },
      { status: 500 }
    );
  }
}
