// src/models/TeacherDocument.ts
import mongoose, { Schema, model, models, Types } from "mongoose";

export type TeacherDocumentType =
  | "contract"
  | "certificate"
  | "license"
  | "id"
  | "resume"
  | "other";

export interface ITeacherDocument {
  _id: Types.ObjectId;
  teacherId: Types.ObjectId;
  schoolId: Types.ObjectId;

  name: string;
  type: TeacherDocumentType;
  category?: string;

  fileUrl: string;
  fileMime?: string;
  fileSize?: number;

  tags?: string[];
  notes?: string;

  issueDate?: Date;
  expiryDate?: Date;

  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TeacherDocumentSchema = new Schema<ITeacherDocument>(
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

    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["contract", "certificate", "license", "id", "resume", "other"],
      required: true,
      index: true,
    },
    category: { type: String },

    fileUrl: { type: String, required: true },
    fileMime: { type: String },
    fileSize: { type: Number },

    tags: { type: [String], default: [] },
    notes: { type: String },

    issueDate: { type: Date },
    expiryDate: { type: Date, index: true }, // Index for expiring documents query

    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

TeacherDocumentSchema.index({ teacherId: 1, createdAt: -1 });
TeacherDocumentSchema.index({ schoolId: 1, category: 1 });
TeacherDocumentSchema.index({ schoolId: 1, expiryDate: 1 }); // For expiring documents query

export const TeacherDocument =
  models.TeacherDocument ||
  model<ITeacherDocument>("TeacherDocument", TeacherDocumentSchema);
