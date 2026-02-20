import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { Homework } from "@/models/Homework";
import { Student } from "@/models/Student";
import { Submission } from "@/models/Submission";
import { requireTeacherStudioFeature } from "@/lib/features/teacherStudio";

const AttachmentSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().url(),
  type: z.string().min(1).max(40),
  size: z.number().min(0).optional(),
});

const QuestionResponseSchema = z.object({
  questionId: z.string().min(1).max(80),
  selectedChoiceId: z.string().min(1).max(80),
});

const SubmissionSchema = z.object({
  content: z.string().max(5000).optional().nullable(),
  attachments: z.array(AttachmentSchema).optional(),
  questionResponses: z.array(QuestionResponseSchema).optional(),
  autoSubmit: z.boolean().optional(),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

type AssignmentQuestionLean = {
  id?: string;
  points?: number;
  choices?: Array<{ id?: string; isCorrect?: boolean }>;
};

type AssignmentLean = {
  _id: mongoose.Types.ObjectId;
  type: string;
  dueDate?: Date | null;
  latePolicy?: "accept" | "reject" | "penalize";
  maxScore: number;
  quizTimeLimitMinutes?: number | null;
  questions?: AssignmentQuestionLean[];
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireSchoolMember({ allowedRoles: ["student"] });
    await connectToDatabase();
    await requireTeacherStudioFeature(context.schoolId);

    const { id } = await ctx.params;
    const homeworkId = toObjectIdOrNull(id);
    if (!homeworkId) {
      return Response.json({ success: false, error: "Invalid assignment ID" }, { status: 400 });
    }

    const student = await Student.findOne({
      userId: context.userId,
      schoolId: context.schoolId,
      status: "active",
    })
      .select("_id classGroupId")
      .lean() as { _id: mongoose.Types.ObjectId; classGroupId: mongoose.Types.ObjectId } | null;

    if (!student) {
      return Response.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    const assignment = (await Homework.findOne({
      _id: homeworkId,
      schoolId: context.schoolId,
      status: "published",
      classGroupIds: student.classGroupId,
      $or: [
        { targetStudentIds: { $exists: false } },
        { targetStudentIds: { $size: 0 } },
        { targetStudentIds: new mongoose.Types.ObjectId(String(student._id)) },
      ],
    })
      .select("_id type dueDate latePolicy maxScore quizTimeLimitMinutes questions")
      .lean()) as AssignmentLean | null;

    if (!assignment) {
      return Response.json({ success: false, error: "Assignment not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const parsed = SubmissionSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const now = new Date();
    const isTimedQuiz =
      assignment.type === "quiz" &&
      typeof assignment.quizTimeLimitMinutes === "number" &&
      assignment.quizTimeLimitMinutes > 0;
    const autoSubmit = Boolean(parsed.data.autoSubmit);
    const isLate = assignment.type === "quiz"
      ? false
      : assignment.dueDate
        ? now > assignment.dueDate
        : false;

    const existing = (await Submission.findOne({
      homeworkId,
      studentId: student._id,
    })
      .select("_id attempts status submittedAt quizStartedAt quizExpiresAt createdAt")
      .lean()) as
      | {
          _id: mongoose.Types.ObjectId;
          attempts: number;
          status?: string;
          submittedAt?: Date;
          quizStartedAt?: Date;
          quizExpiresAt?: Date;
          createdAt?: Date;
        }
      | null;

    let timerStartedAt = existing?.quizStartedAt ?? null;
    let timerExpiresAt = existing?.quizExpiresAt ?? null;
    if (isTimedQuiz) {
      const durationMs = (assignment.quizTimeLimitMinutes || 0) * 60_000;
      const baseStartedAt = timerStartedAt || existing?.createdAt || now;
      timerStartedAt = baseStartedAt;
      timerExpiresAt = timerExpiresAt || new Date(baseStartedAt.getTime() + durationMs);

      const isFinalized =
        Boolean(existing?.submittedAt) &&
        ["submitted", "late", "graded"].includes(existing?.status || "");
      if (isFinalized) {
        return Response.json(
          { success: false, error: "This quiz has already been submitted." },
          { status: 400 }
        );
      }

      if (timerExpiresAt && now.getTime() >= timerExpiresAt.getTime() && !autoSubmit) {
        return Response.json(
          { success: false, error: "Quiz time is up. Submission is locked." },
          { status: 400 }
        );
      }
    }

    if (assignment.type !== "quiz" && isLate && assignment.latePolicy === "reject") {
      return Response.json({ success: false, error: "Late submissions are not allowed" }, { status: 400 });
    }

    const normalizedResponses = parsed.data.questionResponses || [];
    const assignmentQuestionsRaw: Array<{
      id: string;
      points?: number;
      choices?: Array<{ id: string; isCorrect?: boolean }>;
    }> = (assignment.questions || []).map((question) => ({
      id: question.id || "",
      points: question.points,
      choices: (question.choices || []).map((choice, choiceIndex) => ({
        id: choice.id || `choice_${choiceIndex + 1}`,
        isCorrect: choice.isCorrect,
      })),
    }));
    const assignmentQuestions = assignmentQuestionsRaw.map((question, index) => ({
      ...question,
      id: question.id || `question_${index + 1}`,
    }));

    let autoScore: number | null = null;
    let questionResponses: Array<{
      questionId: string;
      selectedChoiceId: string | null;
      isCorrect?: boolean;
      pointsAwarded?: number;
    }> = [];

    if (assignmentQuestions.length > 0) {
      const responseMap = new Map(
        normalizedResponses.map((response) => [response.questionId, response.selectedChoiceId])
      );

      const missingQuestion = assignmentQuestions.find(
        (question) => !responseMap.get(question.id)
      );
      if (missingQuestion && !autoSubmit) {
        return Response.json(
          { success: false, error: "Answer all questions before submitting" },
          { status: 400 }
        );
      }

      const invalidResponse = assignmentQuestions.find((question) => {
        const selectedChoiceId = responseMap.get(question.id);
        if (!selectedChoiceId) return false;
        return !(question.choices || []).some(
          (choice) => choice.id === selectedChoiceId
        );
      });
      if (invalidResponse) {
        return Response.json(
          { success: false, error: "One or more selected answers are invalid" },
          { status: 400 }
        );
      }

      let earnedPoints = 0;
      let totalPoints = 0;

      questionResponses = assignmentQuestions.map((question) => {
        const selectedChoiceId = responseMap.get(question.id) || null;
        const choices = question.choices || [];
        const selectedChoice = choices.find((choice) => choice.id === selectedChoiceId);
        const isCorrect = Boolean(selectedChoice?.isCorrect);
        const points = question.points ?? 1;
        totalPoints += points;
        const pointsAwarded = isCorrect ? points : 0;
        earnedPoints += pointsAwarded;
        return {
          questionId: question.id,
          selectedChoiceId,
          isCorrect,
          pointsAwarded,
        };
      });

      autoScore =
        totalPoints > 0
          ? Number((((earnedPoints / totalPoints) * assignment.maxScore) || 0).toFixed(2))
          : 0;
    }

    const status = assignmentQuestions.length > 0
      ? "graded"
      : isLate
        ? "late"
        : "submitted";

    if (existing) {
      await Submission.updateOne(
        { _id: existing._id },
        {
          $set: {
            content: parsed.data.content || "",
            attachments: parsed.data.attachments || [],
            questionResponses,
            status,
            submittedAt: now,
            isLate,
            score: autoScore ?? undefined,
            gradedAt: assignmentQuestions.length > 0 ? now : undefined,
            publishedAt: assignmentQuestions.length > 0 ? now : undefined,
            ...(isTimedQuiz
              ? {
                  quizStartedAt: timerStartedAt,
                  quizExpiresAt: timerExpiresAt,
                }
              : {}),
            ...(isTimedQuiz && autoSubmit ? { autoSubmittedAt: now } : {}),
          },
          $inc: { attempts: 1 },
        }
      );
    } else {
      await Submission.create({
        homeworkId,
        studentId: student._id,
        schoolId: context.schoolId,
        content: parsed.data.content || "",
        attachments: parsed.data.attachments || [],
        questionResponses,
        status,
        submittedAt: now,
        isLate,
        score: autoScore ?? undefined,
        gradedAt: assignmentQuestions.length > 0 ? now : undefined,
        publishedAt: assignmentQuestions.length > 0 ? now : undefined,
        ...(isTimedQuiz
          ? {
              quizStartedAt: timerStartedAt || now,
              quizExpiresAt: timerExpiresAt,
            }
          : {}),
        ...(isTimedQuiz && autoSubmit ? { autoSubmittedAt: now } : {}),
        attempts: 1,
      });
    }

    const [total, graded] = await Promise.all([
      Submission.countDocuments({ homeworkId }),
      Submission.countDocuments({ homeworkId, status: "graded" }),
    ]);
    await Homework.updateOne(
      { _id: homeworkId },
      { $set: { submissionCount: total, gradedCount: graded } }
    );

    return Response.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to submit assignment:", e);
    const message = e instanceof Error ? e.message : "Failed to submit assignment";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
