// src/app/api/admin/teachers/[id]/assignments/[assignmentId]/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import mongoose from "mongoose";
import { TeacherAssignment } from "@/models/TeacherAssignment";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: { id: string; assignmentId: string } }
) {
  const { schoolId } = await requireSchoolAdmin();
  await connectToDatabase();

  const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
  const teacherObjId = toObjectIdOrNull(String(ctx.params.id));
  const assignmentObjId = toObjectIdOrNull(String(ctx.params.assignmentId));

  if (!teacherObjId || !assignmentObjId) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const res = await TeacherAssignment.updateOne(
    { _id: assignmentObjId, schoolId: schoolIdObj, teacherId: teacherObjId },
    { $set: { status: "inactive" } }
  );

  if (res.matchedCount === 0) {
    return Response.json({ error: "Assignment not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}
