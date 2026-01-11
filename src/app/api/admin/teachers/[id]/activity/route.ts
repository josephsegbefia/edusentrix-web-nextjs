// src/app/api/admin/teachers/[id]/activity/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { TeacherActivity, type TeacherActivityType } from "@/models/TeacherActivity";
import mongoose from "mongoose";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * GET /api/admin/teachers/:id/activity
 * Get activity log for a teacher
 * Query params: page, limit, type
 * Returns activities sorted by createdAt (newest first)
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { schoolId } = await requireSchoolAdmin();
  await connectToDatabase();

  const { id } = await ctx.params;
  const teacherObjId = toObjectIdOrNull(String(id));

  if (!teacherObjId) {
    return Response.json({ error: "Invalid teacher id" }, { status: 400 });
  }

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as TeacherActivityType | null;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));

  // Build query
  const query: Record<string, unknown> = {
    teacherId: teacherObjId,
    schoolId: schoolIdObj,
  };

  if (type) {
    query.type = type;
  }

  // Get total count
  const total = await TeacherActivity.countDocuments(query);

  // Get activities - sort by createdAt (newest first)
  const activities = await TeacherActivity.find(query)
    .populate("createdBy", "firstName lastName email")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const data = activities.map((activity: any) => ({
    id: String(activity._id),
    type: activity.type,
    title: activity.title,
    description: activity.description || null,
    metadata: activity.metadata || null,
    createdBy: activity.createdBy
      ? {
          id: String(activity.createdBy._id),
          name: `${activity.createdBy.firstName || ""} ${activity.createdBy.lastName || ""}`.trim(),
          email: activity.createdBy.email || null,
        }
      : null,
    createdAt: new Date(activity.createdAt).toISOString(),
    updatedAt: new Date(activity.updatedAt).toISOString(),
  }));

  return Response.json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
