import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { Homework } from "@/models/Homework";
import { Student } from "@/models/Student";
import { Submission } from "@/models/Submission";
import { requireTeacherStudioFeature } from "@/lib/features/teacherStudio";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

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
        name?: string;
        title?: string;
        maxScore?: number;
        description?: string;
      }>;
    }
  | mongoose.Types.ObjectId;

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
    name?: string;
    title?: string;
    maxScore?: number;
    description?: string;
  }>;
} {
  return Boolean(value && typeof value === "object" && "title" in value);
}

export async function GET(
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

    interface AssignmentLean {
      _id: mongoose.Types.ObjectId;
      title: string;
      instructions?: string | null;
      type: string;
      dueDate?: Date | null;
      status: string;
      maxScore: number;
      latePolicy: string;
      latePenaltyPercent?: number | null;
      attachments?: Array<{
        name: string;
        url: string;
        type: string;
        size?: number;
      }>;
      subjectId?: AssignmentSubjectLean | null;
      rubricId?: AssignmentRubricLean | null;
    }

    const assignment = (await Homework.findOne({
      _id: homeworkId,
      schoolId: context.schoolId,
      status: { $in: ["published", "closed"] },
      classGroupIds: student.classGroupId,
      $or: [
        { targetStudentIds: { $exists: false } },
        { targetStudentIds: { $size: 0 } },
        { targetStudentIds: new mongoose.Types.ObjectId(String(student._id)) },
      ],
    })
      .populate("subjectId", "name")
      .populate("rubricId", "title criteria")
      .lean()) as AssignmentLean | null;

    if (!assignment) {
      return Response.json({ success: false, error: "Assignment not found" }, { status: 404 });
    }

    const submission = await Submission.findOne({
      homeworkId,
      studentId: student._id,
      schoolId: context.schoolId,
    })
      .select(
        "_id content attachments status submittedAt isLate attempts score feedback gradedAt returnedAt returnReason"
      )
      .lean() as {
      _id: mongoose.Types.ObjectId;
      content?: string;
      attachments?: Array<{
        name: string;
        url: string;
        type: string;
        size?: number;
      }>;
      status?: string;
      submittedAt?: Date;
      isLate?: boolean;
      attempts?: number;
      score?: number;
      feedback?: string;
      gradedAt?: Date;
      returnedAt?: Date;
      returnReason?: string;
    } | null;

    return Response.json({
      success: true,
      data: {
        schoolId: String(context.schoolId),
        assignment: {
          id: String(assignment._id),
          title: assignment.title,
          instructions: assignment.instructions,
          type: assignment.type,
          dueDate: assignment.dueDate ? assignment.dueDate.toISOString() : null,
          status: assignment.status,
          maxScore: assignment.maxScore,
          latePolicy: assignment.latePolicy,
          latePenaltyPercent: assignment.latePenaltyPercent ?? null,
          attachments: assignment.attachments || [],
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
        },
        submission: submission
          ? {
              id: String(submission._id),
              content: submission.content || "",
              attachments: submission.attachments || [],
              status: submission.status || "not_started",
              submittedAt: submission.submittedAt
                ? submission.submittedAt.toISOString()
                : null,
              isLate: Boolean(submission.isLate),
              attempts: submission.attempts || 0,
              score: submission.score ?? null,
              feedback: submission.feedback || null,
              gradedAt: submission.gradedAt
                ? submission.gradedAt.toISOString()
                : null,
              returnedAt: submission.returnedAt
                ? submission.returnedAt.toISOString()
                : null,
              returnReason: submission.returnReason || null,
            }
          : null,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to load assignment:", e);
    const message = e instanceof Error ? e.message : "Failed to load assignment";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
