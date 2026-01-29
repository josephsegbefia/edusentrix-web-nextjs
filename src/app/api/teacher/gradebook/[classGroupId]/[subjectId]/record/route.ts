import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Assessment } from "@/models/Assessment";
import { ClassGroup } from "@/models/ClassGroup";
import { Student } from "@/models/Student";
import { Subject } from "@/models/Subject";
import { TeacherAssignment } from "@/models/TeacherAssignment";

const AssessmentSchema = z.object({
  assessmentType: z.enum(["ca", "quiz", "assignment", "midterm", "exam", "project", "mock"]),
  title: z.string().min(1).max(160),
  maxScore: z.number().min(1).max(1000),
  weight: z.number().min(0).max(1).optional().nullable(),
});

const RecordSchema = z.object({
  studentId: z.string().min(1),
  score: z.number().min(0).nullable(),
});

const RequestSchema = z.object({
  assessment: AssessmentSchema,
  records: z.array(RecordSchema).min(1),
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
  ctx: { params: Promise<{ classGroupId: string; subjectId: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.gradebookRecord)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { classGroupId, subjectId } = await ctx.params;
    const classGroupObjId = toObjectIdOrNull(classGroupId);
    const subjectObjId = toObjectIdOrNull(subjectId);

    if (!classGroupObjId || !subjectObjId) {
      return Response.json(
        { success: false, error: "Invalid class group or subject" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const period = await AcademicPeriod.findOne({
      schoolId: context.schoolId,
      isCurrent: true,
    })
      .select("_id")
      .lean();

    if (!period) {
      return Response.json(
        { success: false, error: "No active academic period" },
        { status: 400 }
      );
    }

    const [classGroup, subject] = await Promise.all([
      ClassGroup.findOne({ _id: classGroupObjId, schoolId: context.schoolId })
        .select("_id")
        .lean(),
      Subject.findOne({ _id: subjectObjId, schoolId: context.schoolId })
        .select("_id")
        .lean(),
    ]);

    if (!classGroup || !subject) {
      return Response.json(
        { success: false, error: "Class group or subject not found" },
        { status: 404 }
      );
    }

    if (!context.isAdmin) {
      const assignment = await TeacherAssignment.findOne({
        schoolId: context.schoolId,
        teacherId: context.teacherId,
        classGroupId: classGroupObjId,
        subjectId: subjectObjId,
        academicPeriodId: period._id,
        status: "active",
      })
        .select("_id")
        .lean();

      if (!assignment) {
        return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
    }

    const studentIds = parsed.data.records
      .map((record) => toObjectIdOrNull(record.studentId))
      .filter(Boolean) as mongoose.Types.ObjectId[];

    const students = await Student.find({
      _id: { $in: studentIds },
      schoolId: context.schoolId,
      classGroupId: classGroupObjId,
      status: "active",
    })
      .select("_id")
      .lean();

    if (students.length !== studentIds.length) {
      return Response.json(
        { success: false, error: "One or more students are invalid" },
        { status: 400 }
      );
    }

    const assessment = parsed.data.assessment;
    const weight = assessment.weight ?? 1;

    const operations = parsed.data.records.map((record) => {
      if (record.score !== null && record.score > assessment.maxScore) {
        throw Response.json(
          { success: false, error: "Score cannot exceed max score" },
          { status: 400 }
        );
      }

      const studentObjId = toObjectIdOrNull(record.studentId);
      if (!studentObjId) return null;

      if (record.score === null) {
        return {
          deleteOne: {
            filter: {
              schoolId: context.schoolId,
              academicPeriodId: period._id,
              subjectId: subjectObjId,
              studentId: studentObjId,
              assessmentType: assessment.assessmentType,
              title: assessment.title,
              maxScore: assessment.maxScore,
              weight,
              ...(context.isAdmin ? {} : { teacherId: context.teacherId }),
            },
          },
        } as const;
      }

      const percentage = assessment.maxScore > 0 ? (record.score / assessment.maxScore) * 100 : 0;

      return {
        updateOne: {
          filter: {
            schoolId: context.schoolId,
            academicPeriodId: period._id,
            subjectId: subjectObjId,
            studentId: studentObjId,
            assessmentType: assessment.assessmentType,
            title: assessment.title,
            maxScore: assessment.maxScore,
            weight,
            ...(context.isAdmin ? {} : { teacherId: context.teacherId }),
          },
          update: {
            $set: {
              score: record.score,
              percentage,
              assessmentType: assessment.assessmentType,
              title: assessment.title,
              maxScore: assessment.maxScore,
              weight,
              teacherId: context.teacherId,
            },
            $setOnInsert: {
              schoolId: context.schoolId,
              academicPeriodId: period._id,
              subjectId: subjectObjId,
              studentId: studentObjId,
              teacherId: context.teacherId,
              assessmentType: assessment.assessmentType,
              title: assessment.title,
              maxScore: assessment.maxScore,
              weight,
            },
          },
          upsert: true,
        },
      } as const;
    });

    const validOps = operations.filter(Boolean) as Array<
      | { updateOne: { filter: Record<string, unknown>; update: Record<string, unknown>; upsert: boolean } }
      | { deleteOne: { filter: Record<string, unknown> } }
    >;

    if (validOps.length === 0) {
      return Response.json(
        { success: false, error: "No valid records to update" },
        { status: 400 }
      );
    }

    await Assessment.bulkWrite(validOps, { ordered: false });

    return Response.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to record gradebook marks:", e);
    const message = e instanceof Error ? e.message : "Failed to record marks";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
