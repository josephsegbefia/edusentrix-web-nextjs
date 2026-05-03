import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { SchemeOfWork, type ISchemeOfWork } from "@/models/SchemeOfWork";
import { serializeSchemeRow } from "@/lib/schemes/serializers";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ClassGroup } from "@/models/ClassGroup";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { assertTeacherSchemeCreationEnabled } from "@/lib/schemes/scheme-import-gate";

const CreateSchemeSchema = z.object({
  title: z.string().trim().min(3).max(220),
  description: z.string().trim().max(8000).optional(),
  academicPeriodId: z.string().trim().optional(),
  academicYearLabel: z.string().trim().max(80).optional(),
  termLabel: z.string().trim().max(80).optional(),
  gradeId: z.string().trim().optional(),
  classGroupId: z.string().trim().optional(),
  subjectId: z.string().trim().optional(),
});

function toObjectIdOrNull(value: string | undefined) {
  if (!value) return null;
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

export async function GET(req: Request) {
  try {
    const ctx = await requireTeacher();
    if (!can(ctx.permissions, PERMISSIONS.schemeOfWorkRead)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const gradeId = toObjectIdOrNull(searchParams.get("gradeId") || undefined);
    const subjectId = toObjectIdOrNull(searchParams.get("subjectId") || undefined);

    const query: Record<string, unknown> = {
      schoolId: ctx.schoolId,
      $or: [
        { ownerTeacherId: ctx.teacherId },
        { status: { $in: ["approved", "active"] } },
      ],
    };
    if (
      status &&
      ["draft", "submitted", "needs_revision", "approved", "active", "archived", "rejected"].includes(status)
    ) {
      query.status = status;
    }
    if (gradeId) query.gradeId = gradeId;
    if (subjectId) query.subjectId = subjectId;

    const docs = (await SchemeOfWork.find(query).sort({ updatedAt: -1 }).limit(120).lean()) as
      | ISchemeOfWork[]
      | [];

    return Response.json({ success: true, data: { schemes: docs.map(serializeSchemeRow) } });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch schemes" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireTeacher();
    if (!can(ctx.permissions, PERMISSIONS.schemeOfWorkCreate)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    await connectToDatabase();
    const gate = await assertTeacherSchemeCreationEnabled(ctx.schoolId, ctx.isAdmin);
    if (!gate.ok) return Response.json({ success: false, error: gate.error }, { status: gate.status });

    const parsed = CreateSchemeSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const academicPeriodId = toObjectIdOrNull(parsed.data.academicPeriodId);
    const gradeId = toObjectIdOrNull(parsed.data.gradeId);
    const classGroupId = toObjectIdOrNull(parsed.data.classGroupId);
    const subjectId = toObjectIdOrNull(parsed.data.subjectId);
    if (parsed.data.academicPeriodId && !academicPeriodId) {
      return Response.json({ success: false, error: "Invalid academicPeriodId" }, { status: 400 });
    }
    if (parsed.data.gradeId && !gradeId) {
      return Response.json({ success: false, error: "Invalid gradeId" }, { status: 400 });
    }
    if (parsed.data.classGroupId && !classGroupId) {
      return Response.json({ success: false, error: "Invalid classGroupId" }, { status: 400 });
    }
    if (parsed.data.subjectId && !subjectId) {
      return Response.json({ success: false, error: "Invalid subjectId" }, { status: 400 });
    }

    const period = academicPeriodId
      ? await AcademicPeriod.findOne({ _id: academicPeriodId, schoolId: ctx.schoolId })
          .select("_id yearLabel term")
          .lean()
      : await AcademicPeriod.findOne({ schoolId: ctx.schoolId, isCurrent: true })
          .select("_id yearLabel term")
          .lean();

    if (!period) {
      return Response.json(
        { success: false, error: "Select or create an academic period before creating a scheme" },
        { status: 400 }
      );
    }

    let effectiveGradeId = gradeId;
    if (classGroupId) {
      const classGroup = await ClassGroup.findOne({ _id: classGroupId, schoolId: ctx.schoolId })
        .select("gradeId")
        .lean<{ gradeId?: mongoose.Types.ObjectId | null }>();
      if (!classGroup) {
        return Response.json({ success: false, error: "Class group not found" }, { status: 400 });
      }
      if (!classGroup.gradeId) {
        return Response.json({ success: false, error: "Class group has no grade" }, { status: 400 });
      }
      effectiveGradeId = classGroup.gradeId;
    }

    if (!ctx.isAdmin) {
      if (!classGroupId || !subjectId) {
        return Response.json(
          { success: false, error: "Select an assigned class and subject for this scheme" },
          { status: 400 }
        );
      }
      const assignment = await TeacherAssignment.exists({
        schoolId: ctx.schoolId,
        teacherId: ctx.teacherId,
        academicPeriodId: period._id,
        classGroupId,
        subjectId,
        status: "active",
      });
      if (!assignment) {
        return Response.json(
          { success: false, error: "You can only create schemes for assigned classes and subjects" },
          { status: 403 }
        );
      }
    }

    const created = await SchemeOfWork.create({
      schoolId: ctx.schoolId,
      title: parsed.data.title,
      description: parsed.data.description || undefined,
      academicPeriodId: period._id,
      academicYearId: period._id,
      termId: period._id,
      academicYearLabel: parsed.data.academicYearLabel || period.yearLabel || undefined,
      termLabel: parsed.data.termLabel || period.term || undefined,
      gradeId: effectiveGradeId,
      classGroupId,
      subjectId,
      ownerTeacherId: ctx.teacherId,
      status: "draft",
      sourceType: "manual",
      version: 1,
      createdByUserId: ctx.userId,
      updatedByUserId: ctx.userId,
    });

    return Response.json({ success: true, data: { scheme: serializeSchemeRow(created.toObject()) } });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create scheme" },
      { status: 500 }
    );
  }
}
