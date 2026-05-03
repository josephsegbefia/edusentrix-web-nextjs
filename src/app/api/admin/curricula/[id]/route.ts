import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { serializeCurriculumApi } from "@/lib/curricula/serialize-curriculum";
import { Curriculum, type ICurriculum } from "@/models/Curriculum";

const PatchSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  code: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  schoolCurriculumCode: z.string().trim().max(50).nullable().optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
});

function parseId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireSchoolAdmin();
    await connectToDatabase();
    const { id } = await ctx.params;
    const curriculumId = parseId(id);
    if (!curriculumId) {
      return Response.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    const existing = (await Curriculum.findOne({
      _id: curriculumId,
      schoolId: admin.schoolId,
    }).lean()) as ICurriculum | null;
    if (!existing) {
      return Response.json({ success: false, error: "Curriculum not found" }, { status: 404 });
    }

    return Response.json({
      success: true,
      data: { curriculum: serializeCurriculumApi(existing) },
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Load failed" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireSchoolAdmin();
    await connectToDatabase();
    const { id } = await ctx.params;
    const curriculumId = parseId(id);
    if (!curriculumId) {
      return Response.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    const existing = (await Curriculum.findOne({
      _id: curriculumId,
      schoolId: admin.schoolId,
    }).lean()) as ICurriculum | null;
    if (!existing) {
      return Response.json({ success: false, error: "Curriculum not found" }, { status: 404 });
    }

    const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const setData: Record<string, unknown> = { updatedByUserId: admin.userId };

    if (parsed.data.title !== undefined) setData.title = parsed.data.title;
    if (parsed.data.description !== undefined) setData.description = parsed.data.description;
    if (parsed.data.status !== undefined) setData.status = parsed.data.status;

    if (parsed.data.schoolCurriculumCode !== undefined) {
      if (parsed.data.schoolCurriculumCode === null || parsed.data.schoolCurriculumCode === "") {
        setData.schoolCurriculumCode = null;
      } else {
        setData.schoolCurriculumCode = parsed.data.schoolCurriculumCode.trim();
      }
    }

    if (parsed.data.code !== undefined && parsed.data.code !== existing.code) {
      const clash = await Curriculum.findOne({
        schoolId: admin.schoolId,
        code: parsed.data.code,
        _id: { $ne: curriculumId },
      })
        .select("_id")
        .lean();
      if (clash) {
        return Response.json(
          { success: false, error: "Another framework already uses this code" },
          { status: 409 }
        );
      }
      setData.code = parsed.data.code;
    }

    const updated = await Curriculum.findOneAndUpdate(
      { _id: curriculumId, schoolId: admin.schoolId },
      { $set: setData },
      { new: true }
    ).lean();

    return Response.json({
      success: true,
      data: { curriculum: serializeCurriculumApi(updated as ICurriculum) },
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    );
  }
}
