import { Schema, model, models, Types } from "mongoose";

export type LessonNoteStatus = "draft" | "published";

export interface ILessonNoteResource {
  title: string;
  url: string;
  type?: string;
}

export interface ILessonNote {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  subjectId?: Types.ObjectId;
  academicPeriodId?: Types.ObjectId;
  weekOf: Date;
  topic: string;
  objectives?: string;
  content: string;
  status: LessonNoteStatus;
  resources?: ILessonNoteResource[];
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ResourceSchema = new Schema<ILessonNoteResource>(
  {
    title: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    type: { type: String, trim: true },
  },
  { _id: false }
);

const LessonNoteSchema = new Schema<ILessonNote>(
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
    classGroupId: {
      type: Schema.Types.ObjectId,
      ref: "ClassGroup",
      required: true,
      index: true,
    },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", index: true },
    academicPeriodId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      index: true,
    },
    weekOf: { type: Date, required: true, index: true },
    topic: { type: String, required: true, trim: true, maxlength: 200 },
    objectives: { type: String, trim: true, maxlength: 2000 },
    content: { type: String, required: true, trim: true, maxlength: 8000 },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
      index: true,
    },
    resources: { type: [ResourceSchema], default: [] },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

LessonNoteSchema.index({ schoolId: 1, teacherId: 1, classGroupId: 1, weekOf: -1 });
LessonNoteSchema.index({ schoolId: 1, teacherId: 1, subjectId: 1, weekOf: -1 });
LessonNoteSchema.index({ schoolId: 1, teacherId: 1, status: 1, weekOf: -1 });

export const LessonNote =
  models.LessonNote || model<ILessonNote>("LessonNote", LessonNoteSchema);
