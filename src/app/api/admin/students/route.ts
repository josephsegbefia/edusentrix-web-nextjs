/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/students/route.ts
import { NextRequest } from "next/server";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import mongoose from "mongoose";
import { Student } from "@/models/Student";
import { Grade } from "@/models/Grade";
import { ClassGroup } from "@/models/ClassGroup";
import { StudentListItem, StudentListResponse } from "@/types/admin/student";

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

export async function GET(req: NextRequest) {
  const { schoolId } = await requireFinanceStaff();
  await connectToDatabase();

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
    const status = searchParams.get("status") || null;
    const sex = searchParams.get("gender") || null;
    const tab = searchParams.get("tab") || "all";
    const enrollmentFrom = searchParams.get("enrollmentFrom") || null;
    const enrollmentTo = searchParams.get("enrollmentTo") || null;

    const sortBy = searchParams.get("sortBy") || "name";
    const sortOrderParam = searchParams.get("sortOrder") || "asc";
    const sortOrder: 1 | -1 = sortOrderParam === "desc" ? -1 : 1;

    const query: Record<string, unknown> = { schoolId };

    if (gradeId) query.gradeId = gradeId;
    if (classGroupId) query.classGroupId = classGroupId;
    if (status && status !== "all") query.status = status;
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

    // Basic tab behaviour (fee / academic tabs will be refined when those systems exist)
    if (tab === "recent") {
      // recently added – handled via sort below (no extra filter needed)
    }
    if (tab === "fee-defaulters") {
      // once fee system exists, we’ll filter by actual debt.
      // For now we just leave it as all students; UI will show 0 owing by default.
    }
    if (tab === "top-performers") {
      // once performance data exists we’ll filter here.
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

      // Placeholder fee + academic data until those systems are wired in:
      const feeStatus = "unknown" as const;
      const amountOwed = 0;
      const lastPaymentAt: string | null = null;
      const latestAverage: number | null = null;
      const academicBadge = "none" as const;

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
