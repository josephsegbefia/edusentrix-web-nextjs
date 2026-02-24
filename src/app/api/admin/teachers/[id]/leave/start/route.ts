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

const StartTeacherLeaveSchema = z.object({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  reason: z.string().trim().max(500).optional().nullable(),
});

/**
 * POST /api/admin/teachers/:id/leave/start
 * Start a leave period for a teacher and set status to "on_leave".
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = StartTeacherLeaveSchema.safeParse(body);
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
  }).select("_id userId status");

  if (!teacher) {
    return Response.json({ error: "Teacher not found" }, { status: 404 });
  }

  if (teacher.status === "terminated") {
    return Response.json(
      { error: "Cannot place a terminated teacher on leave." },
      { status: 400 }
    );
  }

  const reason = parsed.data.reason?.trim() || null;
  const previousStatus = teacher.status;

  await Teacher.findByIdAndUpdate(teacherObjId, {
    $set: {
      status: "on_leave",
      leaveStartDate,
      leaveEndDate,
      leaveReason: reason,
      leaveReminderOffsetsSent: [],
      leaveLastReminderAt: null,
      leaveEndedAt: null,
      leaveEndedBy: null,
      leaveAutoActivatedAt: null,
    },
  });

  await logTeacherActivity({
    teacherId: String(teacher._id),
    schoolId: schoolIdObj,
    type: "leave.approved",
    title: "Leave period started",
    description: `Teacher placed on leave from ${formatDate(
      leaveStartDate
    )} to ${formatDate(leaveEndDate)}.`,
    metadata: {
      previousStatus,
      leaveStartDate: leaveStartDate.toISOString(),
      leaveEndDate: leaveEndDate.toISOString(),
      leaveReason: reason,
      startedBy: adminUserId,
    },
    createdBy: adminUserId,
  });

  if (teacher.userId) {
    await createTeacherNotification({
      schoolId: schoolIdObj,
      userId: teacher.userId as mongoose.Types.ObjectId,
      type: "system",
      title: "Leave Period Scheduled",
      body: reason
        ? `You have been placed on leave from ${formatDate(
            leaveStartDate
          )} to ${formatDate(leaveEndDate)}. Reason: ${reason}`
        : `You have been placed on leave from ${formatDate(
            leaveStartDate
          )} to ${formatDate(leaveEndDate)}.`,
      actionUrl: "/teacher/notifications",
      priority: "normal",
      dedupeKey: `teacher.leave.started:${String(
        teacher._id
      )}:${leaveStartDate.toISOString()}:${leaveEndDate.toISOString()}`,
      metadata: {
        teacherId: String(teacher._id),
        event: "teacher.leave.started",
        leaveStartDate: leaveStartDate.toISOString(),
        leaveEndDate: leaveEndDate.toISOString(),
      },
    });
  }

  return Response.json({
    success: true,
    message: "Teacher leave period started successfully",
    data: {
      id: String(teacher._id),
      status: "on_leave",
      leaveStartDate: leaveStartDate.toISOString(),
      leaveEndDate: leaveEndDate.toISOString(),
      leaveReason: reason,
    },
  });
}
