import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { SchemeOfWork, type ISchemeOfWork } from "@/models/SchemeOfWork";
import { serializeSchemeRow } from "@/lib/schemes/serializers";

const CreateSchemeSchema = z.object({
  title: z.string().trim().min(3).max(220),
  description: z.string().trim().max(8000).optional(),
  academicYearLabel: z.string().trim().max(80).optional(),
  termLabel: z.string().trim().max(80).optional(),
  gradeId: z.string().trim().optional(),
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

    const query: Record<string, unknown> = { schoolId: ctx.schoolId };
    if (status && ["draft", "in_review", "approved", "active", "archived"].includes(status)) {
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

    const parsed = CreateSchemeSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const gradeId = toObjectIdOrNull(parsed.data.gradeId);
    const subjectId = toObjectIdOrNull(parsed.data.subjectId);
    if (parsed.data.gradeId && !gradeId) {
      return Response.json({ success: false, error: "Invalid gradeId" }, { status: 400 });
    }
    if (parsed.data.subjectId && !subjectId) {
      return Response.json({ success: false, error: "Invalid subjectId" }, { status: 400 });
    }

    const created = await SchemeOfWork.create({
      schoolId: ctx.schoolId,
      title: parsed.data.title,
      description: parsed.data.description || undefined,
      academicYearLabel: parsed.data.academicYearLabel || undefined,
      termLabel: parsed.data.termLabel || undefined,
      gradeId,
      subjectId,
      ownerTeacherId: ctx.teacherId,
      status: "draft",
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
