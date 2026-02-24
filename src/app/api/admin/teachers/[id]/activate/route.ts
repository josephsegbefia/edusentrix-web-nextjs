// src/app/api/admin/teachers/[id]/activate/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Teacher } from "@/models/Teacher";
import { logTeacherActivity } from "@/lib/teachers/logTeacherActivity";
import { createTeacherNotification } from "@/lib/teachers/teacherNotifications";
import mongoose from "mongoose";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * POST /api/admin/teachers/:id/activate
 * Activate a teacher (set status to "active", clear terminationDate)
 */
export async function POST(
  _req: NextRequest,
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

  // Find teacher
  const teacher = await Teacher.findOne({
    _id: teacherObjId,
    schoolId: schoolIdObj,
  });

  if (!teacher) {
    return Response.json({ error: "Teacher not found" }, { status: 404 });
  }

  const previousStatus = teacher.status;

  // Already active
  if (previousStatus === "active") {
    return Response.json({
      success: true,
      message: "Teacher is already active",
      data: { id: String(teacher._id), status: "active" },
    });
  }

  // Update teacher status
  const leaveEndedAt = new Date();
  await Teacher.findByIdAndUpdate(teacherObjId, {
    $set: {
      status: "active",
      terminationDate: null, // Clear termination date when activating
      ...(previousStatus === "on_leave"
        ? {
            leaveEndedAt,
            leaveEndedBy: adminUserId,
            leaveAutoActivatedAt: null,
          }
        : {}),
    },
  });

  // Log activity
  await logTeacherActivity({
    teacherId: String(teacher._id),
    schoolId: schoolIdObj,
    type: previousStatus === "on_leave" ? "leave.cancelled" : "teacher.status_changed",
    title:
      previousStatus === "on_leave"
        ? "Leave ended manually"
        : "Teacher activated",
    description:
      previousStatus === "on_leave"
        ? `Leave ended manually. Status changed from "on_leave" to "active".`
        : `Status changed from "${previousStatus}" to "active"`,
    metadata: {
      previousStatus,
      newStatus: "active",
      activatedBy: adminUserId,
      leaveEndedAt: previousStatus === "on_leave" ? leaveEndedAt.toISOString() : undefined,
    },
    createdBy: adminUserId,
  });

  if (previousStatus === "on_leave" && teacher.userId) {
    const leaveEndDate =
      teacher.leaveEndDate instanceof Date
        ? teacher.leaveEndDate
        : teacher.leaveEndDate
        ? new Date(teacher.leaveEndDate)
        : null;

    await createTeacherNotification({
      schoolId: schoolIdObj,
      userId: teacher.userId as mongoose.Types.ObjectId,
      type: "system",
      title: "Leave Ended by Admin",
      body: leaveEndDate
        ? `Your leave has been ended by the school administration. You are now active. (Scheduled end: ${formatDate(
            leaveEndDate
          )})`
        : "Your leave has been ended by the school administration. You are now active.",
      actionUrl: "/teacher/notifications",
      priority: "high",
      dedupeKey: `teacher.leave.manually-ended:${String(teacher._id)}:${leaveEndedAt.toISOString()}`,
      metadata: {
        teacherId: String(teacher._id),
        event: "teacher.leave.manually_ended",
        leaveEndedAt: leaveEndedAt.toISOString(),
      },
    });
  }

  return Response.json({
    success: true,
    message:
      previousStatus === "on_leave"
        ? "Teacher leave ended and status updated to active"
        : "Teacher activated successfully",
    data: { id: String(teacher._id), status: "active" },
  });
}
