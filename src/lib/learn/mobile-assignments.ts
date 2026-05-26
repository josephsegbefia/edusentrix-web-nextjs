import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import { getStudentLearnAccess } from "@/lib/learn/access";
import { recordLearnMobileActivity } from "@/lib/learn/mobile-activity";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Homework } from "@/models/Homework";
import { Subject } from "@/models/Subject";
import { Submission } from "@/models/Submission";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";

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
};

type SubmissionRow = {
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

async function serializeAssignment(
  homework: HomeworkRow,
  submission: SubmissionRow | undefined,
  subjectName: string,
  teacherName: string
) {
  const status = mapAssignmentStatus(homework, submission);
  const checklist = defaultChecklist();
  if (status === "in_progress" || status === "submitted" || status === "graded") {
    checklist[0].completed = true;
  }

  return {
    id: String(homework._id),
    title: homework.title,
    subjectId: String(homework.subjectId),
    subjectName,
    teacherName,
    dueAt: homework.dueDate.toISOString(),
    status,
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
  };
}

async function loadVisibleHomework(context: LearnMobileStudentContext) {
  const period = await AcademicPeriod.findOne({
    schoolId: context.schoolId,
    isCurrent: true,
  })
    .select("_id")
    .lean<{ _id: Types.ObjectId } | null>();

  const query: Record<string, unknown> = {
    schoolId: context.schoolId,
    status: { $in: ["published", "closed"] },
    classGroupIds: context.classGroupId,
    $or: [
      { targetStudentIds: { $exists: false } },
      { targetStudentIds: { $size: 0 } },
      { targetStudentIds: context.studentId },
    ],
  };

  if (period?._id) {
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
    schoolId: context.schoolId,
    studentId: context.studentId,
    homeworkId: { $in: homeworkIds },
  })
    .select("homeworkId status submittedAt")
    .lean<SubmissionRow[]>();

  const submissionMap = new Map(submissions.map((s) => [String(s.homeworkId), s]));

  const subjectIds = [...new Set(rows.map((r) => String(r.subjectId)))].map((id) => new Types.ObjectId(id));
  const subjects = await Subject.find({ _id: { $in: subjectIds }, schoolId: context.schoolId })
    .select("name")
    .lean<Array<{ _id: Types.ObjectId; name?: string }>>();
  const subjectMap = new Map(subjects.map((s) => [String(s._id), s.name || "Subject"]));

  const assignments = await Promise.all(
    rows.map(async (homework) => {
      const teacherName = await teacherDisplayName(homework.teacherId);
      const subjectName = subjectMap.get(String(homework.subjectId)) || "Subject";
      return serializeAssignment(
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
  }

  const homework = await Homework.findOne({
    _id: new Types.ObjectId(assignmentId),
    schoolId: context.schoolId,
    status: { $in: ["published", "closed"] },
    classGroupIds: context.classGroupId,
    $or: [
      { targetStudentIds: { $exists: false } },
      { targetStudentIds: { $size: 0 } },
      { targetStudentIds: context.studentId },
    ],
  }).lean<HomeworkRow | null>();

  if (!homework) {
    return { ok: false as const, code: "ASSIGNMENT_NOT_FOUND", message: "Assignment not found.", status: 404 };
  }

  const submission = await Submission.findOne({
    schoolId: context.schoolId,
    studentId: context.studentId,
    homeworkId: homework._id,
  })
    .select("homeworkId status submittedAt")
    .lean<SubmissionRow | null>();

  const subject = await Subject.findOne({ _id: homework.subjectId, schoolId: context.schoolId })
    .select("name")
    .lean<{ name?: string } | null>();

  const teacherName = await teacherDisplayName(homework.teacherId);

  return {
    ok: true as const,
    data: await serializeAssignment(
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

export async function submitMobileAssignment(
  context: LearnMobileStudentContext,
  assignmentId: string,
  body: { answerText?: string; completedChecklistItemIds?: string[] }
) {
  const detail = await buildMobileAssignmentDetail(context, assignmentId);
  if (!detail.ok) return detail;

  const now = new Date();
  const homework = await Homework.findById(assignmentId).select("dueDate").lean<{ dueDate: Date } | null>();
  const isLate = homework ? homework.dueDate < now : false;

  await Submission.findOneAndUpdate(
    {
      schoolId: context.schoolId,
      studentId: context.studentId,
      homeworkId: new Types.ObjectId(assignmentId),
    },
    {
      $set: {
        status: isLate ? "late" : "submitted",
        content: body.answerText?.trim() || "",
        submittedAt: now,
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
