/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/students/stats/route.ts
import { NextResponse } from "next/server";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Student } from "@/models/Student";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Invoice } from "@/models/Invoice";
import { StudentReportCard } from "@/models/StudentReportCard";

import mongoose from "mongoose";
import { StudentQuickStats } from "@/types/admin/student";

export async function GET() {
  const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("students");
  await connectToDatabase();

  // Ensure models are registered before using populate
  // Force registration by accessing modelName
  if (!mongoose.models.Grade) {
    const _ = Grade.modelName;
  }
  if (!mongoose.models.ClassGroup) {
    const _ = ClassGroup.modelName;
  }

  if (!schoolId) {
    return new NextResponse(
      JSON.stringify({ success: false, error: "School ID not found" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const schoolObjectId =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : mongoose.Types.ObjectId.isValid(String(schoolId))
        ? new mongoose.Types.ObjectId(String(schoolId))
        : schoolId;

    const [
      total,
      newThisMonth,
      gradeDistributionRaw,
      classDistributionRaw,
      feeDefaulterRows,
      topPerformerRows,
    ] =
      await Promise.all([
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

        // Grade distribution – group by gradeId
        Student.aggregate([
          { $match: { schoolId: schoolObjectId } },
          {
            $group: {
              _id: "$gradeId",
              count: { $sum: 1 },
            },
          },
        ]),

        // Class distribution – group by classGroupId (kept for backward compatibility)
        Student.aggregate([
          { $match: { schoolId: schoolObjectId } },
          {
            $group: {
              _id: "$classGroupId",
              count: { $sum: 1 },
            },
          },
        ]),

        Invoice.aggregate([
          {
            $match: {
              schoolId: schoolObjectId,
              status: { $ne: "cancelled" },
              totalOutstandingMinor: { $gt: 0 },
            },
          },
          {
            $group: {
              _id: "$studentId",
              outstandingMinor: {
                $sum: { $ifNull: ["$totalOutstandingMinor", 0] },
              },
            },
          },
          { $match: { outstandingMinor: { $gt: 0 } } },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              outstandingMinor: { $sum: "$outstandingMinor" },
            },
          },
        ]),

        StudentReportCard.aggregate([
          {
            $match: {
              schoolId: schoolObjectId,
              status: "released",
              "termSummarySnapshot.averageFinalScore": { $gte: 80 },
            },
          },
          { $sort: { releasedAt: -1, updatedAt: -1 } },
          {
            $group: {
              _id: "$studentId",
              latestAverage: {
                $first: "$termSummarySnapshot.averageFinalScore",
              },
            },
          },
          { $match: { latestAverage: { $gte: 80 } } },
          { $count: "count" },
        ]),
      ]);

    // Resolve grade labels for grade distribution
    const gradeIds = gradeDistributionRaw
      .map((d: any) => d._id)
      .filter(Boolean) as mongoose.Types.ObjectId[];

    const grades = gradeIds.length
      ? await Grade.find({ _id: { $in: gradeIds } }).lean()
      : [];

    const gradeMap = new Map<string, any>();
    for (const grade of grades) {
      gradeMap.set(String(grade._id), grade);
    }

    const gradeDistribution: StudentQuickStats["gradeDistribution"] =
      gradeDistributionRaw.map((d: any) => {
        const grade = gradeMap.get(String(d._id));

        return {
          gradeId: d._id ? String(d._id) : "unassigned",
          gradeName: grade?.name ?? "Unassigned",
          count: d.count ?? 0,
        };
      });

    // Resolve class group + grade labels (for backward compatibility)
    const classGroupIds = classDistributionRaw
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
      classDistributionRaw.map((d: any) => {
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

    const feeDefaulters = feeDefaulterRows[0] as
      | { count?: number; outstandingMinor?: number }
      | undefined;
    const topPerformersRow = topPerformerRows[0] as
      | { count?: number }
      | undefined;

    const stats: StudentQuickStats = {
      total,
      owingCount: Number(feeDefaulters?.count ?? 0),
      owingAmount: Number(feeDefaulters?.outstandingMinor ?? 0) / 100,
      topPerformers: Number(topPerformersRow?.count ?? 0),
      newThisMonth,
      gradeDistribution,
      classDistribution, // Kept for backward compatibility
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
