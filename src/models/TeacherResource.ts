import { Schema, model, models, Types } from "mongoose";

export type TeacherResourceType =
  | "link"
  | "pdf"
  | "video"
  | "image"
  | "doc"
  | "slides"
  | "other";

export interface ITeacherResource {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  title: string;
  description?: string;
  url: string;
  type: TeacherResourceType;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const TeacherResourceSchema = new Schema<ITeacherResource>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    url: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["link", "pdf", "video", "image", "doc", "slides", "other"],
      default: "link",
      index: true,
    },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

TeacherResourceSchema.index({ schoolId: 1, teacherId: 1, type: 1, createdAt: -1 });
TeacherResourceSchema.index({ schoolId: 1, teacherId: 1, tags: 1 });

export const TeacherResource =
  models.TeacherResource ||
  model<ITeacherResource>("TeacherResource", TeacherResourceSchema);
