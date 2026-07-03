/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/students/route.ts
import { NextRequest } from "next/server";
import { requireFinanceStaffOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import mongoose from "mongoose";
import { Student } from "@/models/Student";
import { Grade } from "@/models/Grade";
import { ClassGroup } from "@/models/ClassGroup";
import { Invoice } from "@/models/Invoice";
import { StudentReportCard } from "@/models/StudentReportCard";
import type {
  AcademicBadge,
  FeeStatus,
  StudentListItem,
  StudentListResponse,
} from "@/types/admin/student";

function parsePositiveInt(value: string | null, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function computeIsNew(enrolledAt?: Date | null, createdAt?: Date): boolean {
  const ref = enrolledAt ?? createdAt ?? null;
  if (!ref) return false;
  const now = new Date();
  const daysDiff = (now.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24);
  return daysDiff <= 30; // last 30 days
}

type StudentFeeRollup = {
  billCount: number;
  totalBilledMinor: number;
  totalPaidMinor: number;
  totalOutstandingMinor: number;
};

function isFeeStatus(value: string | null): value is FeeStatus {
  return (
    value === "none" ||
    value === "cleared" ||
    value === "owing" ||
    value === "partial" ||
    value === "unknown"
  );
}

function deriveFeeStatus(rollup?: StudentFeeRollup): {
  feeStatus: FeeStatus;
  amountOwed: number | null;
} {
  if (!rollup || rollup.billCount === 0) {
    return { feeStatus: "none", amountOwed: null };
  }

  const amountOwed = Math.max(rollup.totalOutstandingMinor, 0) / 100;

  if (rollup.totalOutstandingMinor > 0) {
    return {
      feeStatus: rollup.totalPaidMinor > 0 ? "partial" : "owing",
      amountOwed,
    };
  }

  if (rollup.totalBilledMinor > 0) {
    return { feeStatus: "cleared", amountOwed: 0 };
  }

  return { feeStatus: "none", amountOwed: null };
}

function deriveAcademicBadge(average: number | null): AcademicBadge {
  if (average === null) return "none";
  if (average >= 95) return "top_1_percent";
  if (average >= 90) return "top_5_percent";
  if (average >= 85) return "top_10_percent";
  if (average >= 80) return "honours";
  return "none";
}

export async function GET(req: NextRequest) {
  const { schoolId } = await requireFinanceStaffOrDelegatedModuleView("students");
  await connectToDatabase();
  const schoolObjectId = mongoose.Types.ObjectId.isValid(String(schoolId))
    ? new mongoose.Types.ObjectId(String(schoolId))
    : schoolId;

  // Ensure models are registered before using populate
  // In Next.js serverless environments, we need to ensure models are evaluated
  // Accessing modelName or calling a method ensures registration
  if (!mongoose.models.Grade) {
    // Force registration by accessing the model
    const _ = Grade.modelName;
  }
  if (!mongoose.models.ClassGroup) {
    // Force registration by accessing the model
    const _ = ClassGroup.modelName;
  }

  try {
    const { searchParams } = new URL(req.url);

    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = Math.min(
      parsePositiveInt(searchParams.get("limit"), 25),
      100
    );

    const search = searchParams.get("search")?.trim() || "";
    const gradeId = searchParams.get("gradeId") || null;
    const classGroupId = searchParams.get("classGroupId") || null;
    const excludeClassId = searchParams.get("excludeClassId") || null;
    const status = searchParams.get("status") || null;
    const sex = searchParams.get("gender") || null;
    const tab = searchParams.get("tab") || "all";
    const feeStatusParam = searchParams.get("feeStatus");
    const feeStatus: FeeStatus | null = isFeeStatus(feeStatusParam)
      ? feeStatusParam
      : null;
    const enrollmentFrom = searchParams.get("enrollmentFrom") || null;
    const enrollmentTo = searchParams.get("enrollmentTo") || null;

    const sortBy = searchParams.get("sortBy") || "name";
    const sortOrderParam = searchParams.get("sortOrder") || "asc";
    const sortOrder: 1 | -1 = sortOrderParam === "desc" ? -1 : 1;

    const query: Record<string, unknown> = { schoolId: schoolObjectId };

    if (gradeId) query.gradeId = gradeId;
    if (classGroupId) query.classGroupId = classGroupId;
    if (
      excludeClassId &&
      mongoose.Types.ObjectId.isValid(excludeClassId) &&
      !classGroupId
    ) {
      query.classGroupId = {
        $ne: new mongoose.Types.ObjectId(excludeClassId),
      };
    }
    if (status && status !== "all") {
      query.status = status;
    } else if (tab === "alumni") {
      query.status = "graduated";
    } else {
      query.status = { $in: ["active", "inactive", "withdrawn"] };
    }
    if (sex === "male" || sex === "female") query.sex = sex;

    if (enrollmentFrom || enrollmentTo) {
      const dateFilter: Record<string, Date> = {};
      if (enrollmentFrom) dateFilter.$gte = new Date(enrollmentFrom);
      if (enrollmentTo) {
        const end = new Date(enrollmentTo);
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }
      query.enrolledAt = dateFilter;
    }

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      query.$or = [
        { firstName: regex },
        { middleName: regex },
        { lastName: regex },
        { admissionNo: regex },
      ];
    }

    if (tab === "recent") {
      // recently added – handled via sort below (no extra filter needed)
    }
    const effectiveFeeStatus =
      tab === "fee-defaulters" && feeStatus !== "partial" && feeStatus !== "owing"
        ? null
        : feeStatus;
    const shouldFilterByFeeStatus =
      effectiveFeeStatus &&
      effectiveFeeStatus !== "unknown" &&
      effectiveFeeStatus !== "none" &&
      (tab !== "fee-defaulters" || effectiveFeeStatus !== "cleared");
    if (tab === "fee-defaulters" || shouldFilterByFeeStatus) {
      const invoiceMatch: Record<string, unknown> = {
        schoolId: schoolObjectId,
        status: { $ne: "cancelled" },
      };
      if (
        tab === "fee-defaulters" ||
        effectiveFeeStatus === "partial" ||
        effectiveFeeStatus === "owing"
      ) {
        invoiceMatch.totalOutstandingMinor = { $gt: 0 };
      }

      const owingStudentIds = await Invoice.aggregate([
        {
          $match: invoiceMatch,
        },
        {
          $group: {
            _id: "$studentId",
            billCount: { $sum: 1 },
            totalBilledMinor: { $sum: { $ifNull: ["$totalAmountMinor", 0] } },
            totalPaidMinor: { $sum: { $ifNull: ["$totalPaidMinor", 0] } },
            totalOutstandingMinor: {
              $sum: { $ifNull: ["$totalOutstandingMinor", 0] },
            },
          },
        },
        {
          $addFields: {
            computedFeeStatus: {
              $switch: {
                branches: [
                  {
                    case: {
                      $and: [
                        { $gt: ["$totalOutstandingMinor", 0] },
                        { $gt: ["$totalPaidMinor", 0] },
                      ],
                    },
                    then: "partial",
                  },
                  {
                    case: { $gt: ["$totalOutstandingMinor", 0] },
                    then: "owing",
                  },
                  {
                    case: {
                      $and: [
                        { $gt: ["$totalBilledMinor", 0] },
                        { $lte: ["$totalOutstandingMinor", 0] },
                      ],
                    },
                    then: "cleared",
                  },
                ],
                default: "none",
              },
            },
          },
        },
        ...(tab === "fee-defaulters"
          ? [{ $match: { totalOutstandingMinor: { $gt: 0 } } }]
          : []),
        ...(shouldFilterByFeeStatus
          ? [{ $match: { computedFeeStatus: effectiveFeeStatus } }]
          : []),
      ]);
      query._id = { $in: owingStudentIds.map((row) => row._id) };
    }
    if (tab === "top-performers") {
      const topStudentIds = await StudentReportCard.aggregate([
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
      ]);
      query._id = { $in: topStudentIds.map((row) => row._id) };
    }

    const sort: Record<string, 1 | -1> = {};
    switch (sortBy) {
      case "class":
        sort.gradeId = sortOrder;
        sort.classGroupId = sortOrder;
        sort.lastName = sortOrder;
        break;
      case "feeStatus":
        // placeholder – no persisted feeStatus yet
        sort.lastName = sortOrder;
        break;
      case "enrollmentDate":
        sort.enrolledAt = sortOrder;
        break;
      case "createdAt":
        sort.createdAt = sortOrder;
        break;
      case "name":
      default:
        sort.lastName = sortOrder;
        sort.firstName = sortOrder;
        break;
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Student.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("gradeId", "name")
        .populate({
          path: "classGroupId",
          select: "name gradeId",
          populate: { path: "gradeId", select: "name" },
        })
        .lean(),
      Student.countDocuments(query),
    ]);

    const studentIds = items.map((s: any) => s._id).filter(Boolean);
    const billRollups = (await Invoice.aggregate([
      {
        $match: {
          schoolId: schoolObjectId,
          studentId: { $in: studentIds },
          status: { $ne: "cancelled" },
        },
      },
      {
        $group: {
          _id: "$studentId",
          billCount: { $sum: 1 },
          totalBilledMinor: { $sum: { $ifNull: ["$totalAmountMinor", 0] } },
          totalPaidMinor: { $sum: { $ifNull: ["$totalPaidMinor", 0] } },
          totalOutstandingMinor: {
            $sum: { $ifNull: ["$totalOutstandingMinor", 0] },
          },
        },
      },
    ])) as Array<StudentFeeRollup & { _id: unknown }>;

    const feeRollupByStudentId = new Map<string, StudentFeeRollup>(
      billRollups.map((rollup) => [
        String(rollup._id),
        {
          billCount: Number(rollup.billCount || 0),
          totalBilledMinor: Number(rollup.totalBilledMinor || 0),
          totalPaidMinor: Number(rollup.totalPaidMinor || 0),
          totalOutstandingMinor: Number(rollup.totalOutstandingMinor || 0),
        },
      ])
    );

    const academicRollups = (await StudentReportCard.aggregate([
      {
        $match: {
          schoolId: schoolObjectId,
          studentId: { $in: studentIds },
          status: "released",
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
    ])) as Array<{ _id: unknown; latestAverage?: number | null }>;

    const latestAverageByStudentId = new Map<string, number | null>(
      academicRollups.map((rollup) => [
        String(rollup._id),
        typeof rollup.latestAverage === "number" ? rollup.latestAverage : null,
      ])
    );

    const data: StudentListItem[] = items.map((s: any) => {
      const grade = s.gradeId as any | null;
      const classGroup = s.classGroupId as any | null;

      const firstName: string = s.firstName;
      const lastName: string = s.lastName;
      const middleName: string | null = s.middleName ?? null;

      const fullName = [firstName, middleName, lastName]
        .filter(Boolean)
        .join(" ");

      const enrolledAt: Date | null = s.enrolledAt ?? null;
      const createdAt: Date = s.createdAt;

      const { feeStatus, amountOwed } = deriveFeeStatus(
        feeRollupByStudentId.get(String(s._id))
      );
      const lastPaymentAt: string | null = null;
      const latestAverage = latestAverageByStudentId.get(String(s._id)) ?? null;
      const academicBadge = deriveAcademicBadge(latestAverage);

      const result: StudentListItem = {
        id: String(s._id),
        admissionNumber: s.admissionNo ?? null,
        firstName,
        middleName: middleName ?? "",
        fullName,
        sex: (s.sex ?? "male") as "male" | "female",
        photoUrl: s.photoUrl ?? null,

        gradeId: grade?._id ? String(grade._id) : grade ? String(grade) : null,
        gradeName: grade?.name ?? null,
        classGroupId: classGroup?._id
          ? String(classGroup._id)
          : classGroup
          ? String(classGroup)
          : null,
        classGroupName: classGroup?.name ?? null,

        status: s.status,
        enrolledAt: enrolledAt ? enrolledAt.toISOString() : null,
        createdAt: createdAt.toISOString(),

        feeStatus,
        amountOwed,
        lastPaymentAt,

        academicBadge,
        latestAverage,
        isTopPerformer: academicBadge !== "none",

        isNew: computeIsNew(enrolledAt, createdAt),
      };

      return result;
    });

    const response: StudentListResponse = {
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    return Response.json(response, { status: 200 });
  } catch (error: unknown) {
    console.error("Failed to fetch students:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch students";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
