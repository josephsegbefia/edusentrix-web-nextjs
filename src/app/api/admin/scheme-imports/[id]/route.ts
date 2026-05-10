import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { PERMISSIONS } from "@/lib/rbac";
import { SchemeImportJob, type ISchemeImportJob } from "@/models/SchemeImportJob";
import { serializeSchemeImportJob } from "@/lib/schemes/scheme-import-serialize";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireSchoolAdminOrDelegatedAnyPermission([
      PERMISSIONS.schemeImportUpload,
      PERMISSIONS.schemeOfWorkReview,
    ]);
    await connectToDatabase();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    const job = (await SchemeImportJob.findOne({
      _id: new mongoose.Types.ObjectId(id),
      schoolId: ctx.schoolId,
    }).lean()) as ISchemeImportJob | null;
    if (!job) {
      return Response.json({ success: false, error: "Job not found" }, { status: 404 });
    }

    return Response.json({ success: true, data: { job: serializeSchemeImportJob(job) } });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load job" },
      { status: 500 }
    );
  }
}
