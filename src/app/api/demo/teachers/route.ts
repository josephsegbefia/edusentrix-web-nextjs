// src/app/api/demo/teachers/route.ts
// Demo teachers list API

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getDemoContext } from "@/lib/demo/api-utils";
import { Teacher } from "@/models/Teacher";

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

    const filter: Record<string, unknown> = {
      demoTenantId: demoContext.demoTenantId,
    };

    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { employeeId: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [teachers, total] = await Promise.all([
      Teacher.find(filter)
        .populate("subjectsTaught", "name")
        .populate("homeroomClass", "name")
        .sort({ firstName: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Teacher.countDocuments(filter),
    ]);

    const data = teachers.map((t) => ({
      _id: String(t._id),
      firstName: t.firstName,
      lastName: t.lastName,
      email: t.email,
      phone: t.phone,
      employeeId: t.employeeId,
      status: t.status || "active",
      avatarUrl: t.avatarUrl,
      department: t.department,
      subjects: (t.subjectsTaught as { name: string }[] | null)?.map((s) => s.name) || [],
      homeroomClassName: (t.homeroomClass as { name?: string } | null)?.name || null,
      hireDate: t.hireDate,
      createdAt: t.createdAt,
    }));

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
    console.error("[Demo Teachers] Error:", error);
    return NextResponse.json({ error: "Failed to fetch teachers" }, { status: 500 });
  }
}
