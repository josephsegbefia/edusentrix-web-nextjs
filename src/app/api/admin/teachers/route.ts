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
import { runTeacherLeaveAutomation } from "@/lib/teachers/leaveAutomation";
import mongoose from "mongoose";

function toObjectIdOrNull(id: string | null): mongoose.Types.ObjectId | null {
  if (!id) return null;
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function GET(req: NextRequest) {
  const { schoolId } = await requireSchoolAdmin();
  await connectToDatabase();

  try {
    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    // Opportunistic sweep so expired leaves and near-end reminders stay current
    // even before external cron wiring is in place.
    await runTeacherLeaveAutomation({ schoolId: schoolIdObj });

    const { searchParams } = new URL(req.url);

    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = Math.min(
      parsePositiveInt(searchParams.get("limit"), 25),
      100
    );

    // support both ?search= and legacy ?q=
    const search = (
      searchParams.get("search") ||
      searchParams.get("q") ||
      ""
    ).trim();

    const tab = (searchParams.get("tab") || "all").trim();
    const status = (searchParams.get("status") || "").trim(); // optional override
    const sortBy = (searchParams.get("sortBy") || "name").trim();
    const sortOrder =
      (searchParams.get("sortOrder") || "asc").trim() === "desc"
        ? "desc"
        : "asc";

    const subjectId = (searchParams.get("subjectId") || "").trim();
    const classGroupId = (searchParams.get("classGroupId") || "").trim(); // homeroom filter
    const department = (searchParams.get("department") || "").trim();

    const subjectObjId = toObjectIdOrNull(subjectId);
    const classGroupObjId = toObjectIdOrNull(classGroupId);

    const match: Record<string, any> = { schoolId: schoolIdObj };

    // Tabs
    if (tab === "active") match.status = "active";
    if (tab === "inactive") match.status = "inactive";
    if (tab === "on_leave") match.status = "on_leave";
    if (tab === "terminated") match.status = "terminated";
    if (tab === "homeroom") match.homeroomClassGroupId = { $ne: null };

    // Explicit status overrides tab
    if (["active", "inactive", "on_leave", "terminated"].includes(status)) {
      match.status = status;
    }

    if (subjectObjId) match.subjectIds = subjectObjId;
    if (classGroupObjId) match.homeroomClassGroupId = classGroupObjId;

    if (department) {
      match.department = new RegExp(escapeRegex(department), "i");
    }

    const dir = sortOrder === "desc" ? -1 : 1;

    const usersCollection = User.collection.name;
    const subjectsCollection = Subject.collection.name;
    const classGroupsCollection = ClassGroup.collection.name;

    const skip = (page - 1) * limit;

    const searchRegex = search ? new RegExp(escapeRegex(search), "i") : null;

    const sortStage: Record<string, 1 | -1> =
      sortBy === "createdAt"
        ? { createdAt: dir, _id: 1 }
        : sortBy === "status"
        ? { status: dir, "user.lastName": 1, "user.firstName": 1, _id: 1 }
        : sortBy === "hireDate"
        ? { hireDate: dir, "user.lastName": 1, "user.firstName": 1, _id: 1 }
        : { "user.lastName": dir, "user.firstName": dir, _id: 1 }; // name

    const pipeline: any[] = [
      { $match: match },

      // join user
      {
        $lookup: {
          from: usersCollection,
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },

      // search across user + employeeId
      ...(searchRegex
        ? [
            {
              $match: {
                $or: [
                  { "user.firstName": searchRegex },
                  { "user.lastName": searchRegex },
                  { "user.email": searchRegex },
                  { "user.phone": searchRegex },
                  { employeeId: searchRegex },
                ],
              },
            },
          ]
        : []),

      // subjects + homeroom lookups
      {
        $lookup: {
          from: subjectsCollection,
          localField: "subjectIds",
          foreignField: "_id",
          as: "subjects",
        },
      },
      {
        $lookup: {
          from: classGroupsCollection,
          localField: "homeroomClassGroupId",
          foreignField: "_id",
          as: "homeroomArr",
        },
      },
      { $addFields: { homeroom: { $first: "$homeroomArr" } } },

      // paginate + total
      {
        $facet: {
          items: [{ $sort: sortStage }, { $skip: skip }, { $limit: limit }],
          total: [{ $count: "count" }],
        },
      },
    ];

    const agg = await Teacher.aggregate(pipeline);

    const items = agg?.[0]?.items ?? [];
    const total = agg?.[0]?.total?.[0]?.count ?? 0;

    const today = startOfDay(new Date());
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const data = items.map((t: any) => {
      const u = t.user || {};
      const createdAt = t.createdAt ? new Date(t.createdAt) : new Date();

      return {
        id: String(t._id),
        userId: String(u._id || t.userId),

        firstName: String(u.firstName || ""),
        lastName: String(u.lastName || ""),
        fullName: `${String(u.firstName || "")} ${String(
          u.lastName || ""
        )}`.trim(),

        email: u.email ? String(u.email) : null,
        phone: u.phone ? String(u.phone) : null,
        photoUrl: u.avatarUrl ? String(u.avatarUrl) : null,

        status: (t.status || "active") as any,

        employeeId: t.employeeId ? String(t.employeeId) : null,
        department: t.department ? String(t.department) : null,
        hireDate: t.hireDate ? new Date(t.hireDate).toISOString() : null,
        terminationDate: t.terminationDate
          ? new Date(t.terminationDate).toISOString()
          : null,

        leaveStartDate: t.leaveStartDate ? new Date(t.leaveStartDate).toISOString() : null,
        leaveEndDate: t.leaveEndDate ? new Date(t.leaveEndDate).toISOString() : null,
        leaveReason: t.leaveReason ? String(t.leaveReason) : null,

        subjects: Array.isArray(t.subjects)
          ? t.subjects
              .slice(0, 6)
              .map((s: any) => ({ id: String(s._id), name: String(s.name) }))
          : [],

        homeroom: t.homeroom
          ? { id: String(t.homeroom._id), name: String(t.homeroom.name) }
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
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
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
