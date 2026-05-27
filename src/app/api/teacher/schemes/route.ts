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
import { Grade } from "@/models/Grade";
import { Subject } from "@/models/Subject";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { assertTeacherSchemeCreationEnabled } from "@/lib/schemes/scheme-import-gate";
import { resolveSubjectOfferingForSchool } from "@/lib/subject-offerings/resolve-subject-offering";
import { teacherAssignedSchemeListFilter } from "@/lib/schemes/teacher-assigned-schemes";

export const dynamic = "force-dynamic";

const CreateSchemeSchema = z.object({
  title: z.string().trim().min(3).max(220),
  description: z.string().trim().max(8000).optional(),
  academicPeriodId: z.string().trim().optional(),
  academicYearLabel: z.string().trim().max(80).optional(),
  termLabel: z.string().trim().max(80).optional(),
  gradeId: z.string().trim().optional(),
  classGroupId: z.string().trim().optional(),
  subjectOfferingId: z.string().trim().optional(),
  subjectId: z.string().trim().optional(),
});

function toObjectIdOrNull(value: string | undefined) {
  if (!value) return null;
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

async function serializeTeacherSchemeRows(
  docs: ISchemeOfWork[],
  schoolId: mongoose.Types.ObjectId,
) {
  const gradeIds = [...new Set(docs.map((doc) => doc.gradeId).filter(Boolean).map(String))];
  const subjectIds = [...new Set(docs.map((doc) => doc.subjectId).filter(Boolean).map(String))];
  const periodIds = [
    ...new Set(docs.map((doc) => doc.academicPeriodId).filter(Boolean).map(String)),
  ];

  const [grades, subjects, periods] = await Promise.all([
    gradeIds.length
      ? Grade.find({
          schoolId,
          _id: { $in: gradeIds.map((id) => new mongoose.Types.ObjectId(id)) },
        })
          .select("name")
          .lean()
      : [],
    subjectIds.length
      ? Subject.find({
          schoolId,
          _id: { $in: subjectIds.map((id) => new mongoose.Types.ObjectId(id)) },
        })
          .select("name")
          .lean()
      : [],
    periodIds.length
      ? AcademicPeriod.find({
          schoolId,
          _id: { $in: periodIds.map((id) => new mongoose.Types.ObjectId(id)) },
        })
          .select("yearLabel term")
          .lean()
      : [],
  ]);

  const gradeName = new Map(grades.map((row) => [String(row._id), row.name]));
  const subjectName = new Map(subjects.map((row) => [String(row._id), row.name]));
  const periodLabel = new Map(
    periods.map((row) => [String(row._id), `${row.yearLabel} · ${row.term}`]),
  );

  return docs.map((doc) => ({
    ...serializeSchemeRow(doc),
    gradeName: doc.gradeId ? gradeName.get(String(doc.gradeId)) ?? null : null,
    subjectName: doc.subjectId ? subjectName.get(String(doc.subjectId)) ?? null : null,
    academicPeriodLabel: doc.academicPeriodId
      ? periodLabel.get(String(doc.academicPeriodId)) ?? null
      : null,
  }));
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
    const subjectOfferingId = toObjectIdOrNull(searchParams.get("subjectOfferingId") || undefined);
    const subjectId = toObjectIdOrNull(searchParams.get("subjectId") || undefined);

    const query = await teacherAssignedSchemeListFilter({
      schoolId: ctx.schoolId,
      teacherId: ctx.teacherId,
    });
    if (!query) {
      return Response.json({ success: true, data: { schemes: [] } });
    }
    if (
      status &&
      ["draft", "submitted", "needs_revision", "approved", "active", "archived", "rejected"].includes(status)
    ) {
      query.status = status;
    }
    if (gradeId) query.gradeId = gradeId;
    if (subjectOfferingId) query.subjectOfferingId = subjectOfferingId;
    if (subjectId) query.subjectId = subjectId;

    const docs = (await SchemeOfWork.find(query).sort({ updatedAt: -1 }).limit(120).lean()) as
      | ISchemeOfWork[]
      | [];

    const schemes = await serializeTeacherSchemeRows(docs, ctx.schoolId);
    return Response.json({ success: true, data: { schemes } });
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

    const { requireSchoolFeature } = await import("@/lib/subscriptions/guards");
    const { FEATURE_KEYS } = await import("@/lib/subscriptions/feature-keys");
    const schemeGate = await requireSchoolFeature(ctx.schoolId, FEATURE_KEYS.ACADEMICS_SCHEMES);
    if (schemeGate) return schemeGate;

    if (!ctx.isAdmin) {
      return Response.json(
        { success: false, error: "Only school admins can create or upload schemes of learning." },
        { status: 403 }
      );
    }
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
    const subjectOfferingIdInput = toObjectIdOrNull(parsed.data.subjectOfferingId);
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
    if (parsed.data.subjectOfferingId && !subjectOfferingIdInput) {
      return Response.json({ success: false, error: "Invalid subjectOfferingId" }, { status: 400 });
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

    let effectiveSubjectId = subjectId;
    let effectiveSubjectOfferingId = subjectOfferingIdInput;
    if (effectiveSubjectOfferingId) {
      const offeringResolution = await resolveSubjectOfferingForSchool({
        schoolId: ctx.schoolId,
        subjectOfferingId: effectiveSubjectOfferingId,
        gradeId: effectiveGradeId,
        classGroupId,
        requireClassAssignment: Boolean(classGroupId),
      });
      if (!offeringResolution.ok) {
        return Response.json(
          { success: false, error: offeringResolution.error },
          { status: offeringResolution.status }
        );
      }
      effectiveSubjectId = offeringResolution.offering.subjectId;
      effectiveSubjectOfferingId = offeringResolution.offering._id;
    }

    if (!ctx.isAdmin) {
      if (!effectiveGradeId || !effectiveSubjectId) {
        return Response.json(
          { success: false, error: "Select an assigned grade and subject for this scheme" },
          { status: 400 }
        );
      }
      const gradeClassGroups = await ClassGroup.find({
        schoolId: ctx.schoolId,
        gradeId: effectiveGradeId,
      })
        .select("_id")
        .lean<{ _id: mongoose.Types.ObjectId }[]>();
      if (gradeClassGroups.length === 0) {
        return Response.json(
          { success: false, error: "No class groups exist for this grade" },
          { status: 400 }
        );
      }
      const assignment = await TeacherAssignment.exists({
        schoolId: ctx.schoolId,
        teacherId: ctx.teacherId,
        academicPeriodId: period._id,
        classGroupId: { $in: gradeClassGroups.map((group) => group._id) },
        ...(effectiveSubjectOfferingId
          ? { subjectOfferingId: effectiveSubjectOfferingId }
          : { subjectId: effectiveSubjectId }),
        status: "active",
      });
      if (!assignment) {
        return Response.json(
          { success: false, error: "You can only create schemes for grades and subjects assigned to you" },
          { status: 403 }
        );
      }
    }

    if (!effectiveGradeId || !effectiveSubjectId) {
      return Response.json(
        { success: false, error: "Select a grade and subject for this Scheme of Learning" },
        { status: 400 }
      );
    }

    const existingScheme = await SchemeOfWork.findOne({
      schoolId: ctx.schoolId,
      academicPeriodId: period._id,
      gradeId: effectiveGradeId,
      ...(effectiveSubjectOfferingId ? { subjectOfferingId: effectiveSubjectOfferingId } : {}),
      subjectId: effectiveSubjectId,
      classGroupId: null,
      status: { $in: ["draft", "submitted", "needs_revision", "approved", "active"] },
    })
      .select("_id title status")
      .lean();
    if (existingScheme) {
      return Response.json(
        {
          success: false,
          error: `A scheme already exists for this grade, subject, and period: "${existingScheme.title}". Open it or archive it before creating another.`,
          data: {
            existingScheme: {
              id: String(existingScheme._id),
              title: existingScheme.title,
              status: existingScheme.status,
            },
          },
        },
        { status: 409 }
      );
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
      classGroupId: null,
      ...(effectiveSubjectOfferingId ? { subjectOfferingId: effectiveSubjectOfferingId } : {}),
      subjectId: effectiveSubjectId,
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
