// src/app/api/admin/teachers/bulk-change-status/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Teacher } from "@/models/Teacher";
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

const BulkChangeStatusSchema = z.object({
  teacherIds: z.array(z.string().min(1)).min(1, "At least one teacher is required"),
  status: z.enum(["active", "inactive", "on_leave", "terminated"]),
});

/**
 * POST /api/admin/teachers/bulk-change-status
 * Bulk change status for multiple teachers
 * Body: { teacherIds: string[], status: TeacherStatus }
 */
export async function POST(req: NextRequest) {
  const { schoolId, userId: adminUserId } = await requireSchoolAdmin();
  await connectToDatabase();

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

  const parsed = BulkChangeStatusSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { teacherIds, status } = parsed.data;

  // Convert to ObjectIds
  const teacherObjIds = teacherIds
    .map((id) => toObjectIdOrNull(id))
    .filter((id): id is mongoose.Types.ObjectId => id !== null);

  if (teacherObjIds.length === 0) {
    return Response.json({ error: "Invalid teacher ids" }, { status: 400 });
  }

  // Verify all teachers exist and belong to school
  const teachers = await Teacher.find({
    _id: { $in: teacherObjIds },
    schoolId: schoolIdObj,
  });

  if (teachers.length !== teacherObjIds.length) {
    return Response.json(
      { error: "Some teachers not found or don't belong to your school" },
      { status: 400 }
    );
  }

  // Update all teachers
  const updateData: Record<string, unknown> = {
    status,
  };

  // If terminating, set terminationDate
  if (status === "terminated") {
    updateData.terminationDate = new Date();
  }
  // If activating, clear terminationDate
  else if (status === "active") {
    updateData.terminationDate = null;
  }

  await Teacher.updateMany(
    { _id: { $in: teacherObjIds }, schoolId: schoolIdObj },
    { $set: updateData }
  );

  // Log activity for each teacher
  const activityPromises = teachers.map((teacher) =>
    logTeacherActivity({
      teacherId: String(teacher._id),
      schoolId: schoolIdObj,
      type: "teacher.status_changed",
      title: "Status changed (bulk)",
      description: `Status changed from "${teacher.status}" to "${status}" via bulk operation`,
      metadata: {
        previousStatus: teacher.status,
        newStatus: status,
        changedBy: adminUserId,
        isBulkOperation: true,
      },
      createdBy: adminUserId,
    })
  );

  await Promise.all(activityPromises);

  return Response.json({
    success: true,
    message: `Status changed to "${status}" for ${teachers.length} teacher(s)`,
    data: {
      teachersProcessed: teachers.length,
      status,
    },
  });
}
