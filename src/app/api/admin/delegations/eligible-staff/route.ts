import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { UserMembership } from "@/models/UserMembership";
import { User } from "@/models/User";
import { Teacher } from "@/models/Teacher";

export async function GET() {
  try {
    const ctx = await requireSchoolAdmin();
    await connectToDatabase();
    const schoolId = new mongoose.Types.ObjectId(String(ctx.schoolId));

    const memberships = await UserMembership.find({
      schoolId,
      status: "active",
      roles: { $in: ["teacher", "staff"] },
    })
      .select({ userId: 1, roles: 1 })
      .lean();

    const userIds = memberships.map((m) => m.userId);
    const users = await User.find({ _id: { $in: userIds } })
      .select({ firstName: 1, lastName: 1, email: 1 })
      .lean();

    const teachers = await Teacher.find({
      schoolId,
      userId: { $in: userIds },
      status: "active",
    })
      .select({ userId: 1 })
      .lean();
    const teacherUserIds = new Set(teachers.map((t) => String(t.userId)));

    const byId = new Map(users.map((u) => [String(u._id), u]));

    const rows = memberships.map((m) => {
      const u = byId.get(String(m.userId));
      const roles = (m.roles ?? []) as string[];
      const isTeacher = roles.includes("teacher");
      return {
        userId: String(m.userId),
        firstName: u?.firstName ?? "",
        lastName: u?.lastName ?? "",
        email: u?.email ?? "",
        roles: roles.filter((r) => r === "teacher" || r === "staff"),
        isTeacher,
        hasTeacherRecord: teacherUserIds.has(String(m.userId)),
      };
    });

    rows.sort((a, b) => (a.email || "").localeCompare(b.email || ""));

    return NextResponse.json({ success: true, data: rows });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ success: false, error: "Failed to load staff" }, { status: 500 });
  }
}
