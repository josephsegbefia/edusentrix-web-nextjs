import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { Rubric } from "@/models/Rubric";
import { requireTeacherStudioAccess } from "@/lib/features/teacherStudio";
import { PERMISSIONS } from "@/lib/rbac";

const CriterionSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(500).optional().nullable(),
  maxScore: z.number().min(0),
  weight: z.number().min(0).max(100).optional().nullable(),
});

const RubricUpdateSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  description: z.string().max(500).optional().nullable(),
  criteria: z.array(CriterionSchema).min(1).optional(),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    await requireTeacherStudioAccess(context, PERMISSIONS.assignmentsCreate);

    const { id } = await ctx.params;
    const rubricId = toObjectIdOrNull(id);

    if (!rubricId) {
      return Response.json({ success: false, error: "Invalid rubric ID" }, { status: 400 });
    }

    const rubric = await Rubric.findOne({
      _id: rubricId,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    }).lean();

    if (!rubric) {
      return Response.json({ success: false, error: "Rubric not found" }, { status: 404 });
    }

    return Response.json({
      success: true,
      data: {
        rubric: {
          id: String(rubric._id),
          title: rubric.title,
          description: rubric.description || null,
          criteria: rubric.criteria || [],
          createdAt: rubric.createdAt ? rubric.createdAt.toISOString() : null,
        },
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to load rubric:", e);
    const message = e instanceof Error ? e.message : "Failed to load rubric";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    await requireTeacherStudioAccess(context, PERMISSIONS.assignmentsCreate);

    const { id } = await ctx.params;
    const rubricId = toObjectIdOrNull(id);

    if (!rubricId) {
      return Response.json({ success: false, error: "Invalid rubric ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = RubricUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const update = parsed.data;
    const patch: Record<string, unknown> = {};

    if (update.title) patch.title = update.title;
    if (update.description !== undefined) {
      patch.description = update.description || undefined;
    }
    if (update.criteria) {
      patch.criteria = update.criteria.map((criterion) => ({
        title: criterion.title,
        description: criterion.description || undefined,
        maxScore: criterion.maxScore,
        weight: criterion.weight ?? undefined,
      }));
    }

    await Rubric.updateOne(
      { _id: rubricId, schoolId: context.schoolId, teacherId: context.teacherId },
      { $set: patch }
    );

    const rubric = await Rubric.findById(rubricId).lean();
    if (!rubric) {
      return Response.json({ success: false, error: "Rubric not found" }, { status: 404 });
    }

    return Response.json({
      success: true,
      data: {
        rubric: {
          id: String(rubric._id),
          title: rubric.title,
          description: rubric.description || null,
          criteria: rubric.criteria || [],
          createdAt: rubric.createdAt ? rubric.createdAt.toISOString() : null,
        },
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to update rubric:", e);
    const message = e instanceof Error ? e.message : "Failed to update rubric";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    await requireTeacherStudioAccess(context, PERMISSIONS.assignmentsCreate);

    const { id } = await ctx.params;
    const rubricId = toObjectIdOrNull(id);

    if (!rubricId) {
      return Response.json({ success: false, error: "Invalid rubric ID" }, { status: 400 });
    }

    await Rubric.deleteOne({
      _id: rubricId,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    });

    return Response.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to delete rubric:", e);
    const message = e instanceof Error ? e.message : "Failed to delete rubric";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
