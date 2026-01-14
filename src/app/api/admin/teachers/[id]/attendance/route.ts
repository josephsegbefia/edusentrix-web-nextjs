// src/app/api/admin/teachers/[id]/attendance/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { TeacherAttendance } from "@/models/TeacherAttendance";
import { logTeacherActivity } from "@/lib/teachers/logTeacherActivity";
import mongoose from "mongoose";
import { z } from "zod";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

const RecordAttendanceSchema = z.object({
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)), // ISO date or YYYY-MM-DD
  status: z.enum(["present", "absent", "late", "on_leave", "sick", "other"]),
  checkInTime: z.string().datetime().optional().nullable(),
  checkOutTime: z.string().datetime().optional().nullable(),
  minutesLate: z.number().min(0).optional().nullable(),
  leaveType: z.enum(["sick", "vacation", "personal", "professional", "other"]).optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

/**
 * GET /api/admin/teachers/:id/attendance
 * Get attendance records for a teacher
 * Query params: startDate, endDate, status, page, limit
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { schoolId } = await requireSchoolAdmin();
  await connectToDatabase();

  const { id } = await ctx.params;
  const teacherObjId = toObjectIdOrNull(String(id));

  if (!teacherObjId) {
    return Response.json({ error: "Invalid teacher id" }, { status: 400 });
  }

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  const { searchParams } = new URL(req.url);
  const startDateStr = searchParams.get("startDate");
  const endDateStr = searchParams.get("endDate");
  const status = searchParams.get("status") as
    | "present"
    | "absent"
    | "late"
    | "on_leave"
    | "sick"
    | "other"
    | null;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));

  // Build query
  const query: Record<string, unknown> = {
    teacherId: teacherObjId,
    schoolId: schoolIdObj,
  };

  if (status) {
    query.status = status;
  }

  if (startDateStr || endDateStr) {
    const dateQuery: { $gte?: Date; $lte?: Date } = {};
    if (startDateStr) {
      const startDate = startOfDay(new Date(startDateStr));
      dateQuery.$gte = startDate;
    }
    if (endDateStr) {
      const endDate = startOfDay(new Date(endDateStr));
      endDate.setHours(23, 59, 59, 999);
      dateQuery.$lte = endDate;
    }
    query.date = dateQuery;
  }

  // Get total count
  const total = await TeacherAttendance.countDocuments(query);

  // Get records
  const records = await TeacherAttendance.find(query)
    .populate("recordedBy", "firstName lastName email")
    .sort({ date: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const data = records.map((r: any) => ({
    id: String(r._id),
    date: new Date(r.date).toISOString(),
    status: r.status,
    checkInTime: r.checkInTime ? new Date(r.checkInTime).toISOString() : null,
    checkOutTime: r.checkOutTime ? new Date(r.checkOutTime).toISOString() : null,
    minutesLate: r.minutesLate ?? null,
    leaveType: r.leaveType ?? null,
    reason: r.reason ?? null,
    notes: r.notes ?? null,
    recordedBy: r.recordedBy
      ? {
          id: String(r.recordedBy._id),
          name: `${r.recordedBy.firstName || ""} ${r.recordedBy.lastName || ""}`.trim(),
          email: r.recordedBy.email || null,
        }
      : null,
    createdAt: new Date(r.createdAt).toISOString(),
    updatedAt: new Date(r.updatedAt).toISOString(),
  }));

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
}

/**
 * POST /api/admin/teachers/:id/attendance
 * Record attendance for a teacher
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { schoolId, userId: adminUserId } = await requireSchoolAdmin();
  await connectToDatabase();

  const { id } = await ctx.params;
  const teacherObjId = toObjectIdOrNull(String(id));

  if (!teacherObjId) {
    return Response.json({ error: "Invalid teacher id" }, { status: 400 });
  }

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  // Parse and validate body
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RecordAttendanceSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;

  // Normalize date to start of day
  const attendanceDate = startOfDay(new Date(input.date));

  // Check if record already exists
  const existing = await TeacherAttendance.findOne({
    teacherId: teacherObjId,
    schoolId: schoolIdObj,
    date: attendanceDate,
  });

  if (existing) {
    return Response.json(
      { error: "Attendance record already exists for this date. Use PATCH to update." },
      { status: 409 }
    );
  }

  // Create attendance record
  const attendance = await TeacherAttendance.create({
    teacherId: teacherObjId,
    schoolId: schoolIdObj,
    date: attendanceDate,
    status: input.status,
    checkInTime: input.checkInTime ? new Date(input.checkInTime) : undefined,
    checkOutTime: input.checkOutTime ? new Date(input.checkOutTime) : undefined,
    minutesLate: input.minutesLate ?? undefined,
    leaveType: input.leaveType ?? undefined,
    reason: input.reason ?? undefined,
    notes: input.notes ?? undefined,
    recordedBy: adminUserId ? new mongoose.Types.ObjectId(String(adminUserId)) : undefined,
  });

  // Log activity
  await logTeacherActivity({
    teacherId: String(teacherObjId),
    schoolId: schoolIdObj,
    type: "attendance.marked",
    title: "Attendance recorded",
    description: `Recorded ${input.status} for ${attendanceDate.toLocaleDateString()}`,
    metadata: {
      attendanceId: String(attendance._id),
      date: attendanceDate.toISOString(),
      status: input.status,
      recordedBy: adminUserId,
    },
    createdBy: adminUserId,
  });

  return Response.json({
    success: true,
    message: "Attendance recorded successfully",
    data: {
      id: String(attendance._id),
      date: attendanceDate.toISOString(),
      status: input.status,
    },
  });
}
