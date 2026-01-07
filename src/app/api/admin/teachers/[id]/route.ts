/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/teachers/[id]/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Teacher } from "@/models/Teacher";
import { Subject } from "@/models/Subject";
import { ClassGroup } from "@/models/ClassGroup";
import mongoose from "mongoose";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { schoolId } = await requireSchoolAdmin();
  await connectToDatabase();

  const { id } = await ctx.params;
  try {
    const teacherId = String(id || "");
    const teacherObjId = toObjectIdOrNull(teacherId);
    if (!teacherObjId) {
      return Response.json({ error: "Invalid teacher id" }, { status: 400 });
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const teacherRaw = await Teacher.findOne({
      _id: teacherObjId,
      schoolId: schoolIdObj,
    })
      .populate("userId", "firstName lastName email phone photoUrl")
      .populate({ path: "subjectIds", select: "name", model: Subject })
      .populate({
        path: "homeroomClassGroupId",
        select: "name",
        model: ClassGroup,
      })
      .lean();

    if (!teacherRaw) {
      return Response.json({ error: "Teacher not found" }, { status: 404 });
    }

    const t = teacherRaw as any;
    const u: any = t.userId || {};

    const createdAt = t.createdAt ? new Date(t.createdAt) : new Date();
    const updatedAt = t.updatedAt ? new Date(t.updatedAt) : createdAt;

    const today = startOfDay(new Date());
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const subjects = Array.isArray(t.subjectIds)
      ? t.subjectIds.slice(0, 50).map((s: any) => ({
          id: String(s._id),
          name: String(s.name),
        }))
      : [];

    const homeroom = t.homeroomClassGroupId
      ? {
          id: String(t.homeroomClassGroupId._id),
          name: String(t.homeroomClassGroupId.name),
        }
      : null;

    return Response.json({
      success: true,
      data: {
        id: String(t._id),
        userId: String(u._id || t.userId),

        firstName: String(u.firstName || ""),
        lastName: String(u.lastName || ""),
        fullName: `${String(u.firstName || "")} ${String(
          u.lastName || ""
        )}`.trim(),

        email: u.email ? String(u.email) : null,
        phone: u.phone ? String(u.phone) : null,
        photoUrl: u.photoUrl ? String(u.photoUrl) : null,

        status: (t.status || "active") as any,

        // ✅ extra professional fields (safe defaults)
        employeeId: t.employeeId ? String(t.employeeId) : null,
        department: t.department ? String(t.department) : null,
        hireDate: t.hireDate ? new Date(t.hireDate).toISOString() : null,
        terminationDate: t.terminationDate
          ? new Date(t.terminationDate).toISOString()
          : null,

        maxClasses: typeof t.maxClasses === "number" ? t.maxClasses : null,
        maxStudents: typeof t.maxStudents === "number" ? t.maxStudents : null,

        emergencyContact: t.emergencyContact || null,
        qualifications: Array.isArray(t.qualifications) ? t.qualifications : [],

        tags: Array.isArray(t.tags) ? t.tags : [],
        notes: t.notes ? String(t.notes) : null,

        subjects,
        homeroom,

        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        isNew: createdAt >= sevenDaysAgo,
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
