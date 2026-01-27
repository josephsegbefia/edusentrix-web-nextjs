// src/models/TeacherNote.ts
import mongoose, { Schema, model, models, Types } from "mongoose";

export type TeacherNoteVisibility = "internal" | "private";
export type TeacherNoteCategory =
  | "general"
  | "performance"
  | "behavior"
  | "professional_development"
  | "disciplinary"
  | "other";

export interface ITeacherNote {
  _id: Types.ObjectId;
  teacherId: Types.ObjectId;
  schoolId: Types.ObjectId;

  title: string;
  content: string;
  category?: TeacherNoteCategory;
  visibility: TeacherNoteVisibility;
  isConfidential?: boolean; // Alias for visibility === "private", for compatibility

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

    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    category: {
      type: String,
      enum: ["general", "performance", "behavior", "professional_development", "disciplinary", "other"],
      index: true,
    },
    visibility: {
      type: String,
      enum: ["internal", "private"],
      default: "internal",
      index: true,
    },
    isConfidential: { type: Boolean, default: false, index: true }, // For compatibility

    tags: { type: [String], default: [] },

    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

TeacherNoteSchema.index({ teacherId: 1, createdAt: -1 });

export const TeacherNote =
  models.TeacherNote || model<ITeacherNote>("TeacherNote", TeacherNoteSchema);
