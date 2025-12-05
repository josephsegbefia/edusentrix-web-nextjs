/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/students/stats/route.ts
import { NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Student } from "@/models/Student";
import { ClassGroup } from "@/models/ClassGroup";

import mongoose from "mongoose";
import { StudentQuickStats } from "@/types/admin/student";

export async function GET() {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const schoolObjectId =
      typeof schoolId === "string"
        ? new mongoose.Types.ObjectId(schoolId)
        : schoolId;

    const [total, newThisMonth, distributionRaw] = await Promise.all([
      Student.countDocuments({ schoolId: schoolObjectId }),

      // New this month (by enrolledAt if set, otherwise createdAt)
      (async () => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return Student.countDocuments({
          schoolId: schoolObjectId,
          $or: [
            { enrolledAt: { $gte: startOfMonth } },
            {
              enrolledAt: null,
              createdAt: { $gte: startOfMonth },
            },
          ],
        });
      })(),

      // Class distribution – group by classGroupId
      Student.aggregate([
        { $match: { schoolId: schoolObjectId } },
        {
          $group: {
            _id: "$classGroupId",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Resolve class group + grade labels
    const classGroupIds = distributionRaw
      .map((d: any) => d._id)
      .filter(Boolean) as mongoose.Types.ObjectId[];

    const classGroups = classGroupIds.length
      ? await ClassGroup.find({ _id: { $in: classGroupIds } })
          .populate("gradeId", "name")
          .lean()
      : [];

    const classGroupMap = new Map<string, any>();
    for (const cg of classGroups) {
      classGroupMap.set(String(cg._id), cg);
    }

    const classDistribution: StudentQuickStats["classDistribution"] =
      distributionRaw.map((d: any) => {
        const cg = classGroupMap.get(String(d._id));
        const grade = cg?.gradeId as any | undefined;

        return {
          classGroupId: d._id ? String(d._id) : "unassigned",
          classGroupName: cg?.name ?? "Unassigned",
          gradeId: grade?._id ? String(grade._id) : null,
          gradeName: grade?.name ?? null,
          count: d.count ?? 0,
        };
      });

    // Fee + academic stats are placeholders until those systems are wired
    const stats: StudentQuickStats = {
      total,
      owingCount: 0,
      owingAmount: 0,
      topPerformers: 0,
      newThisMonth,
      classDistribution,
    };

    return NextResponse.json(stats, { status: 200 });
  } catch (error: unknown) {
    console.error("Failed to fetch student stats:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch student stats";
    return new NextResponse(
      JSON.stringify({ success: false, error: message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
