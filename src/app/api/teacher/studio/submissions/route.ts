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

type HomeworkSubjectLean = {
  _id?: mongoose.Types.ObjectId;
  name: string;
};

type HomeworkListLean = {
  _id: mongoose.Types.ObjectId;
  title: string;
  subjectId?: HomeworkSubjectLean | mongoose.Types.ObjectId | null;
  classGroupIds?: mongoose.Types.ObjectId[];
  type: string;
  dueDate?: Date | null;
  status: string;
  maxScore?: number;
};

type SubmissionStudentLean = {
  _id?: mongoose.Types.ObjectId;
  firstName?: string;
  lastName?: string;
  admissionNo?: string | null;
  photoUrl?: string | null;
};

type StudioSubmissionLean = {
  _id: mongoose.Types.ObjectId;
  homeworkId: mongoose.Types.ObjectId;
  status: string;
  submittedAt?: Date | null;
  isLate?: boolean;
  score?: number | null;
  gradedAt?: Date | null;
  publishedAt?: Date | null;
  studentId?: SubmissionStudentLean | mongoose.Types.ObjectId | null;
};

function isPopulatedSubject(
  value: HomeworkListLean["subjectId"]
): value is HomeworkSubjectLean {
  return Boolean(value && typeof value === "object" && "name" in value);
}

function isPopulatedStudent(
  value: StudioSubmissionLean["studentId"]
): value is SubmissionStudentLean {
  return Boolean(value && typeof value === "object" && "firstName" in value);
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
      .lean<HomeworkListLean[]>();

    const homeworkIds = homeworkList.map((hw) => hw._id);
    const submissionQuery: Record<string, unknown> = {
      homeworkId: { $in: homeworkIds },
    };

    if (status) submissionQuery.status = status;

    const submissions = homeworkIds.length
      ? await Submission.find(submissionQuery)
          .populate("studentId", "firstName lastName admissionNo photoUrl")
          .sort({ submittedAt: -1, createdAt: -1 })
          .lean<StudioSubmissionLean[]>()
      : [];

    const homeworkMap = new Map(
      homeworkList.map((homework) => [String(homework._id), homework])
    );

    const data = submissions.map((submission) => {
      const homework = homeworkMap.get(String(submission.homeworkId));
      const student = isPopulatedStudent(submission.studentId)
        ? submission.studentId
        : null;
      const subject = homework && isPopulatedSubject(homework.subjectId)
        ? homework.subjectId
        : null;
      return {
        id: String(submission._id),
        status: submission.status,
        submittedAt: submission.submittedAt ? submission.submittedAt.toISOString() : null,
        isLate: submission.isLate || false,
        score: submission.score ?? null,
        gradedAt: submission.gradedAt ? submission.gradedAt.toISOString() : null,
        publishedAt: submission.publishedAt ? submission.publishedAt.toISOString() : null,
        student: student
          ? {
              id: String(student._id || submission.studentId),
              name: `${student.firstName || ""} ${student.lastName || ""}`.trim(),
              admissionNo: student.admissionNo || undefined,
              photoUrl: student.photoUrl || undefined,
            }
          : null,
        assignment: homework
          ? {
              id: String(homework._id),
              title: homework.title,
              type: homework.type,
              status: homework.status,
              dueDate: homework.dueDate ? homework.dueDate.toISOString() : null,
              subject: subject
                ? {
                    id: String(subject._id || homework.subjectId),
                    name: subject.name,
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
