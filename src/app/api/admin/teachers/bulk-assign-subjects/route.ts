// src/app/api/admin/teachers/bulk-assign-subjects/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Teacher } from "@/models/Teacher";
import { Subject } from "@/models/Subject";
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

const BulkAssignSubjectsSchema = z.object({
  teacherIds: z.array(z.string().min(1)).min(1, "At least one teacher is required"),
  subjectIds: z.array(z.string().min(1)).min(1, "At least one subject is required"),
});

/**
 * POST /api/admin/teachers/bulk-assign-subjects
 * Bulk assign subjects to multiple teachers
 * Body: { teacherIds: string[], subjectIds: string[] }
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

  const parsed = BulkAssignSubjectsSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { teacherIds, subjectIds } = parsed.data;

  // Convert to ObjectIds
  const teacherObjIds = teacherIds
    .map((id) => toObjectIdOrNull(id))
    .filter((id): id is mongoose.Types.ObjectId => id !== null);

  const subjectObjIds = subjectIds
    .map((id) => toObjectIdOrNull(id))
    .filter((id): id is mongoose.Types.ObjectId => id !== null);

  if (teacherObjIds.length === 0 || subjectObjIds.length === 0) {
    return Response.json({ error: "Invalid teacher or subject ids" }, { status: 400 });
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

  // Verify all subjects exist and belong to school
  const subjects = await Subject.find({
    _id: { $in: subjectObjIds },
    schoolId: schoolIdObj,
    isActive: true,
  });

  if (subjects.length !== subjectObjIds.length) {
    return Response.json(
      { error: "Some subjects not found, inactive, or don't belong to your school" },
      { status: 400 }
    );
  }

  // Update all teachers
  const results = [];
  for (const teacher of teachers) {
    const currentSubjectIds = (teacher.subjectIds || []).map((id) => String(id));
    const newSubjectIds = Array.from(
      new Set([...currentSubjectIds, ...subjectIds.map((id) => String(id))])
    );

    // Only update if there are new subjects
    if (newSubjectIds.length > currentSubjectIds.length) {
      await Teacher.findByIdAndUpdate(teacher._id, {
        $set: { subjectIds: newSubjectIds.map((id) => new mongoose.Types.ObjectId(id)) },
      });

      // Log activity for each teacher
      await logTeacherActivity({
        teacherId: String(teacher._id),
        schoolId: schoolIdObj,
        type: "teacher.updated",
        title: "Subjects assigned (bulk)",
        description: `Subjects assigned via bulk operation: ${subjects.map((s) => s.name).join(", ")}`,
        metadata: {
          subjectIds: subjectIds,
          assignedBy: adminUserId,
          isBulkOperation: true,
        },
        createdBy: adminUserId,
      });

      results.push({
        teacherId: String(teacher._id),
        success: true,
        subjectsAdded: newSubjectIds.length - currentSubjectIds.length,
      });
    } else {
      results.push({
        teacherId: String(teacher._id),
        success: true,
        subjectsAdded: 0,
        message: "All subjects already assigned",
      });
    }
  }

  return Response.json({
    success: true,
    message: `Subjects assigned to ${results.length} teacher(s)`,
    data: {
      teachersProcessed: results.length,
      results,
    },
  });
}
