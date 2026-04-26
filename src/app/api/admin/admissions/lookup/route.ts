// src/app/api/admin/admissions/lookup/route.ts
// GET – fetch grades + class groups for the admissions decision UI. The
// existing `/api/admin/class-groups` endpoint is finance-gated, so admissions
// officers (delegated teachers) cannot use it. This endpoint is gated by
// `requireAdmissionsManager` and returns lightweight rows with current
// occupancy so admins can see which class groups still have headroom.

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { connectToDatabase } from "@/db/connectToDatabase";
import { Grade } from "@/models/Grade";
import { ClassGroup } from "@/models/ClassGroup";
import { Student } from "@/models/Student";
import { requireAdmissionsManager } from "@/lib/auth/requireAdmissionsManager";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAdmissionsManager();
    const url = new URL(req.url);
    const gradeId = url.searchParams.get("gradeId");

    await connectToDatabase();

    const grades = await Grade.find({ schoolId: ctx.schoolId })
      .select({ _id: 1, name: 1, level: 1 })
      .sort({ level: 1, name: 1 })
      .lean<Array<{ _id: mongoose.Types.ObjectId; name: string; level?: number }>>();

    let classGroupQuery: Record<string, unknown> = {
      schoolId: ctx.schoolId,
      isActive: true,
    };
    if (gradeId && mongoose.isValidObjectId(gradeId)) {
      classGroupQuery = {
        ...classGroupQuery,
        gradeId: new mongoose.Types.ObjectId(gradeId),
      };
    }

    const classGroups = await ClassGroup.find(classGroupQuery)
      .select({ _id: 1, name: 1, gradeId: 1, capacity: 1 })
      .sort({ name: 1 })
      .lean<
        Array<{
          _id: mongoose.Types.ObjectId;
          name: string;
          gradeId: mongoose.Types.ObjectId;
          capacity?: number | null;
        }>
      >();

    const classGroupIds = classGroups.map((c) => c._id);
    const counts = classGroupIds.length
      ? await Student.aggregate<{
          _id: mongoose.Types.ObjectId;
          count: number;
        }>([
          {
            $match: {
              schoolId: ctx.schoolId,
              classGroupId: { $in: classGroupIds },
              status: "active",
            },
          },
          { $group: { _id: "$classGroupId", count: { $sum: 1 } } },
        ])
      : [];
    const countMap = new Map(counts.map((r) => [String(r._id), r.count]));

    return NextResponse.json({
      success: true,
      data: {
        grades: grades.map((g) => ({
          id: String(g._id),
          name: g.name,
          level: g.level ?? null,
        })),
        classGroups: classGroups.map((c) => {
          const enrolled = countMap.get(String(c._id)) ?? 0;
          const capacity = c.capacity ?? null;
          return {
            id: String(c._id),
            name: c.name,
            gradeId: String(c.gradeId),
            capacity,
            enrolled,
            isFull: capacity != null && enrolled >= capacity,
          };
        }),
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Admissions lookup error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load lookup data" },
      { status: 500 }
    );
  }
}
