import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { SchemeOfWork, type ISchemeOfWork } from "@/models/SchemeOfWork";
import { serializeSchemeRow } from "@/lib/schemes/serializers";

const PatchSchemeSchema = z.object({
  title: z.string().trim().min(3).max(220).optional(),
  description: z.string().trim().max(8000).nullable().optional(),
  academicYearLabel: z.string().trim().max(80).nullable().optional(),
  termLabel: z.string().trim().max(80).nullable().optional(),
  gradeId: z.string().trim().nullable().optional(),
  subjectId: z.string().trim().nullable().optional(),
});

function parseId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

function canEditScheme(ctxTeacherId: mongoose.Types.ObjectId, scheme: ISchemeOfWork) {
  return String(scheme.ownerTeacherId) === String(ctxTeacherId) || scheme.status === "draft";
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
    if (!canEditScheme(ctx.teacherId, existing)) {
      return Response.json({ success: false, error: "Not allowed to edit this scheme" }, { status: 403 });
    }
    if (existing.status !== "draft") {
      return Response.json(
        { success: false, error: "Only draft schemes can be edited" },
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
    if (parsed.data.subjectId !== undefined) {
      if (parsed.data.subjectId === null || parsed.data.subjectId === "") setData.subjectId = null;
      else {
        const sid = parseId(parsed.data.subjectId);
        if (!sid) return Response.json({ success: false, error: "Invalid subjectId" }, { status: 400 });
        setData.subjectId = sid;
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
