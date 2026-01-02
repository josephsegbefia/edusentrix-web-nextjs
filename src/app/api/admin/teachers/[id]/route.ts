/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/teachers/[id]/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Teacher } from "@/models/Teacher";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { schoolId } = await requireSchoolAdmin();
  await connectToDatabase();

  try {
    const { id } = await ctx.params;
    const teacherRaw = await Teacher.findOne({ _id: id, schoolId })
      .populate("userId", "firstName lastName email phone photoUrl")
      .populate("subjectIds", "name")
      .populate("homeroomClassGroupId", "name")
      .lean();

    if (!teacherRaw)
      return Response.json({ error: "Teacher not found" }, { status: 404 });

    const teacherDoc = teacherRaw as any;
    const u: any = teacherDoc.userId || {};

    return Response.json({
      success: true,
      data: {
        id: String(teacherDoc._id),
        userId: String(u._id || teacherDoc.userId),
        firstName: String(u.firstName || ""),
        lastName: String(u.lastName || ""),
        fullName: `${String(u.firstName || "")} ${String(
          u.lastName || ""
        )}`.trim(),
        email: u.email ? String(u.email) : null,
        phone: u.phone ? String(u.phone) : null,
        photoUrl: u.photoUrl ? String(u.photoUrl) : null,
        status: (teacherDoc.status || "active") as any,
        subjects: (teacherDoc.subjectIds || []).map((s: any) => ({
          id: String(s._id),
          name: String(s.name),
        })),
        homeroom: teacherDoc.homeroomClassGroupId
          ? {
              id: String(teacherDoc.homeroomClassGroupId._id),
              name: String(teacherDoc.homeroomClassGroupId.name),
            }
          : null,
        createdAt: new Date(teacherDoc.createdAt).toISOString(),
        updatedAt: new Date(teacherDoc.updatedAt).toISOString(),
      },
    });
  } catch (e) {
    console.error("Teacher detail error:", e);
    return Response.json(
      { error: "Failed to fetch teacher detail" },
      { status: 500 }
    );
  }
}
