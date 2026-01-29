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

const RubricSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(500).optional().nullable(),
  criteria: z.array(CriterionSchema).min(1),
});

export async function GET() {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    await requireTeacherStudioAccess(context, PERMISSIONS.assignmentsCreate);

    const rubrics = await Rubric.find({
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    })
      .sort({ createdAt: -1 })
      .lean();

    return Response.json({
      success: true,
      data: {
        rubrics: rubrics.map((rubric) => ({
          id: String(rubric._id),
          title: rubric.title,
          description: rubric.description || null,
          criteria: rubric.criteria || [],
          createdAt: rubric.createdAt ? rubric.createdAt.toISOString() : null,
        })),
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to load rubrics:", e);
    const message = e instanceof Error ? e.message : "Failed to load rubrics";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    await requireTeacherStudioAccess(context, PERMISSIONS.assignmentsCreate);

    const body = await req.json().catch(() => null);
    const parsed = RubricSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const rubric = await Rubric.create({
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      title: parsed.data.title,
      description: parsed.data.description || undefined,
      criteria: parsed.data.criteria.map((criterion) => ({
        title: criterion.title,
        description: criterion.description || undefined,
        maxScore: criterion.maxScore,
        weight: criterion.weight ?? undefined,
      })),
    });

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
    console.error("Failed to create rubric:", e);
    const message = e instanceof Error ? e.message : "Failed to create rubric";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
