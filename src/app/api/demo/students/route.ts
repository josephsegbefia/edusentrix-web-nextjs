// src/app/api/demo/students/route.ts
// Demo students list API - returns demo tenant data

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getDemoContext } from "@/lib/demo/api-utils";
import { Student } from "@/models/Student";
import { ClassGroup } from "@/models/ClassGroup";

export async function GET(req: NextRequest) {
  try {
    const demoContext = await getDemoContext();

    if (!demoContext.isDemo || !demoContext.demoTenantId) {
      return NextResponse.json({ error: "Demo session required" }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = req.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "12", 10)));
    const search = searchParams.get("q")?.trim() || "";
    const status = searchParams.get("status") || "";
    const classGroupId = searchParams.get("classGroupId") || "";
    const sortBy = searchParams.get("sortBy") || "name";
    const sortOrder = searchParams.get("sortOrder") === "desc" ? -1 : 1;

    // Build filter
    const filter: Record<string, unknown> = {
      demoTenantId: demoContext.demoTenantId,
    };

    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { studentId: { $regex: search, $options: "i" } },
      ];
    }

    if (status) {
      filter.status = status;
    }

    if (classGroupId) {
      filter.classGroupId = classGroupId;
    }

    // Build sort
    const sortField = sortBy === "name" ? "firstName" : sortBy;
    const sort: Record<string, 1 | -1> = { [sortField]: sortOrder as 1 | -1 };

    const skip = (page - 1) * limit;

    const [students, total] = await Promise.all([
      Student.find(filter)
        .populate("classGroupId", "name gradeLabel")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Student.countDocuments(filter),
    ]);

    // Map to DTO format
    const data = students.map((s) => {
      const classGroup = s.classGroupId as { name?: string; gradeLabel?: string } | null;
      return {
        _id: String(s._id),
        firstName: s.firstName,
        lastName: s.lastName,
        email: s.email,
        studentId: s.studentId,
        status: s.status || "active",
        dateOfBirth: s.dateOfBirth,
        gender: s.gender,
        avatarUrl: s.avatarUrl,
        classGroupId: classGroup ? String((s.classGroupId as { _id: unknown })._id) : null,
        classGroupName: classGroup?.name || null,
        gradeLabel: classGroup?.gradeLabel || null,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      };
    });

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[Demo Students] Error:", error);
    return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 });
  }
}
