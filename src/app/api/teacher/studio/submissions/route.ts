import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { Homework } from "@/models/Homework";
import { Submission } from "@/models/Submission";
import { requireTeacherStudioAccess } from "@/lib/features/teacherStudio";
import { PERMISSIONS } from "@/lib/rbac";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    await requireTeacherStudioAccess(context, PERMISSIONS.assignmentsView);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const assignmentId = searchParams.get("assignmentId");
    const subjectId = searchParams.get("subjectId");
    const classGroupId = searchParams.get("classGroupId");

    const homeworkQuery: Record<string, unknown> = {
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    };

    if (assignmentId) {
      const homeworkObjId = toObjectIdOrNull(assignmentId);
      if (homeworkObjId) homeworkQuery._id = homeworkObjId;
    }
    if (subjectId) {
      const subjectObjId = toObjectIdOrNull(subjectId);
      if (subjectObjId) homeworkQuery.subjectId = subjectObjId;
    }
    if (classGroupId) {
      const classObjId = toObjectIdOrNull(classGroupId);
      if (classObjId) homeworkQuery.classGroupIds = classObjId;
    }

    const homeworkList = await Homework.find(homeworkQuery)
      .select("_id title subjectId classGroupIds type dueDate status maxScore")
      .populate("subjectId", "name")
      .lean();

    const homeworkIds = homeworkList.map((hw) => hw._id);
    const submissionQuery: Record<string, unknown> = {
      homeworkId: { $in: homeworkIds },
    };

    if (status) submissionQuery.status = status;

    const submissions = homeworkIds.length
      ? await Submission.find(submissionQuery)
          .populate("studentId", "firstName lastName admissionNo photoUrl")
          .sort({ submittedAt: -1, createdAt: -1 })
          .lean()
      : [];

    const homeworkMap = new Map(
      homeworkList.map((hw: any) => [String(hw._id), hw])
    );

    const data = submissions.map((submission: any) => {
      const homework = homeworkMap.get(String(submission.homeworkId));
      return {
        id: String(submission._id),
        status: submission.status,
        submittedAt: submission.submittedAt ? submission.submittedAt.toISOString() : null,
        isLate: submission.isLate || false,
        score: submission.score ?? null,
        gradedAt: submission.gradedAt ? submission.gradedAt.toISOString() : null,
        publishedAt: submission.publishedAt ? submission.publishedAt.toISOString() : null,
        student: submission.studentId
          ? {
              id: String(submission.studentId._id || submission.studentId),
              name: `${submission.studentId.firstName || ""} ${submission.studentId.lastName || ""}`.trim(),
              admissionNo: submission.studentId.admissionNo || undefined,
              photoUrl: submission.studentId.photoUrl || undefined,
            }
          : null,
        assignment: homework
          ? {
              id: String(homework._id),
              title: homework.title,
              type: homework.type,
              status: homework.status,
              dueDate: homework.dueDate ? homework.dueDate.toISOString() : null,
              subject: homework.subjectId
                ? {
                    id: String(homework.subjectId._id || homework.subjectId),
                    name: homework.subjectId.name,
                  }
                : null,
            }
          : null,
      };
    });

    return Response.json({ success: true, data: { submissions: data } });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to load submissions:", e);
    const message = e instanceof Error ? e.message : "Failed to load submissions";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
