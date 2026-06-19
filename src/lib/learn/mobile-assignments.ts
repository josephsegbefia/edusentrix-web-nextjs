import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import { getStudentLearnAccess } from "@/lib/learn/access";
import { recordLearnMobileActivity } from "@/lib/learn/mobile-activity";
import {
  buildStudentHomeworkVisibilityInput,
  buildStudentVisibleHomeworkFilter,
} from "@/lib/learn/student-homework-visibility";
import { Homework } from "@/models/Homework";
import { Subject } from "@/models/Subject";
import { SubjectOffering } from "@/models/SubjectOffering";
} from "@/lib/learn/student-homework-visibility";
import { Homework } from "@/models/Homework";
import { Subject } from "@/models/Subject";
import { SubjectOffering } from "@/models/SubjectOffering";
type HomeworkQuestionRow = {
  id: string;
  prompt: string;
  points: number;
  explanation?: string;
  choices: Array<{ id: string; text: string; isCorrect?: boolean }>;
};

type HomeworkRow = {
  _id: Types.ObjectId;
  title: string;
  instructions: string;
  subjectId: Types.ObjectId;
  teacherId: Types.ObjectId;
  dueDate: Date;
  type: string;
  status: string;
  attachments: Array<{ name: string; url: string; type: string }>;
  maxScore: number;
  quizTimeLimitMinutes?: number | null;
  questions?: HomeworkQuestionRow[];
};

type SubmissionRow = {
  homeworkId: Types.ObjectId;
  status: string;
  submittedAt?: Date | null;
  content?: string;
  questionResponses?: Array<{
    questionId: string;
    selectedChoiceId?: string | null;
  }>;
};

function serializeStudentQuestions(questions: HomeworkQuestionRow[] = []) {
  return questions.map((question, questionIndex) => ({
    id: question.id || `question_${questionIndex + 1}`,
    prompt: question.prompt,
    points: question.points ?? 1,
    choices: (question.choices || []).map((choice, choiceIndex) => ({
      id: choice.id || `choice_${choiceIndex + 1}`,
      text: choice.text,
    })),
  }));
}

function serializeSubmissionSnapshot(submission: SubmissionRow | undefined) {
  if (!submission) return null;

  const hasResponses = (submission.questionResponses || []).some(
    (response) => Boolean(response.selectedChoiceId)
  );
  const hasAnswerText = Boolean(submission.content?.trim());

  if (!hasResponses && !hasAnswerText && !submission.submittedAt) {
    return null;
  }

  return {
    answerText: submission.content || "",
    questionResponses: (submission.questionResponses || []).map((response) => ({
      questionId: response.questionId,
      selectedChoiceId: response.selectedChoiceId || null,
    })),
    submittedAt: submission.submittedAt ? submission.submittedAt.toISOString() : null,
  };
}
  homeworkId: Types.ObjectId;
  status: string;
  submittedAt?: Date | null;
};

async function teacherDisplayName(teacherId: Types.ObjectId) {
  const teacher = await Teacher.findById(teacherId).select("userId").lean<{ userId?: Types.ObjectId } | null>();
  if (!teacher?.userId) return "Your teacher";
  const user = await User.findById(teacher.userId)
    .select("firstName lastName name")
    .lean<{ firstName?: string; lastName?: string; name?: string } | null>();
  if (!user) return "Your teacher";
  const parts = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return parts || user.name?.trim() || "Your teacher";
}

function mapAssignmentStatus(
  homework: HomeworkRow,
  submission: SubmissionRow | undefined,
  now = new Date()
): string {
  if (submission?.status === "graded") return "graded";
  if (submission?.status === "submitted" || submission?.status === "late") return "submitted";
  if (homework.dueDate < now && submission?.status !== "submitted") return "overdue";
  if (submission?.status === "draft") return "in_progress";
  return "not_started";
}

function defaultChecklist() {
  return [
    { id: "read", label: "Read the instructions carefully", completed: false },
    { id: "revise", label: "Revise the related class topic", completed: false },
    { id: "answer", label: "Write your own answer", completed: false },
    { id: "check", label: "Check your work before submitting", completed: false },
  ];
}

function mapResources(attachments: HomeworkRow["attachments"]) {
  return attachments.map((file, index) => ({
    id: `resource-${index}`,
    title: file.name,
    type: (file.type === "pdf" || file.type === "image" || file.type === "video"
      ? file.type
      : "link") as "pdf" | "image" | "link" | "note" | "video",
    url: file.url,
  }));
}

  teacherName: string,
  options?: { includeQuestions?: boolean; includeSubmission?: boolean }
) {
  const status = mapAssignmentStatus(homework, submission);
  const checklist = defaultChecklist();
  if (status === "in_progress" || status === "submitted" || status === "graded") {
    checklist[0].completed = true;
  }

  const questions = homework.questions || [];
  const questionCount = questions.length;
  const includeQuestions = options?.includeQuestions ?? false;
  const includeSubmission = options?.includeSubmission ?? false;

  return {
    id: String(homework._id),
    title: homework.title,
    subjectId: String(homework.subjectId),
    subjectName,
    teacherName,
    dueAt: homework.dueDate.toISOString(),
    status,
    assignmentType: homework.type,
    maxScore: homework.maxScore,
    quizTimeLimitMinutes: homework.quizTimeLimitMinutes ?? null,
    questionCount,
    instructions: homework.instructions,
    estimatedMinutes: Math.min(Math.max(Math.round(homework.maxScore / 2), 10), 45),
    resources: mapResources(homework.attachments || []),
    relatedTopics: [
      {
        id: `topic-${String(homework.subjectId)}`,
        title: homework.title,
        masteryStatus: status === "needs_help" ? "needs_revision" : "learning",
      },
    ],
    progressChecklist: checklist,
    leoHelpPrompts: [
      "Explain the assignment instructions simply.",
      "Break this task into smaller steps.",
      "What should I revise before answering?",
      "Give me a hint without writing the full answer.",
    ],
    ...(includeQuestions && questionCount > 0
      ? { questions: serializeStudentQuestions(questions) }
      : {}),
    ...(includeSubmission
      ? { submission: serializeSubmissionSnapshot(submission) }
      : {}),
      "Break this task into smaller steps.",
      "What should I revise before answering?",
      "Give me a hint without writing the full answer.",
async function resolveSubjectName(
  schoolId: Types.ObjectId,
  subjectId: Types.ObjectId,
  fallback = "Subject"
) {
  const offering = await SubjectOffering.findOne({
    schoolId,
    subjectId,
  })
    .select("displayName shortName")
    .lean<{ displayName?: string; shortName?: string } | null>();

  if (offering?.shortName || offering?.displayName) {
    return offering.shortName || offering.displayName || fallback;
  }

  const subject = await Subject.findOne({ _id: subjectId, schoolId })
    .select("name")
    .lean<{ name?: string } | null>();

  return subject?.name || fallback;
}

async function loadVisibleHomework(context: LearnMobileStudentContext) {
  if (!context.classGroupId) return [];

  const visibility = await buildStudentHomeworkVisibilityInput(
    context.schoolId,
    context.studentId,
    context.classGroupId
  );

  return Homework.find(buildStudentVisibleHomeworkFilter(visibility))
    .sort({ dueDate: 1 })
    .lean<HomeworkRow[]>();
    query.academicPeriodId = period._id;
  }

  return Homework.find(query).sort({ dueDate: 1 }).lean<HomeworkRow[]>();
}

export async function buildMobileAssignmentsList(context: LearnMobileStudentContext) {
  await connectToDatabase();

  const access = await getStudentLearnAccess({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
  });

  if (!access.hasAccess) {
    return {
      ok: false as const,
      code: access.schoolEligible ? "LEARN_ACCESS_REQUIRED" : "SCHOOL_NOT_ELIGIBLE",
      message: access.blockedReason || "EduSentrix Learn access is required.",
      status: 403,
    };
  }

  if (!context.classGroupId) {
    return {
      ok: false as const,
      code: "NO_STUDENT_PROFILE",
      message: "Student class group not found.",
      status: 404,
    };
  }

  const rows = await loadVisibleHomework(context);
  const homeworkIds = rows.map((r) => r._id);

  const submissions = await Submission.find({
    .select("homeworkId status submittedAt content questionResponses")
    studentId: context.studentId,
    homeworkId: { $in: homeworkIds },
  })
    .select("homeworkId status submittedAt")
    .lean<SubmissionRow[]>();
  const subjectNames = new Map<string, string>();
  await Promise.all(
    subjectIds.map(async (subjectId) => {
      const name = await resolveSubjectName(
        context.schoolId,
        subjectId,
        "Subject"
      );
      subjectNames.set(String(subjectId), name);
    })
  );

  const assignments = await Promise.all(
    rows.map(async (homework) => {
      const teacherName = await teacherDisplayName(homework.teacherId);
      const subjectName = subjectNames.get(String(homework.subjectId)) || "Subject";
  const assignments = await Promise.all(
    rows.map(async (homework) => {
      const teacherName = await teacherDisplayName(homework.teacherId);
      const subjectName = subjectMap.get(String(homework.subjectId)) || "Subject";
        teacherName,
        { includeQuestions: false, includeSubmission: false }
        homework,
        submissionMap.get(String(homework._id)),
        subjectName,
        teacherName
      );
    })
  );

  return {
    ok: true as const,
    data: {
      header: {
        title: "Assignments",
        leoMessage: "Leo can help you understand the task, plan your steps, and revise first.",
      },
      filters: ["all", "due_soon", "submitted", "needs_help", "overdue"],
      assignments,
    },
  };
}

export async function buildMobileAssignmentDetail(
  context: LearnMobileStudentContext,
  assignmentId: string
) {
  await connectToDatabase();

  if (!Types.ObjectId.isValid(assignmentId)) {
    return { ok: false as const, code: "ASSIGNMENT_NOT_FOUND", message: "Assignment not found.", status: 404 };
  }

  const access = await getStudentLearnAccess({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
  });

  if (!access.hasAccess) {
    return {
      ok: false as const,
      code: "LEARN_ACCESS_REQUIRED",
      message: access.blockedReason || "Learn access required.",
      status: 403,
    };
  }

  if (!context.classGroupId) {
    return { ok: false as const, code: "NO_STUDENT_PROFILE", message: "Profile not found.", status: 404 };
    ...buildStudentVisibleHomeworkFilter(
      await buildStudentHomeworkVisibilityInput(
        context.schoolId,
        context.studentId,
        context.classGroupId
      )
    ),
      { targetStudentIds: { $exists: false } },
      { targetStudentIds: { $size: 0 } },
      { targetStudentIds: context.studentId },
    ],
  }).lean<HomeworkRow | null>();

  if (!homework) {
    return { ok: false as const, code: "ASSIGNMENT_NOT_FOUND", message: "Assignment not found.", status: 404 };
  }

  const submission = await Submission.findOne({
    .select("homeworkId status submittedAt content questionResponses")
    studentId: context.studentId,
    homeworkId: homework._id,
  const subject = await resolveSubjectName(
    context.schoolId,
    homework.subjectId,
    "Subject"
  );

  const teacherName = await teacherDisplayName(homework.teacherId);

  return {
    ok: true as const,
    data: await serializeAssignment(
      homework,
      submission ?? undefined,
      subject,
      teacherName,
      { includeQuestions: true, includeSubmission: true }
      homework,
      submission ?? undefined,
      subject?.name || "Subject",
      teacherName
    ),
  };
}

export async function startMobileAssignment(
  context: LearnMobileStudentContext,
  assignmentId: string
) {
  const detail = await buildMobileAssignmentDetail(context, assignmentId);
  if (!detail.ok) return detail;

  await Submission.findOneAndUpdate(
    {
      schoolId: context.schoolId,
      studentId: context.studentId,
      homeworkId: new Types.ObjectId(assignmentId),
    },
    {
      $setOnInsert: {
        schoolId: context.schoolId,
        studentId: context.studentId,
        homeworkId: new Types.ObjectId(assignmentId),
        attachments: [],
        questionResponses: [],
        attempts: 0,
      },
      $set: { status: "draft" },
    },
    { upsert: true }
  );

  await recordLearnMobileActivity({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
    gradeId: context.gradeId,
    classGroupId: context.classGroupId,
    eventType: "assignment_help",
    topic: detail.data.title,
    metadata: { phase: "started", assignmentId },
  });

  return detail;
}
  body: {
    answerText?: string;
    completedChecklistItemIds?: string[];
    questionResponses?: Array<{ questionId: string; selectedChoiceId: string }>;
  }
) {
  const detail = await buildMobileAssignmentDetail(context, assignmentId);
  if (!detail.ok) return detail;

  const now = new Date();
  const homework = await Homework.findById(assignmentId)
    .select("dueDate type latePolicy maxScore questions")
    .lean<{
      dueDate: Date;
      type: string;
      latePolicy?: string;
      maxScore: number;
      questions?: HomeworkQuestionRow[];
    } | null>();

  if (!homework) {
    return { ok: false as const, code: "ASSIGNMENT_NOT_FOUND", message: "Assignment not found.", status: 404 };
  }

  const assignmentQuestions = serializeStudentQuestions(homework.questions || []);
  const normalizedResponses = body.questionResponses || [];
  const isLate =
    homework.type !== "quiz" && homework.dueDate ? homework.dueDate < now : false;

  if (homework.type !== "quiz" && isLate && homework.latePolicy === "reject") {
    return {
      ok: false as const,
      code: "LATE_SUBMISSION_REJECTED",
      message: "Late submissions are not allowed.",
      status: 400,
    };
  }

  let questionResponses: Array<{
    questionId: string;
    selectedChoiceId: string | null;
    isCorrect?: boolean;
    pointsAwarded?: number;
  }> = [];
  let autoScore: number | null = null;

  if (assignmentQuestions.length > 0) {
    const responseMap = new Map(
      normalizedResponses.map((response) => [response.questionId, response.selectedChoiceId])
    );

    const missingQuestion = assignmentQuestions.find((question) => !responseMap.get(question.id));
    if (missingQuestion) {
      return {
        ok: false as const,
        code: "INCOMPLETE_QUIZ",
        message: "Answer all questions before submitting.",
        status: 400,
      };
    }

    const sourceQuestions = homework.questions || [];
    let earnedPoints = 0;
    let totalPoints = 0;

    questionResponses = assignmentQuestions.map((question, index) => {
      const selectedChoiceId = responseMap.get(question.id) || null;
      const sourceQuestion = sourceQuestions[index];
      const selectedChoice = (sourceQuestion?.choices || []).find(
        (choice) => choice.id === selectedChoiceId
      );
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
        ? Number((((earnedPoints / totalPoints) * homework.maxScore) || 0).toFixed(2))
        : 0;
  }

  const status =
    assignmentQuestions.length > 0 ? "graded" : isLate ? "late" : "submitted";

  await Submission.findOneAndUpdate(
    {
      schoolId: context.schoolId,
      studentId: context.studentId,
      homeworkId: new Types.ObjectId(assignmentId),
    },
    {
      $set: {
        status,
        content: body.answerText?.trim() || "",
        questionResponses,
        submittedAt: now,
        isLate,
        score: autoScore ?? undefined,
        gradedAt: assignmentQuestions.length > 0 ? now : undefined,
        publishedAt: assignmentQuestions.length > 0 ? now : undefined,
      },
      $inc: { attempts: 1 },
    },
    { upsert: true }
  );

  return {
    ok: true as const,
    data: {
      assignmentId,
      submitted: true,
      submittedAt: now.toISOString(),
      score: autoScore,
    data: {
      assignmentId,
      submitted: true,
      submittedAt: now.toISOString(),
    },
  };
}

export function buildLeoHelpResponse(assignmentTitle: string) {
  return {
    message: `Let's work on "${assignmentTitle}" step by step. Read the instructions, revise the class topic, then write your own answer.`,
    suggestedPrompts: [
      "Explain the assignment instructions simply.",
      "Break this into smaller steps.",
      "Give me a hint without writing the full answer.",
      "What should I revise before I start?",
    ],
    sources: [{ title: assignmentTitle, type: "assignment" as const }],
  };
}
