/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/teachers/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";
import { ClassGroup } from "@/models/ClassGroup";
import { Subject } from "@/models/Subject";
import { escapeRegex, parsePositiveInt } from "@/lib/utils";
import mongoose from "mongoose";

function startOfDayISO(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function GET(req: NextRequest) {
  const { schoolId } = await requireSchoolAdmin();
  await connectToDatabase();

  console.log("Registered models:", Object.keys(mongoose.models));

  try {
    // Ensure schoolId is properly converted to ObjectId
    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const { searchParams } = new URL(req.url);

    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = Math.min(
      parsePositiveInt(searchParams.get("limit"), 25),
      100
    );
    const search = searchParams.get("search")?.trim() || "";
    const tab = (searchParams.get("tab") || "all").trim();
    const sortBy = (searchParams.get("sortBy") || "name").trim();
    const sortOrder =
      (searchParams.get("sortOrder") || "asc").trim() === "desc"
        ? "desc"
        : "asc";
    const subjectId = searchParams.get("subjectId")?.trim() || "";

    const query: Record<string, any> = { schoolId: schoolIdObj };

    // Tabs -> filter status / homeroom
    if (tab === "active") query.status = "active";
    if (tab === "inactive") query.status = "inactive";
    if (tab === "homeroom") query.homeroomClassGroupId = { $ne: null };

    // Subject filter (simple: Teacher.subjectIds array)
    if (subjectId) query.subjectIds = subjectId;

    // Search (teacher name/email lives on User -> resolve userIds first)
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      const users = await User.find({
        schoolId: schoolIdObj,
        $or: [{ firstName: regex }, { lastName: regex }, { email: regex }],
      })
        .select("_id")
        .lean();

      const userIds = users.map((u: any) => u._id);
      if (userIds.length === 0) {
        return Response.json({
          success: true,
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        });
      }
      query.userId = { $in: userIds };
    }

    const sort: Record<string, 1 | -1> = {};
    const dir: 1 | -1 = sortOrder === "desc" ? -1 : 1;

    if (sortBy === "createdAt") sort.createdAt = dir;
    else if (sortBy === "status") sort.status = dir;
    else {
      // name sort: we sort in memory after populate user (safe for <=100/page)
      sort.createdAt = -1;
    }

    const skip = (page - 1) * limit;

    const [itemsRaw, total] = await Promise.all([
      Teacher.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("userId", "firstName lastName email phone photoUrl")
        .populate({
          path: "subjectIds",
          select: "name",
          model: Subject, // ensure Subject model is registered (tree-shake safe)
        })
        .populate({
          path: "homeroomClassGroupId",
          select: "name",
          model: ClassGroup, // ensure ClassGroup model is registered (tree-shake safe)
        })
        .lean(),
      Teacher.countDocuments(query),
    ]);

    // In-memory sort by name (because user is populated)
    const items = Array.isArray(itemsRaw) ? itemsRaw : [];
    if (sortBy === "name") {
      items.sort((a: any, b: any) => {
        const aL = (a?.userId?.lastName || "").toString().toLowerCase();
        const bL = (b?.userId?.lastName || "").toString().toLowerCase();
        const aF = (a?.userId?.firstName || "").toString().toLowerCase();
        const bF = (b?.userId?.firstName || "").toString().toLowerCase();
        const cmp = aL.localeCompare(bL) || aF.localeCompare(bF);
        return sortOrder === "desc" ? -cmp : cmp;
      });
    }

    const now = new Date();
    const today = startOfDayISO(now);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const data = items.map((t: any) => {
      const u = t.userId || {};
      const createdAt = t.createdAt ? new Date(t.createdAt) : new Date();

      return {
        id: String(t._id),
        userId: String(u._id || t.userId),

        firstName: (u.firstName || "").toString(),
        lastName: (u.lastName || "").toString(),
        fullName: `${(u.firstName || "").toString()} ${(
          u.lastName || ""
        ).toString()}`.trim(),

        email: u.email ? String(u.email) : null,
        phone: u.phone ? String(u.phone) : null,
        photoUrl: u.photoUrl ? String(u.photoUrl) : null,

        status: (t.status || "active") as any,

        subjects: (t.subjectIds || []).slice(0, 6).map((s: any) => ({
          id: String(s._id),
          name: String(s.name),
        })),
        homeroom: t.homeroomClassGroupId
          ? {
              id: String(t.homeroomClassGroupId._id),
              name: String(t.homeroomClassGroupId.name),
            }
          : null,

        createdAt: createdAt.toISOString(),
        isNew: createdAt >= sevenDaysAgo,
      };
    });

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
  } catch (error) {
    console.error("Error fetching teachers:", error);
    return Response.json(
      { error: "Failed to fetch teachers" },
      { status: 500 }
    );
  }
}
