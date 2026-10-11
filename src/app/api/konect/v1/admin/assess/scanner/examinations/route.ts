import { NextResponse } from "next/server";
import { ExamPaper } from "@/models/ExamPaper";
import { scannerContext } from "@/lib/konect/script-submission-service";
import { serializeExamPaper } from "@/lib/examinations/serializers";

export async function GET() {
  const ctx = await scannerContext();
  const papers = await ExamPaper.find({ schoolId: ctx.schoolId, status: { $in: ["approved", "printed", "completed"] } })
    .sort({ scheduledExamDate: -1, updatedAt: -1 }).limit(100).lean();
  return NextResponse.json({ success: true, data: papers.map((paper) => serializeExamPaper(paper)) });
}
