// src/app/api/admin/teachers/[id]/deactivate/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Teacher } from "@/models/Teacher";
import { logTeacherActivity } from "@/lib/teachers/logTeacherActivity";
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

/**
 * POST /api/admin/teachers/:id/deactivate
 * Deactivate a teacher (set status to "inactive")
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

  // Already inactive
  if (previousStatus === "inactive") {
    return Response.json({
      success: true,
      message: "Teacher is already inactive",
      data: { id: String(teacher._id), status: "inactive" },
    });
  }

  // Can't deactivate a terminated teacher (must reactivate first)
  if (previousStatus === "terminated") {
    return Response.json(
      { error: "Cannot deactivate a terminated teacher. Please activate first." },
      { status: 400 }
    );
  }

  const identityStreamKey = `school:${String(schoolIdObj)}:identity`;
  const auditContext = buildSchoolUserAuditContext(req, {
    userId: adminUserId,
    schoolId: schoolIdObj,
    actorRole: "school_admin",
    idempotencyKey: resolveAuditIdempotencyKey(
      req,
      `teacher.deactivate:${String(teacherObjId)}`
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
      if (beforeDoc.status === "inactive") {
        return;
      }
      if (beforeDoc.status === "terminated") {
        throw new Error("BAD_TERMINATED");
      }

      statusBeforeMutation = beforeDoc.status;

      await Teacher.findByIdAndUpdate(
        teacherObjId,
        { $set: { status: "inactive" } },
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
          after: { status: "inactive" },
        },
        streamKey: identityStreamKey,
      });
      performedUpdate = true;
    });
  } catch (e) {
    if (e instanceof Error && e.message === "TEACHER_NOT_FOUND") {
      return Response.json({ error: "Teacher not found" }, { status: 404 });
    }
    if (e instanceof Error && e.message === "BAD_TERMINATED") {
      return Response.json(
        {
          error:
            "Cannot deactivate a terminated teacher. Please activate first.",
        },
        { status: 400 }
      );
    }
    throw e;
  } finally {
    await session.endSession();
  }

  if (!performedUpdate) {
    return Response.json({
      success: true,
      message: "Teacher is already inactive",
      data: { id: String(teacher._id), status: "inactive" },
    });
  }

  await logTeacherActivity({
    teacherId: String(teacher._id),
    schoolId: schoolIdObj,
    type: "teacher.status_changed",
    title: "Teacher deactivated",
    description: `Status changed from "${statusBeforeMutation}" to "inactive"`,
    metadata: {
      previousStatus: statusBeforeMutation,
      newStatus: "inactive",
      deactivatedBy: adminUserId,
    },
    createdBy: adminUserId,
  });

  return Response.json({
    success: true,
    message: "Teacher deactivated successfully",
    data: { id: String(teacher._id), status: "inactive" },
  });
}
