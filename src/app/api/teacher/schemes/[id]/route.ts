import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { Curriculum } from "@/models/Curriculum";
import { CurriculumSubject } from "@/models/CurriculumSubject";
import { SchemeOfWork, type ISchemeOfWork } from "@/models/SchemeOfWork";
import { serializeSchemeRow } from "@/lib/schemes/serializers";
import { deleteSchemeForSchool } from "@/lib/schemes/scheme-review-service";
import {
  teacherMayDeleteScheme,
  teacherMayEditScheme,
} from "@/lib/schemes/teacher-scheme-access";
import { teacherCanReadAssignedScheme } from "@/lib/schemes/teacher-assigned-schemes";

const PatchSchemeSchema = z.object({
  title: z.string().trim().min(3).max(220).optional(),
  description: z.string().trim().max(8000).nullable().optional(),
  academicYearLabel: z.string().trim().max(80).nullable().optional(),
  termLabel: z.string().trim().max(80).nullable().optional(),
  academicPeriodId: z.string().trim().nullable().optional(),
  curriculumId: z.string().trim().nullable().optional(),
  curriculumSubjectId: z.string().trim().nullable().optional(),
  gradeId: z.string().trim().nullable().optional(),
  classGroupId: z.string().trim().nullable().optional(),
  subjectId: z.string().trim().nullable().optional(),
});

function parseId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireTeacher();
    if (!can(ctx.permissions, PERMISSIONS.schemeOfWorkRead)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    await connectToDatabase();
    const { id } = await params;
    const schemeId = parseId(id);
    if (!schemeId) return Response.json({ success: false, error: "Invalid scheme id" }, { status: 400 });

    const doc = (await SchemeOfWork.findOne({
      _id: schemeId,
      schoolId: ctx.schoolId,
    }).lean()) as ISchemeOfWork | null;

    if (!doc) return Response.json({ success: false, error: "Scheme not found" }, { status: 404 });
    if (
      !ctx.isAdmin &&
      !(await teacherCanReadAssignedScheme(doc, {
        schoolId: ctx.schoolId,
        teacherId: ctx.teacherId,
      }))
    ) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    return Response.json({ success: true, data: { scheme: serializeSchemeRow(doc) } });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch scheme" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireTeacher();
    if (!ctx.isAdmin) {
      return Response.json(
        { success: false, error: "Only school admins can edit schemes of learning." },
        { status: 403 }
      );
    }
    if (!can(ctx.permissions, PERMISSIONS.schemeOfWorkUpdate)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    await connectToDatabase();
    const { id } = await params;
    const schemeId = parseId(id);
    if (!schemeId) return Response.json({ success: false, error: "Invalid scheme id" }, { status: 400 });

    const existing = (await SchemeOfWork.findOne({
      _id: schemeId,
      schoolId: ctx.schoolId,
    })) as ISchemeOfWork | null;
    if (!existing) return Response.json({ success: false, error: "Scheme not found" }, { status: 404 });
    if (!teacherMayEditScheme(existing, ctx)) {
      return Response.json({ success: false, error: "Not allowed to edit this scheme" }, { status: 403 });
    }
    if (existing.status !== "draft" && existing.status !== "needs_revision") {
      return Response.json(
        { success: false, error: "Only draft or revision-requested schemes can be edited" },
        { status: 409 }
      );
    }

    const parsed = PatchSchemeSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const setData: Record<string, unknown> = { updatedByUserId: ctx.userId };
    if (parsed.data.title !== undefined) setData.title = parsed.data.title;
    if (parsed.data.description !== undefined) setData.description = parsed.data.description;
    if (parsed.data.academicYearLabel !== undefined)
      setData.academicYearLabel = parsed.data.academicYearLabel;
    if (parsed.data.termLabel !== undefined) setData.termLabel = parsed.data.termLabel;
    if (parsed.data.gradeId !== undefined) {
      if (parsed.data.gradeId === null || parsed.data.gradeId === "") setData.gradeId = null;
      else {
        const gid = parseId(parsed.data.gradeId);
        if (!gid) return Response.json({ success: false, error: "Invalid gradeId" }, { status: 400 });
        setData.gradeId = gid;
      }
    }
    if (parsed.data.classGroupId !== undefined) {
      if (parsed.data.classGroupId === null || parsed.data.classGroupId === "") setData.classGroupId = null;
      else {
        const cid = parseId(parsed.data.classGroupId);
        if (!cid) return Response.json({ success: false, error: "Invalid classGroupId" }, { status: 400 });
        setData.classGroupId = cid;
      }
    }
    if (parsed.data.subjectId !== undefined) {
      if (parsed.data.subjectId === null || parsed.data.subjectId === "") setData.subjectId = null;
      else {
        const sid = parseId(parsed.data.subjectId);
        if (!sid) return Response.json({ success: false, error: "Invalid subjectId" }, { status: 400 });
        setData.subjectId = sid;
      }
    }

    if (parsed.data.curriculumId !== undefined) {
      if (parsed.data.curriculumId === null || parsed.data.curriculumId === "") {
        setData.curriculumId = null;
        setData.curriculumSubjectId = null;
      } else {
        const cid = parseId(parsed.data.curriculumId);
        if (!cid) return Response.json({ success: false, error: "Invalid curriculumId" }, { status: 400 });
        const cur = await Curriculum.findOne({ _id: cid, schoolId: ctx.schoolId }).select("_id").lean();
        if (!cur) return Response.json({ success: false, error: "Curriculum not found" }, { status: 400 });
        setData.curriculumId = cid;
        const curriculumChanged = String(existing.curriculumId || "") !== String(cid);
        if (curriculumChanged && parsed.data.curriculumSubjectId === undefined) {
          setData.curriculumSubjectId = null;
        }
      }
    }

    if (parsed.data.curriculumSubjectId !== undefined) {
      if (parsed.data.curriculumSubjectId === null || parsed.data.curriculumSubjectId === "") {
        setData.curriculumSubjectId = null;
      } else {
        const csid = parseId(parsed.data.curriculumSubjectId);
        if (!csid) {
          return Response.json({ success: false, error: "Invalid curriculumSubjectId" }, { status: 400 });
        }
        const effectiveCurriculumId =
          (setData.curriculumId as mongoose.Types.ObjectId | undefined) ?? existing.curriculumId;
        if (!effectiveCurriculumId) {
          return Response.json(
            { success: false, error: "Set curriculumId before curriculumSubjectId" },
            { status: 400 }
          );
        }
        const row = await CurriculumSubject.findOne({
          _id: csid,
          schoolId: ctx.schoolId,
          curriculumId: effectiveCurriculumId,
        })
          .select("_id")
          .lean();
        if (!row) {
          return Response.json({ success: false, error: "Curriculum subject not found" }, { status: 400 });
        }
        setData.curriculumSubjectId = csid;
      }
    }

    const updated = await SchemeOfWork.findOneAndUpdate(
      { _id: schemeId, schoolId: ctx.schoolId },
      { $set: setData },
      { new: true }
    ).lean();

    return Response.json({ success: true, data: { scheme: serializeSchemeRow(updated as ISchemeOfWork) } });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update scheme" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireTeacher();
    if (!ctx.isAdmin) {
      return Response.json(
        { success: false, error: "Only school admins can delete schemes of learning." },
        { status: 403 }
      );
    }
    if (!can(ctx.permissions, PERMISSIONS.schemeOfWorkUpdate)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    await connectToDatabase();
    const { id } = await params;
    const schemeId = parseId(id);
    if (!schemeId) return Response.json({ success: false, error: "Invalid scheme id" }, { status: 400 });

    const existing = (await SchemeOfWork.findOne({
      _id: schemeId,
      schoolId: ctx.schoolId,
    })) as ISchemeOfWork | null;
    if (!existing) return Response.json({ success: false, error: "Scheme not found" }, { status: 404 });
    if (!teacherMayDeleteScheme(existing, ctx)) {
      return Response.json(
        { success: false, error: "Not allowed to delete this scheme" },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { unlinkLessonNotes?: boolean };
    const result = await deleteSchemeForSchool({
      schoolId: ctx.schoolId,
      userId: ctx.userId,
      schemeId: id,
      unlinkLessonNotes: body.unlinkLessonNotes === true,
    });
    if ("error" in result && result.error) return result.error;

    return Response.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete scheme" },
      { status: 500 }
    );
  }
}
