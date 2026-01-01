// src/models/TeacherNote.ts
import mongoose, { Schema, model, models, Types } from "mongoose";

export type TeacherNoteVisibility = "internal" | "private";

export interface ITeacherNote {
  _id: Types.ObjectId;
  teacherId: Types.ObjectId;
  schoolId: Types.ObjectId;

  content: string;
  visibility: TeacherNoteVisibility;

  tags?: string[];

  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TeacherNoteSchema = new Schema<ITeacherNote>(
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

    content: { type: String, required: true },
    visibility: {
      type: String,
      enum: ["internal", "private"],
      default: "internal",
      index: true,
    },

    tags: { type: [String], default: [] },

    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

TeacherNoteSchema.index({ teacherId: 1, createdAt: -1 });

export const TeacherNote =
  models.TeacherNote || model<ITeacherNote>("TeacherNote", TeacherNoteSchema);
