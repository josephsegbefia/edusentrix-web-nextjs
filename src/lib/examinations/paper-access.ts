import type { Types } from "mongoose";
import type { TeacherContext } from "@/lib/auth/requireTeacher";
import type { IExamPaper } from "@/models/ExamPaper";

export function teacherCanViewExamPaper(
  paper: Pick<
    IExamPaper,
    "createdBy" | "teacherId" | "leadSetterId" | "contributorIds"
  >,
  ctx: TeacherContext
) {
  if (ctx.isAdmin) return true;
  const teacherId = String(ctx.teacherId);
  return (
    String(paper.createdBy) === String(ctx.userId) ||
    String(paper.teacherId || "") === teacherId ||
    String(paper.leadSetterId || "") === teacherId ||
    (paper.contributorIds || []).some(
      (contributorId: Types.ObjectId) => String(contributorId) === teacherId
    )
  );
}

export function teacherCanEditExamPaper(
  paper: Pick<
    IExamPaper,
    "createdBy" | "teacherId" | "leadSetterId" | "contributorIds" | "status"
  >,
  ctx: TeacherContext
) {
  if (!teacherCanViewExamPaper(paper, ctx)) return false;
  return ["draft", "needs_revision"].includes(paper.status);
}
