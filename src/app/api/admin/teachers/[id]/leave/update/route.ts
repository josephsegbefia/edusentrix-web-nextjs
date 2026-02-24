import { NextRequest } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Teacher } from "@/models/Teacher";
import { logTeacherActivity } from "@/lib/teachers/logTeacherActivity";
import { createTeacherNotification } from "@/lib/teachers/teacherNotifications";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function parseDateInput(value: string): Date | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-").map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const UpdateTeacherLeaveSchema = z.object({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  reason: z.string().trim().max(500).optional().nullable(),
});

/**
 * PATCH /api/admin/teachers/:id/leave/update
 * Update leave dates for a teacher already on leave.
 */
export async function PATCH(
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = UpdateTeacherLeaveSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const leaveStartDate = parseDateInput(parsed.data.startDate);
  const leaveEndDate = parseDateInput(parsed.data.endDate);
  if (!leaveStartDate || !leaveEndDate) {
    return Response.json(
      { error: "Invalid leave dates. Use valid ISO or YYYY-MM-DD dates." },
      { status: 400 }
    );
  }

  if (leaveEndDate < leaveStartDate) {
    return Response.json(
      { error: "Leave end date must be on or after leave start date." },
      { status: 400 }
    );
  }

  const teacher = await Teacher.findOne({
    _id: teacherObjId,
    schoolId: schoolIdObj,
  }).select("_id userId status leaveStartDate leaveEndDate leaveReason");

  if (!teacher) {
    return Response.json({ error: "Teacher not found" }, { status: 404 });
  }

  if (teacher.status !== "on_leave") {
    return Response.json(
      { error: "Teacher is not on leave. Use start leave to place them on leave." },
      { status: 400 }
    );
  }

  const reason = parsed.data.reason?.trim() || teacher.leaveReason || null;

  await Teacher.findByIdAndUpdate(teacherObjId, {
    $set: {
      leaveStartDate,
      leaveEndDate,
      leaveReason: reason,
      leaveReminderOffsetsSent: [],
      leaveLastReminderAt: null,
    },
  });

  await logTeacherActivity({
    teacherId: String(teacher._id),
    schoolId: schoolIdObj,
    type: "leave.updated",
    title: "Leave period updated",
    description: `Leave dates changed to ${formatDate(leaveStartDate)} – ${formatDate(leaveEndDate)}.`,
    metadata: {
      leaveStartDate: leaveStartDate.toISOString(),
      leaveEndDate: leaveEndDate.toISOString(),
      leaveReason: reason,
      updatedBy: adminUserId,
    },
    createdBy: adminUserId,
  });

  if (teacher.userId) {
    await createTeacherNotification({
      schoolId: schoolIdObj,
      userId: teacher.userId as mongoose.Types.ObjectId,
      type: "system",
      title: "Leave Period Updated",
      body: reason
        ? `Your leave has been updated to ${formatDate(leaveStartDate)} – ${formatDate(leaveEndDate)}. Reason: ${reason}`
        : `Your leave has been updated to ${formatDate(leaveStartDate)} – ${formatDate(leaveEndDate)}.`,
      actionUrl: "/teacher/notifications",
      priority: "normal",
      dedupeKey: `teacher.leave.updated:${String(teacher._id)}:${leaveStartDate.toISOString()}:${leaveEndDate.toISOString()}`,
      metadata: {
        teacherId: String(teacher._id),
        event: "teacher.leave.updated",
        leaveStartDate: leaveStartDate.toISOString(),
        leaveEndDate: leaveEndDate.toISOString(),
      },
    });
  }

  return Response.json({
    success: true,
    message: "Leave period updated successfully",
    data: {
      id: String(teacher._id),
      status: "on_leave",
      leaveStartDate: leaveStartDate.toISOString(),
      leaveEndDate: leaveEndDate.toISOString(),
      leaveReason: reason,
    },
  });
}
