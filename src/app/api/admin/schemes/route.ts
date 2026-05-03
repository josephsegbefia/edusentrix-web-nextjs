import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { PERMISSIONS } from "@/lib/rbac";
import { listAdminSchemes } from "@/lib/schemes/scheme-review-service";

export async function GET(req: Request) {
  try {
    const actor = await requireSchoolAdminOrDelegatedAnyPermission([
      PERMISSIONS.schemeOfWorkRead,
      PERMISSIONS.schemeOfWorkReview,
    ]);
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const { rows, pagination } = await listAdminSchemes({
      schoolId: actor.schoolId,
      searchParams,
    });
    return Response.json({
      success: true,
      data: rows,
      pagination,
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch schemes" },
      { status: 500 }
    );
  }
}
