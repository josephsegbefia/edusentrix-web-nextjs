/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/teachers/logTeacherActivity.ts
import {
  TeacherActivity,
  type TeacherActivityType,
} from "@/models/TeacherActivity";
import mongoose from "mongoose";

export async function logTeacherActivity(args: {
  teacherId: string;
  schoolId: any;
  type: TeacherActivityType;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  createdBy?: any;
}) {
  try {
    await TeacherActivity.create({
      teacherId: new mongoose.Types.ObjectId(args.teacherId),
      schoolId: args.schoolId,
      type: args.type,
      title: args.title,
      description: args.description,
      metadata: args.metadata ?? {},
      createdBy: args.createdBy,
    });
  } catch (e) {
    // Don’t fail business actions if activity logging fails.
    console.warn("logTeacherActivity failed:", e);
  }
}
