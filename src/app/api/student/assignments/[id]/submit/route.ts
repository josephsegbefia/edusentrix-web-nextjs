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

const SubmissionSchema = z.object({
  content: z.string().max(5000).optional().nullable(),
  attachments: z.array(AttachmentSchema).optional(),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      .select("_id dueDate latePolicy")
      .lean()) as any;

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
    const isLate = assignment.dueDate ? now > assignment.dueDate : false;

    if (isLate && assignment.latePolicy === "reject") {
      return Response.json({ success: false, error: "Late submissions are not allowed" }, { status: 400 });
    }

    const status = isLate ? "late" : "submitted";

    const existing = (await Submission.findOne({
      homeworkId,
      studentId: student._id,
    })
      .select("_id attempts")
      .lean()) as { _id: mongoose.Types.ObjectId; attempts: number } | null;

    if (existing) {
      await Submission.updateOne(
        { _id: existing._id },
        {
          $set: {
            content: parsed.data.content || "",
            attachments: parsed.data.attachments || [],
            status,
            submittedAt: now,
            isLate,
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
        status,
        submittedAt: now,
        isLate,
        attempts: 1,
      });
    }

    const total = await Submission.countDocuments({ homeworkId });
    await Homework.updateOne({ _id: homeworkId }, { $set: { submissionCount: total } });

    return Response.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to submit assignment:", e);
    const message = e instanceof Error ? e.message : "Failed to submit assignment";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
