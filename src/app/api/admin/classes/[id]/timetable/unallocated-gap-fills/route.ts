import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireClassTimetableEditor } from "@/lib/auth/requireClassTimetableEditor";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { SchoolUnallocatedGapFill } from "@/models/SchoolUnallocatedGapFill";
import { isUnallocatedGapPresetCode } from "@/lib/timetable/unallocated-gap-presets";

const PutBody = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().min(4).max(5),
  endTime: z.string().min(4).max(5),
  /** `null` clears the saved use for this gap. */
  presetCode: z.union([z.string().min(1).max(32), z.null()]),
});

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

/**
 * Unallocated “fills” for the class’s grade: shared across all classes in that grade for this school.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: classId } = await ctx.params;
    const { schoolId } = await requireClassTimetableEditor(classId);
    await connectToDatabase();
    const classObjId = new mongoose.Types.ObjectId(String(classId));
    const schoolObjId = schoolId;
    const cg = await ClassGroup.findById(classObjId).select("gradeId").lean() as
      | { gradeId: mongoose.Types.ObjectId }
      | null;
    if (!cg?.gradeId) {
      return jsonError("Class or grade not found", 404);
    }
    const gradeId = cg.gradeId;

    const g = await Grade.findOne({ _id: gradeId, schoolId: schoolObjId }).select("_id").lean();
    if (!g) {
      return jsonError("Grade not in this school", 400);
    }

    const rows = await SchoolUnallocatedGapFill.find({
      schoolId: schoolObjId,
      gradeId,
    })
      .select("dayOfWeek startTime endTime presetCode updatedAt")
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        gradeId: String(gradeId),
        fills: rows.map((r) => ({
          dayOfWeek: r.dayOfWeek,
          startTime: r.startTime,
          endTime: r.endTime,
          presetCode: r.presetCode,
          updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : null,
        })),
      },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    const err = e as { message?: string };
    return jsonError(err?.message || "Server error", 500);
  }
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: classId } = await ctx.params;
    const context = await requireClassTimetableEditor(classId);
    await connectToDatabase();
    const parsed = PutBody.safeParse(await req.json());
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message || "Invalid body", 400);
    }
    const { dayOfWeek, startTime, endTime, presetCode: rawPreset } = parsed.data;

    const classObjId = new mongoose.Types.ObjectId(String(classId));
    const cg = (await ClassGroup.findById(classObjId)
      .select("gradeId")
      .lean()) as { gradeId: mongoose.Types.ObjectId } | null;
    if (!cg?.gradeId) {
      return jsonError("Class or grade not found", 404);
    }
    const gradeId = cg.gradeId;
    const schoolObjId = context.schoolId;

    const g = await Grade.findOne({ _id: gradeId, schoolId: schoolObjId }).select("_id").lean();
    if (!g) {
      return jsonError("Grade not in this school", 400);
    }

    const s = startTime.trim();
    const e = endTime.trim();

    if (rawPreset === null) {
      await SchoolUnallocatedGapFill.deleteOne({
        schoolId: schoolObjId,
        gradeId,
        dayOfWeek,
        startTime: s,
        endTime: e,
      });
      return NextResponse.json({ success: true, data: { cleared: true } });
    }

    const code = String(rawPreset).trim();
    if (!isUnallocatedGapPresetCode(code)) {
      return jsonError("Invalid preset code", 400);
    }

    await SchoolUnallocatedGapFill.findOneAndUpdate(
      {
        schoolId: schoolObjId,
        gradeId,
        dayOfWeek,
        startTime: s,
        endTime: e,
      },
      {
        $set: {
          schoolId: schoolObjId,
          gradeId,
          dayOfWeek,
          startTime: s,
          endTime: e,
          presetCode: code,
          updatedBy: context.userId,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    return NextResponse.json({ success: true, data: { saved: true } });
  } catch (e) {
    if (e instanceof Response) return e;
    const err = e as { message?: string };
    return jsonError(err?.message || "Server error", 500);
  }
}
