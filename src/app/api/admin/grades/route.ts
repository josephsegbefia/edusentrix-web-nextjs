/* eslint-disable @typescript-eslint/no-explicit-any */
// GET /api/admin/grades
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Grade } from "@/models/Grade";
import { ClassGroup } from "@/models/ClassGroup";
import { Student } from "@/models/Student";
import mongoose from "mongoose";

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const url = new URL(req.url);
    const activeOnly =
      url.searchParams.get("active") === "1" ||
      url.searchParams.get("isActive") === "true";
    const withMeta = url.searchParams.get("withMeta") === "true";

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const query: Record<string, unknown> = { schoolId: schoolIdObj };
    if (activeOnly) {
      query.isActive = true;
    }

    const grades = await Grade.find(query)
      .sort({ order: 1, name: 1 })
      .lean();

    let data: Array<{
      id: string;
      name: string;
      code: string | null;
      stage: string;
      order: number;
      isActive: boolean;
      classCount?: number;
      studentCount?: number;
    }>;

    if (withMeta) {
      const gradeIds = grades.map((g: any) => g._id);

      const [classCounts, studentCounts] = await Promise.all([
        ClassGroup.aggregate([
          {
            $match: {
              schoolId: schoolIdObj,
              gradeId: { $in: gradeIds },
              isActive: true,
            },
          },
          { $group: { _id: "$gradeId", count: { $sum: 1 } } },
        ]),
        Student.aggregate([
          {
            $match: {
              schoolId: schoolIdObj,
              gradeId: { $in: gradeIds },
              status: { $in: ["active", "enrolled"] },
            },
          },
          { $group: { _id: "$gradeId", count: { $sum: 1 } } },
        ]),
      ]);

      const classCountMap = new Map(
        classCounts.map((c: any) => [String(c._id), c.count])
      );
      const studentCountMap = new Map(
        studentCounts.map((s: any) => [String(s._id), s.count])
      );

      data = grades.map((g: any) => ({
        id: String(g._id),
        name: g.name,
        code: g.code || null,
        stage: g.stage || "Basic",
        order: g.order ?? 0,
        isActive: g.isActive ?? true,
        classCount: classCountMap.get(String(g._id)) ?? 0,
        studentCount: studentCountMap.get(String(g._id)) ?? 0,
      }));
    } else {
      data = grades.map((g: any) => ({
        id: String(g._id),
        name: g.name,
        code: g.code || null,
        stage: g.stage || "Basic",
        order: g.order ?? 0,
        isActive: g.isActive ?? true,
      }));
    }

    return Response.json({ success: true, data }, { status: 200 });
  } catch (error: unknown) {
    console.error(error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch grades";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
