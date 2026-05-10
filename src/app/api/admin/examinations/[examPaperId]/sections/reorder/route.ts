import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { reorderSectionsAction } from "@/lib/examinations/builder-route-actions";
import { parseBuilderId } from "@/lib/examinations/builder-service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ examPaperId: string }> }
) {
  try {
    const ctx = await requireSchoolAdmin();
    await connectToDatabase();
    const { examPaperId } = await params;
    const paperId = parseBuilderId(examPaperId);
    if (!paperId) {
      return Response.json({ success: false, error: "Invalid exam paper id" }, { status: 400 });
    }
    const result = await reorderSectionsAction(
      req,
      { schoolId: ctx.schoolId, userId: ctx.userId },
      paperId
    );
    if ("error" in result) {
      return Response.json({ success: false, error: result.error }, { status: result.status });
    }
    return Response.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to reorder sections" },
      { status: 500 }
    );
  }
}
