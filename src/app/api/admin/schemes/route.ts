import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { SchemeOfWork, type ISchemeOfWork } from "@/models/SchemeOfWork";
import { serializeSchemeRow } from "@/lib/schemes/serializers";

export async function GET(req: Request) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const query: Record<string, unknown> = { schoolId };
    if (status && ["draft", "in_review", "approved", "active", "archived"].includes(status)) {
      query.status = status;
    }
    const docs = (await SchemeOfWork.find(query).sort({ updatedAt: -1 }).limit(200).lean()) as
      | ISchemeOfWork[]
      | [];
    return Response.json({ success: true, data: { schemes: docs.map(serializeSchemeRow) } });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch schemes" },
      { status: 500 }
    );
  }
}
