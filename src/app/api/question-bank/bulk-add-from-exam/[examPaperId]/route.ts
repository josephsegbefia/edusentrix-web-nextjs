import { connectToDatabase } from "@/db/connectToDatabase";
import {
  createQuestionBankItemsFromExam,
  objectIdOrError,
  requireQuestionBankActor,
} from "@/lib/examinations/question-bank-service";
import { ExamPaper } from "@/models/ExamPaper";

export async function POST(
  _: Request,
  { params }: { params: Promise<{ examPaperId: string }> }
) {
  try {
    const actor = await requireQuestionBankActor();
    await connectToDatabase();
    const { examPaperId } = await params;
    const paperId = objectIdOrError(examPaperId, "Exam paper");
    const paper = await ExamPaper.findOne({
      _id: paperId,
      schoolId: actor.schoolId,
    }).lean();
    if (!paper) {
      return Response.json({ success: false, error: "Exam paper not found" }, { status: 404 });
    }
    if (
      !actor.isAdmin &&
      actor.teacherId &&
      ![
        String(paper.teacherId || ""),
        String(paper.leadSetterId || ""),
        ...paper.contributorIds.map((id) => String(id)),
      ].includes(String(actor.teacherId))
    ) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const result = await createQuestionBankItemsFromExam({
      schoolId: actor.schoolId,
      userId: actor.userId,
      teacherId: actor.teacherId,
      examPaperId: paperId,
      isAdmin: actor.isAdmin,
    });
    if ("error" in result) {
      return Response.json({ success: false, error: result.error }, { status: result.status });
    }
    return Response.json({ success: true, data: result.data }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to add questions to question bank" },
      { status: 500 }
    );
  }
}
