// src/app/api/admin/teachers/[id]/leave-requests/route.ts
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

const SubmitLeaveRequestSchema = z.object({
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  leaveType: z.enum(["sick", "vacation", "personal", "professional", "other"]),
  reason: z.string().min(1, "Reason is required").max(500),
  notes: z.string().max(1000).optional().nullable(),
});

/**
 * GET /api/admin/teachers/:id/leave-requests
 * Get leave requests for a teacher (attendance records with status "on_leave" and pending approval)
 * Query params: status (pending, approved, rejected), page, limit
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
  const statusFilter = searchParams.get("status"); // pending, approved, rejected
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));

  // Build query - leave requests are attendance records with status "on_leave"
  const query: Record<string, unknown> = {
    teacherId: teacherObjId,
    schoolId: schoolIdObj,
    status: "on_leave",
  };

  // For now, we'll use a notes field to track approval status
  // In a more complex system, you might have a separate LeaveRequest model
  // For simplicity, we'll check if notes contains approval status
  if (statusFilter === "pending") {
    query.notes = { $not: { $regex: /^(APPROVED|REJECTED):/ } };
  } else if (statusFilter === "approved") {
    query.notes = { $regex: /^APPROVED:/ };
  } else if (statusFilter === "rejected") {
    query.notes = { $regex: /^REJECTED:/ };
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

  const data = records.map((r: any) => {
    const notes = r.notes || "";
    const isApproved = notes.startsWith("APPROVED:");
    const isRejected = notes.startsWith("REJECTED:");
    const approvalStatus = isApproved ? "approved" : isRejected ? "rejected" : "pending";
    const actualNotes = notes.replace(/^(APPROVED|REJECTED):\s*/, "");

    return {
      id: String(r._id),
      date: new Date(r.date).toISOString(),
      leaveType: r.leaveType,
      reason: r.reason,
      notes: actualNotes || null,
      approvalStatus,
      recordedBy: r.recordedBy
        ? {
            id: String(r.recordedBy._id),
            name: `${r.recordedBy.firstName || ""} ${r.recordedBy.lastName || ""}`.trim(),
            email: r.recordedBy.email || null,
          }
        : null,
      createdAt: new Date(r.createdAt).toISOString(),
      updatedAt: new Date(r.updatedAt).toISOString(),
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
}

/**
 * POST /api/admin/teachers/:id/leave-requests
 * Submit a leave request (creates attendance records for date range)
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

  const parsed = SubmitLeaveRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;

  const startDate = startOfDay(new Date(input.startDate));
  const endDate = startOfDay(new Date(input.endDate));

  if (endDate < startDate) {
    return Response.json(
      { error: "End date must be after start date" },
      { status: 400 }
    );
  }

  // Generate dates for the range
  const dates: Date[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  // Check for existing records
  const existingDates = await TeacherAttendance.find({
    teacherId: teacherObjId,
    schoolId: schoolIdObj,
    date: { $in: dates },
  }).select("date");

  if (existingDates.length > 0) {
    const existingDateStrs = existingDates.map((r) =>
      new Date(r.date).toLocaleDateString()
    );
    return Response.json(
      {
        error: "Attendance records already exist for some dates",
        existingDates: existingDateStrs,
      },
      { status: 409 }
    );
  }

  // Create attendance records for each date
  const records = await TeacherAttendance.insertMany(
    dates.map((date) => ({
      teacherId: teacherObjId,
      schoolId: schoolIdObj,
      date: startOfDay(date),
      status: "on_leave" as const,
      leaveType: input.leaveType,
      reason: input.reason,
      notes: input.notes || "PENDING", // Mark as pending
      recordedBy: adminUserId ? new mongoose.Types.ObjectId(String(adminUserId)) : undefined,
    }))
  );

  // Log activity
  await logTeacherActivity({
    teacherId: String(teacherObjId),
    schoolId: schoolIdObj,
    type: "leave.submitted",
    title: "Leave request submitted",
    description: `Leave request for ${dates.length} day(s): ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
    metadata: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      leaveType: input.leaveType,
      days: dates.length,
      submittedBy: adminUserId,
    },
    createdBy: adminUserId,
  });

  return Response.json({
    success: true,
    message: `Leave request submitted for ${dates.length} day(s)`,
    data: {
      count: dates.length,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      recordIds: records.map((r) => String(r._id)),
    },
  });
}
