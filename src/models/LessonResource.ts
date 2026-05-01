import { Schema, model, models, type Model, type Types } from "mongoose";

export type LessonResourceKind = "link" | "library_book";

export type LessonResourceVisibility = "teacher_only" | "students" | "students_and_parents";

export interface ILessonResource {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  lessonId: Types.ObjectId;
  teacherId: Types.ObjectId;
  kind: LessonResourceKind;
  title: string;
  description?: string;
  /** Present when `kind === "link"` */
  url?: string;
  /** Optional hint: pdf, video, link, etc. */
  linkType?: string;
  /** Present when `kind === "library_book"` */
  libraryBookId?: Types.ObjectId;
  visibility: LessonResourceVisibility;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const lessonResourceSchema = new Schema<ILessonResource>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    lessonId: { type: Schema.Types.ObjectId, ref: "Lesson", required: true, index: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true, index: true },
    kind: {
      type: String,
      enum: ["link", "library_book"],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 220 },
    description: { type: String, trim: true, maxlength: 500 },
    url: { type: String, trim: true, maxlength: 2000 },
    linkType: { type: String, trim: true, maxlength: 40 },
    libraryBookId: { type: Schema.Types.ObjectId, ref: "LibraryBook", index: true },
    visibility: {
      type: String,
      enum: ["teacher_only", "students", "students_and_parents"],
      default: "students",
      index: true,
    },
    order: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

lessonResourceSchema.index({ schoolId: 1, lessonId: 1, order: 1 });

export const LessonResource: Model<ILessonResource> =
  (models.LessonResource as Model<ILessonResource>) ||
  model<ILessonResource>("LessonResource", lessonResourceSchema);
