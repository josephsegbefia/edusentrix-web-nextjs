import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { serializeExamPaper } from "@/lib/examinations/serializers";
import { ExamPaper } from "@/models/ExamPaper";

export async function GET(req: Request) {
  try {
    const ctx = await requireSchoolAdmin();
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const page = Math.max(Number(searchParams.get("page") || "1"), 1);
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") || "24"), 1),
      100
    );

    const filter = {
      schoolId: ctx.schoolId,
      status: { $in: ["submitted", "needs_revision"] },
    };

    const [papers, total] = await Promise.all([
      ExamPaper.find(filter)
        .sort({ submittedAt: -1, updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ExamPaper.countDocuments(filter),
    ]);

    return Response.json({
      success: true,
      data: papers.map(serializeExamPaper),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch review queue" },
      { status: 500 }
    );
  }
}
