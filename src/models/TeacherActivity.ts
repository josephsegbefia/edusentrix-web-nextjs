/* eslint-disable @typescript-eslint/no-explicit-any */
// src/models/TeacherActivity.ts
import mongoose, { Schema, model, models, Types } from "mongoose";

export type TeacherActivityType =
  | "teacher.created"
  | "teacher.updated"
  | "teacher.status_changed"
  | "teacher.homeroom_changed"
  | "assignment.created"
  | "assignment.updated"
  | "assignment.deleted"
  | "attendance.marked"
  | "document.added"
  | "document.deleted"
  | "note.added"
  | "note.updated"
  | "note.deleted"
  | "performance.evaluated"
  | "leave.submitted"
  | "leave.approved"
  | "leave.rejected"
  | "leave.cancelled";

export interface ITeacherActivity {
  _id: Types.ObjectId;
  teacherId: Types.ObjectId;
  schoolId: Types.ObjectId;

  type: TeacherActivityType;
  title: string;
  description?: string;
  metadata?: Record<string, any>;

  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TeacherActivitySchema = new Schema<ITeacherActivity>(
  {
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },

    type: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String },
    metadata: { type: Schema.Types.Mixed },

    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

TeacherActivitySchema.index({ teacherId: 1, createdAt: -1 });

export const TeacherActivity =
  models.TeacherActivity ||
  model<ITeacherActivity>("TeacherActivity", TeacherActivitySchema);
