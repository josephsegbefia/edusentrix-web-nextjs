// src/app/api/admin/teachers/[id]/activate/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Teacher } from "@/models/Teacher";
import { logTeacherActivity } from "@/lib/teachers/logTeacherActivity";
import { createTeacherNotification } from "@/lib/teachers/teacherNotifications";
import mongoose from "mongoose";
import { writeTransactionalAuditEvent } from "@/lib/audit/writeTransactionalAuditEvent";
import {
  buildSchoolUserAuditContext,
  resolveAuditIdempotencyKey,
} from "@/lib/audit/fromApiRoute";

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

  const leaveEndedAt = new Date();
  const identityStreamKey = `school:${String(schoolIdObj)}:identity`;
  const auditContext = buildSchoolUserAuditContext(req, {
    userId: adminUserId,
    schoolId: schoolIdObj,
    actorRole: "school_admin",
    idempotencyKey: resolveAuditIdempotencyKey(
      req,
      `teacher.activate:${String(teacherObjId)}`
    ),
  });

  let performedUpdate = false;
  let statusBeforeMutation = previousStatus;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const beforeDoc = await Teacher.findOne({
        _id: teacherObjId,
        schoolId: schoolIdObj,
      })
        .session(session)
        .select("status")
        .lean();
      if (!beforeDoc) {
        throw new Error("TEACHER_NOT_FOUND");
      }
      if (beforeDoc.status === "active") {
        return;
      }

      statusBeforeMutation = beforeDoc.status;

      await Teacher.findByIdAndUpdate(
        teacherObjId,
        {
          $set: {
            status: "active",
            terminationDate: null,
            ...(beforeDoc.status === "on_leave"
              ? {
                  leaveEndedAt,
                  leaveEndedBy: adminUserId,
                  leaveAutoActivatedAt: null,
                }
              : {}),
          },
        },
        { session }
      );

      await writeTransactionalAuditEvent(session, {
        actionCode: "teacher.status.updated",
        scopeType: "school",
        scopeId: String(schoolIdObj),
        result: "succeeded",
        target: {
          targetEntityType: "Teacher",
          targetEntityId: teacherObjId,
        },
        context: auditContext,
        payload: {
          before: { status: beforeDoc.status },
          after: { status: "active" },
          metadata: {
            fromLeave: beforeDoc.status === "on_leave",
          },
        },
        streamKey: identityStreamKey,
      });
      performedUpdate = true;
    });
  } catch (e) {
    if (e instanceof Error && e.message === "TEACHER_NOT_FOUND") {
      return Response.json({ error: "Teacher not found" }, { status: 404 });
    }
    throw e;
  } finally {
    await session.endSession();
  }

  if (!performedUpdate) {
    return Response.json({
      success: true,
      message: "Teacher is already active",
      data: { id: String(teacher._id), status: "active" },
    });
  }

  // Log activity
  await logTeacherActivity({
    teacherId: String(teacher._id),
    schoolId: schoolIdObj,
    type: statusBeforeMutation === "on_leave" ? "leave.cancelled" : "teacher.status_changed",
    title:
      statusBeforeMutation === "on_leave"
        ? "Leave ended manually"
        : "Teacher activated",
    description:
      statusBeforeMutation === "on_leave"
        ? `Leave ended manually. Status changed from "on_leave" to "active".`
        : `Status changed from "${statusBeforeMutation}" to "active"`,
    metadata: {
      previousStatus: statusBeforeMutation,
      newStatus: "active",
      activatedBy: adminUserId,
      leaveEndedAt: statusBeforeMutation === "on_leave" ? leaveEndedAt.toISOString() : undefined,
    },
    createdBy: adminUserId,
  });

  if (statusBeforeMutation === "on_leave" && teacher.userId) {
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
      statusBeforeMutation === "on_leave"
        ? "Teacher leave ended and status updated to active"
        : "Teacher activated successfully",
    data: { id: String(teacher._id), status: "active" },
  });
}
