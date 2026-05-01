import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { Curriculum, type ICurriculum } from "@/models/Curriculum";

const CreateCurriculumSchema = z.object({
  title: z.string().trim().min(2).max(200),
  code: z.string().trim().min(2).max(80),
  description: z.string().trim().max(4000).optional(),
});

function serialize(row: ICurriculum) {
  return {
    id: String(row._id),
    title: row.title,
    code: row.code,
    description: row.description ?? null,
    status: row.status,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export async function GET() {
  try {
    const ctx = await requireSchoolAdmin();
    await connectToDatabase();
    const docs = (await Curriculum.find({ schoolId: ctx.schoolId })
      .sort({ updatedAt: -1 })
      .lean()) as ICurriculum[];
    return Response.json({ success: true, data: { curricula: docs.map(serialize) } });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch curricula" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireSchoolAdmin();
    await connectToDatabase();
    const parsed = CreateCurriculumSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const created = await Curriculum.create({
      schoolId: ctx.schoolId,
      title: parsed.data.title,
      code: parsed.data.code,
      description: parsed.data.description || undefined,
      status: "draft",
      createdByUserId: ctx.userId,
      updatedByUserId: ctx.userId,
    });
    return Response.json({ success: true, data: { curriculum: serialize(created.toObject()) } });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create curriculum" },
      { status: 500 }
    );
  }
}
