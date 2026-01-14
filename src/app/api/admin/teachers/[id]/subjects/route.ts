// src/app/api/admin/teachers/[id]/subjects/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Teacher } from "@/models/Teacher";
import { Subject } from "@/models/Subject";
import { logTeacherActivity } from "@/lib/teachers/logTeacherActivity";
import mongoose from "mongoose";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * GET /api/admin/teachers/:id/subjects
 * Get all subjects assigned to a teacher
 */
export async function GET(
  _req: NextRequest,
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

  const teacher = await Teacher.findOne({
    _id: teacherObjId,
    schoolId: schoolIdObj,
  }).populate("subjectIds", "name code isActive");

  if (!teacher) {
    return Response.json({ error: "Teacher not found" }, { status: 404 });
  }

  const subjects = (teacher.subjectIds || []).map((s: any) => ({
    id: String(s._id),
    name: String(s.name || ""),
    code: s.code ? String(s.code) : null,
    isActive: s.isActive !== false,
  }));

  return Response.json({
    success: true,
    data: subjects,
  });
}

/**
 * POST /api/admin/teachers/:id/subjects
 * Add subject(s) to a teacher
 * Body: { subjectIds: string[] }
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

  // Parse body
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { subjectIds } = body;
  if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
    return Response.json(
      { error: "subjectIds must be a non-empty array" },
      { status: 400 }
    );
  }

  // Find teacher
  const teacher = await Teacher.findOne({
    _id: teacherObjId,
    schoolId: schoolIdObj,
  });

  if (!teacher) {
    return Response.json({ error: "Teacher not found" }, { status: 404 });
  }

  // Validate and collect valid subject IDs
  const validSubjectIds: mongoose.Types.ObjectId[] = [];
  const addedSubjectNames: string[] = [];
  const existingSubjectIds = new Set(
    (teacher.subjectIds || []).map((sid: mongoose.Types.ObjectId) =>
      String(sid)
    )
  );

  for (const sid of subjectIds) {
    const subjectObjId = toObjectIdOrNull(sid);
    if (!subjectObjId) continue;

    // Skip if already assigned
    if (existingSubjectIds.has(String(subjectObjId))) continue;

    const subject = await Subject.findOne({
      _id: subjectObjId,
      schoolId: schoolIdObj,
      isActive: true,
    });

    if (subject) {
      validSubjectIds.push(subjectObjId);
      addedSubjectNames.push(String(subject.name));
    }
  }

  if (validSubjectIds.length === 0) {
    return Response.json({
      success: true,
      message: "No new subjects to add",
      data: { added: 0 },
    });
  }

  // Add subjects to teacher
  await Teacher.findByIdAndUpdate(teacherObjId, {
    $addToSet: { subjectIds: { $each: validSubjectIds } },
  });

  // Log activity
  await logTeacherActivity({
    teacherId: String(teacher._id),
    schoolId: schoolIdObj,
    type: "assignment.created",
    title: "Subjects assigned",
    description: `Added subjects: ${addedSubjectNames.join(", ")}`,
    metadata: {
      subjectIds: validSubjectIds.map((id) => String(id)),
      subjectNames: addedSubjectNames,
      assignedBy: adminUserId,
    },
    createdBy: adminUserId,
  });

  return Response.json({
    success: true,
    message: `Added ${validSubjectIds.length} subject(s)`,
    data: {
      added: validSubjectIds.length,
      subjectNames: addedSubjectNames,
    },
  });
}
