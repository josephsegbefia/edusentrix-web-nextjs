import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { parseExamPaperId } from "@/lib/examinations/paper-detail";
import { approveExamPaper } from "@/lib/examinations/paper-lifecycle";

const approveSchema = z.object({
  comment: z.string().trim().max(8000).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ examPaperId: string }> }
) {
  try {
    const ctx = await requireSchoolAdmin();
    await connectToDatabase();
    const { examPaperId } = await params;
    const paperId = parseExamPaperId(examPaperId);
    if (!paperId) {
      return Response.json({ success: false, error: "Invalid exam paper id" }, { status: 400 });
    }
    const parsed = approveSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json({ success: false, error: "Validation failed" }, { status: 400 });
    }

    const result = await approveExamPaper({
      schoolId: ctx.schoolId,
      examPaperId: paperId,
      userId: ctx.userId,
      comment: parsed.data.comment,
    });
    if ("error" in result) {
      return Response.json({ success: false, error: result.error }, { status: result.status });
    }
    return Response.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to approve exam paper" },
      { status: 500 }
    );
  }
}
