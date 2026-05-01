import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { SchemeImportJob, type ISchemeImportJob } from "@/models/SchemeImportJob";
import { serializeSchemeImportJob } from "@/lib/schemes/scheme-import-serialize";

function canAccessImportJob(
  ctx: Awaited<ReturnType<typeof requireTeacher>>,
  job: ISchemeImportJob
): boolean {
  if (String(job.schoolId) !== String(ctx.schoolId)) return false;
  if (ctx.isAdmin) return true;
  return String(job.createdByUserId) === String(ctx.userId);
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireTeacher();
    if (!can(ctx.permissions, PERMISSIONS.schemeImportUpload)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    await connectToDatabase();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    const job = await SchemeImportJob.findById(new mongoose.Types.ObjectId(id));
    if (!job || !canAccessImportJob(ctx, job.toObject())) {
      return Response.json({ success: false, error: "Job not found" }, { status: 404 });
    }
    if (job.status !== "parsed") {
      return Response.json(
        { success: false, error: "Only pending previews can be cancelled" },
        { status: 409 }
      );
    }

    job.status = "cancelled";
    await job.save();

    return Response.json({
      success: true,
      data: { job: serializeSchemeImportJob(job.toObject()) },
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Cancel failed" },
      { status: 500 }
    );
  }
}
