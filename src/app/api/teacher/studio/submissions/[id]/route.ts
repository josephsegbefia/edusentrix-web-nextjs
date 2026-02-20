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

type SubmissionStudentLean =
  | {
      _id?: mongoose.Types.ObjectId;
      firstName?: string;
      lastName?: string;
      admissionNo?: string;
      photoUrl?: string;
    }
  | mongoose.Types.ObjectId;

type SubmissionLean = {
  _id: mongoose.Types.ObjectId;
  homeworkId: mongoose.Types.ObjectId;
  status: string;
  content?: string;
  attachments?: Array<{ name: string; url: string; type: string; size?: number }>;
  questionResponses?: Array<{
    questionId: string;
    selectedChoiceId?: string | null;
    isCorrect?: boolean | null;
    pointsAwarded?: number | null;
  }>;
  submittedAt?: Date | null;
  isLate?: boolean;
  score?: number | null;
  feedback?: string | null;
  rubricScores?: Record<string, number>;
  gradedAt?: Date | null;
  publishedAt?: Date | null;
  returnedAt?: Date | null;
  returnReason?: string | null;
  studentId?: SubmissionStudentLean | null;
};

type AssignmentSubjectLean =
  | {
      _id?: mongoose.Types.ObjectId;
      name: string;
    }
  | mongoose.Types.ObjectId;

type AssignmentRubricLean =
  | {
      _id?: mongoose.Types.ObjectId;
      title: string;
      criteria?: Array<{
        title?: string;
        description?: string;
        maxScore?: number;
        weight?: number;
      }>;
    }
  | mongoose.Types.ObjectId;

type AssignmentQuestionLean = {
  id?: string;
  prompt: string;
  points: number;
  choices?: Array<{ id?: string; text: string; isCorrect?: boolean }>;
};

type AssignmentLean = {
  _id: mongoose.Types.ObjectId;
  title: string;
  instructions: string;
  status: string;
  dueDate?: Date | null;
  maxScore: number;
  subjectId?: AssignmentSubjectLean | null;
  rubricId?: AssignmentRubricLean | null;
  questions?: AssignmentQuestionLean[];
};

function isPopulatedStudent(
  value: SubmissionStudentLean | null | undefined
): value is {
  _id?: mongoose.Types.ObjectId;
  firstName?: string;
  lastName?: string;
  admissionNo?: string;
  photoUrl?: string;
} {
  return Boolean(value && typeof value === "object" && ("firstName" in value || "lastName" in value));
}

function isPopulatedSubject(
  value: AssignmentSubjectLean | null | undefined
): value is { _id?: mongoose.Types.ObjectId; name: string } {
  return Boolean(value && typeof value === "object" && "name" in value);
}

function isPopulatedRubric(
  value: AssignmentRubricLean | null | undefined
): value is {
  _id?: mongoose.Types.ObjectId;
  title: string;
  criteria?: Array<{
    title?: string;
    description?: string;
    maxScore?: number;
    weight?: number;
  }>;
} {
  return Boolean(value && typeof value === "object" && "title" in value);
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    await requireTeacherStudioAccess(context, PERMISSIONS.assignmentsView);

    const { id } = await ctx.params;
    const submissionId = toObjectIdOrNull(id);

    if (!submissionId) {
      return Response.json({ success: false, error: "Invalid submission ID" }, { status: 400 });
    }

    const submission = (await Submission.findById(submissionId)
      .populate("studentId", "firstName lastName admissionNo photoUrl")
      .lean()) as SubmissionLean | null;

    if (!submission) {
      return Response.json({ success: false, error: "Submission not found" }, { status: 404 });
    }

    const assignment = (await Homework.findOne({
      _id: submission.homeworkId,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    })
      .populate("subjectId", "name")
      .populate("rubricId", "title criteria")
      .lean()) as AssignmentLean | null;

    if (!assignment) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    return Response.json({
      success: true,
      data: {
        submission: {
          id: String(submission._id),
          status: submission.status,
          content: submission.content || "",
          attachments: submission.attachments || [],
          questionResponses: (submission.questionResponses || []).map((response) => ({
            questionId: response.questionId,
            selectedChoiceId: response.selectedChoiceId || null,
            isCorrect: response.isCorrect ?? null,
            pointsAwarded: response.pointsAwarded ?? null,
          })),
          submittedAt: submission.submittedAt ? submission.submittedAt.toISOString() : null,
          isLate: submission.isLate || false,
          score: submission.score ?? null,
          feedback: submission.feedback ?? null,
          rubricScores: submission.rubricScores || {},
          gradedAt: submission.gradedAt ? submission.gradedAt.toISOString() : null,
          publishedAt: submission.publishedAt ? submission.publishedAt.toISOString() : null,
          returnedAt: submission.returnedAt ? submission.returnedAt.toISOString() : null,
          returnReason: submission.returnReason || null,
          student: isPopulatedStudent(submission.studentId)
            ? {
                id: String(submission.studentId._id || submission.studentId),
                name: `${submission.studentId.firstName || ""} ${submission.studentId.lastName || ""}`.trim(),
                admissionNo: submission.studentId.admissionNo || undefined,
                photoUrl: submission.studentId.photoUrl || undefined,
              }
            : null,
        },
        assignment: {
          id: String(assignment._id),
          title: assignment.title,
          instructions: assignment.instructions,
          status: assignment.status,
          dueDate: assignment.dueDate ? assignment.dueDate.toISOString() : null,
          maxScore: assignment.maxScore,
          subject: isPopulatedSubject(assignment.subjectId)
            ? {
                id: String(assignment.subjectId._id || assignment.subjectId),
                name: assignment.subjectId.name,
              }
            : null,
          rubric: isPopulatedRubric(assignment.rubricId)
            ? {
                id: String(assignment.rubricId._id || assignment.rubricId),
                title: assignment.rubricId.title,
                criteria: assignment.rubricId.criteria || [],
              }
            : null,
          questions: (assignment.questions || []).map((question: {
            id?: string;
            prompt: string;
            points: number;
            choices?: Array<{ id?: string; text: string; isCorrect?: boolean }>;
          }, questionIndex: number) => ({
            id: question.id || `question_${questionIndex + 1}`,
            prompt: question.prompt,
            points: question.points,
            choices: (question.choices || []).map((choice, choiceIndex: number) => ({
              id: choice.id || `choice_${choiceIndex + 1}`,
              text: choice.text,
              isCorrect: Boolean(choice.isCorrect),
            })),
          })),
        },
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to load submission:", e);
    const message = e instanceof Error ? e.message : "Failed to load submission";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
