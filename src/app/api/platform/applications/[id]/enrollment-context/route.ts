/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { Application } from "@/models/Application";
import { Grade } from "@/models/Grade";
import { ClassGroup } from "@/models/ClassGroup";

export const runtime = "nodejs";

/**
 * Grades + class groups for the application’s linked school (enrollment wizard).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requirePlatformAdmin();
  if (!guard.ok) return guard.res;

  const { id } = await ctx.params;
  if (!id || !mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid application id" }, { status: 400 });
  }

  await connectToDatabase();

  const appRaw = await Application.findById(id).select("status linkedSchoolId").lean();
  const app = Array.isArray(appRaw) ? appRaw[0] : appRaw;
  if (!app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  if (app.status !== "approved" || !app.linkedSchoolId) {
    return NextResponse.json(
      {
        error:
          "Enrollment options are only available for approved applications with a linked school.",
      },
      { status: 400 }
    );
  }

  const schoolId = app.linkedSchoolId as mongoose.Types.ObjectId;

  const grades = await Grade.find({ schoolId, isActive: true })
    .sort({ order: 1, name: 1 })
    .select("_id name order")
    .lean();

  const classGroups = await ClassGroup.find({ schoolId, isActive: true })
    .sort({ name: 1 })
    .select("_id name gradeId")
    .lean();

  const byGrade = new Map<string, { id: string; name: string }[]>();
  for (const g of classGroups) {
    const gid = String(g.gradeId);
    const list = byGrade.get(gid) ?? [];
    list.push({ id: String(g._id), name: g.name });
    byGrade.set(gid, list);
  }

  const data = grades.map((gr) => ({
    id: String(gr._id),
    name: gr.name,
    order: gr.order ?? 0,
    classGroups: byGrade.get(String(gr._id)) ?? [],
  }));

  return NextResponse.json({
    success: true,
    data: {
      schoolId: String(schoolId),
      grades: data,
    },
  });
}
