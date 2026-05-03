import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { CurriculumNode } from "@/models/CurriculumNode";
import { CurriculumSubject, type ICurriculumSubject } from "@/models/CurriculumSubject";
import { Grade } from "@/models/Grade";
import { Subject } from "@/models/Subject";

function parseId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

const PatchSchema = z.object({
  gradeId: z.string().nullable().optional(),
  order: z.number().int().min(0).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireSchoolAdmin();
    await connectToDatabase();
    const { id } = await ctx.params;
    const rowId = parseId(id);
    if (!rowId) {
      return Response.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    const existing = (await CurriculumSubject.findOne({
      _id: rowId,
      schoolId: admin.schoolId,
    }).lean()) as ICurriculumSubject | null;
    if (!existing) {
      return Response.json({ success: false, error: "Curriculum subject not found" }, { status: 404 });
    }

    const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const setData: Record<string, unknown> = {};

    if (parsed.data.order !== undefined) {
      setData.order = parsed.data.order;
    }

    if (parsed.data.gradeId !== undefined) {
      if (parsed.data.gradeId === null || parsed.data.gradeId === "") {
        setData.gradeId = null;
      } else {
        const g = parseId(parsed.data.gradeId);
        if (!g) {
          return Response.json({ success: false, error: "Invalid gradeId" }, { status: 400 });
        }
        const grade = await Grade.findOne({ _id: g, schoolId: admin.schoolId }).select("_id").lean();
        if (!grade) {
          return Response.json({ success: false, error: "Grade not found" }, { status: 404 });
        }
        setData.gradeId = g;
      }
    }

    if (Object.keys(setData).length === 0) {
      const subject = await Subject.findById(existing.subjectId).select("name").lean();
      const grade = existing.gradeId
        ? await Grade.findById(existing.gradeId).select("name").lean()
        : null;
      return Response.json({
        success: true,
        data: {
          curriculumSubject: {
            id: String(existing._id),
            curriculumId: String(existing.curriculumId),
            subjectId: String(existing.subjectId),
            subjectName: subject?.name ?? null,
            gradeId: existing.gradeId ? String(existing.gradeId) : null,
            gradeName: grade?.name ?? null,
            order: existing.order,
          },
        },
      });
    }

    try {
      const updated = await CurriculumSubject.findOneAndUpdate(
        { _id: rowId, schoolId: admin.schoolId },
        { $set: setData },
        { new: true }
      ).lean();
      if (!updated) {
        return Response.json({ success: false, error: "Update failed" }, { status: 404 });
      }

      const row = updated as ICurriculumSubject;
      const subject = await Subject.findById(row.subjectId).select("name").lean();
      const grade = row.gradeId ? await Grade.findById(row.gradeId).select("name").lean() : null;

      return Response.json({
        success: true,
        data: {
          curriculumSubject: {
            id: String(row._id),
            curriculumId: String(row.curriculumId),
            subjectId: String(row.subjectId),
            subjectName: subject?.name ?? null,
            gradeId: row.gradeId ? String(row.gradeId) : null,
            gradeName: grade?.name ?? null,
            order: row.order,
          },
        },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("E11000") || msg.includes("duplicate")) {
        return Response.json(
          { success: false, error: "Another row already uses this subject and grade" },
          { status: 409 }
        );
      }
      throw e;
    }
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update curriculum subject",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireSchoolAdmin();
    await connectToDatabase();
    const { id } = await ctx.params;
    const rowId = parseId(id);
    if (!rowId) {
      return Response.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    const existing = await CurriculumSubject.findOne({
      _id: rowId,
      schoolId: admin.schoolId,
    })
      .select("_id")
      .lean();
    if (!existing) {
      return Response.json({ success: false, error: "Curriculum subject not found" }, { status: 404 });
    }

    await CurriculumNode.deleteMany({
      schoolId: admin.schoolId,
      curriculumSubjectId: rowId,
    });
    await CurriculumSubject.deleteOne({ _id: rowId, schoolId: admin.schoolId });

    return Response.json({ success: true, data: { deleted: true } });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete curriculum subject",
      },
      { status: 500 }
    );
  }
}
