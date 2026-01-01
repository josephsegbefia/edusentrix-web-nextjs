/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/teachers/getTeacherOrThrow.ts
import { Teacher } from "@/models/Teacher";
import mongoose from "mongoose";

export async function getTeacherOrThrow(params: {
  teacherId: string;
  schoolId: any;
}) {
  if (!mongoose.Types.ObjectId.isValid(params.teacherId)) {
    throw new Error("Invalid teacherId");
  }

  const teacher = await Teacher.findOne({
    _id: params.teacherId,
    schoolId: params.schoolId,
  }).lean();
  if (!teacher) {
    const err = new Error("Teacher not found");
    (err as any).statusCode = 404;
    throw err;
  }
  return teacher;
}
