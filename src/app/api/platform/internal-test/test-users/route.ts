import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformInternalTestAccess } from "@/lib/auth/requirePlatformInternalTest";
import { School } from "@/models/School";
import { User } from "@/models/User";

export async function GET(req: Request) {
  try {
    const gate = await requirePlatformInternalTestAccess();
    if (!gate.ok) return gate.res;

    const url = new URL(req.url);
    const schoolIdParam = url.searchParams.get("schoolId")?.trim() || "";
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));
    const skip = (page - 1) * limit;

    await connectToDatabase();

    const filter: Record<string, unknown> = { isTestUser: true };
    if (schoolIdParam && mongoose.Types.ObjectId.isValid(schoolIdParam)) {
      filter.schoolId = new mongoose.Types.ObjectId(schoolIdParam);
    }

    const [rows, total] = await Promise.all([
      User.find(filter)
        .select("email firstName lastName role schoolId testUserSource clerkUserId createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const schoolIds = [
      ...new Set(
        rows
          .map((r) => r.schoolId)
          .filter(Boolean)
          .map((id) => String(id))
      ),
    ];
    const schools =
      schoolIds.length > 0
        ? await School.find({ _id: { $in: schoolIds.map((id) => new mongoose.Types.ObjectId(id)) } })
            .select("name")
            .lean<{ _id: mongoose.Types.ObjectId; name?: string }[]>()
        : [];
    const schoolNameById = new Map(schools.map((s) => [String(s._id), s.name ?? ""]));

    return NextResponse.json({
      success: true,
      data: {
        items: rows.map((u) => ({
          id: String(u._id),
          email: u.email,
          firstName: u.firstName ?? null,
          lastName: u.lastName ?? null,
          role: u.role ?? null,
          schoolId: u.schoolId ? String(u.schoolId) : null,
          schoolName: u.schoolId ? schoolNameById.get(String(u.schoolId)) ?? null : null,
          testUserSource: u.testUserSource ?? null,
          hasClerk: Boolean(u.clerkUserId),
          createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
        })),
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (e) {
    console.error("platform internal-test test-users GET", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to load test users" },
      { status: 500 }
    );
  }
}
