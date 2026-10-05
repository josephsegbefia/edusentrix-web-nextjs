import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { PERMISSIONS } from "@/lib/rbac";
import { cancelSchemeImportJob } from "@/lib/schemes/cancel-scheme-import";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireSchoolAdminOrDelegatedAnyPermission([
      PERMISSIONS.schemeImportUpload,
      PERMISSIONS.schemeOfWorkCreate,
      PERMISSIONS.schemeOfWorkReview,
    ]);
    await connectToDatabase();
    const { id } = await params;
    const result = await cancelSchemeImportJob({
      schoolId: ctx.schoolId,
      jobId: id,
      actorUserId: ctx.userId,
      isSchoolAdmin: true,
    });
    if (!result.ok) {
      return Response.json({ success: false, error: result.error }, { status: result.status });
    }
    return Response.json({
      success: true,
      data: { job: result.job },
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Cancel failed" },
      { status: 500 }
    );
  }
}
