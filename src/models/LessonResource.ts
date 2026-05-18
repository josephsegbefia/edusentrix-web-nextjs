import { Schema, model, models, type Model, type Types } from "mongoose";

export type LessonResourceKind = "file" | "link" | "library_book";
export type LessonResourceFileType =
  | "pdf"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "slide"
  | "other";

export type LessonResourceVisibility =
  | "teacher_only"
  | "students"
  | "parents_only"
  | "students_and_parents";

export interface ILessonResource {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  lessonId?: Types.ObjectId | null;
  sessionId?: Types.ObjectId | null;
  teacherId: Types.ObjectId;
  kind: LessonResourceKind;
  title: string;
  description?: string;
  /** Present when `kind === "link"` */
  url?: string;
  fileUrl?: string;
  uploadThingKey?: string;
  fileName?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  fileType?: LessonResourceFileType;
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
    lessonId: { type: Schema.Types.ObjectId, ref: "Lesson", default: null, index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "LessonSession", default: null, index: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true, index: true },
    kind: {
      type: String,
      enum: ["file", "link", "library_book"],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 220 },
    description: { type: String, trim: true, maxlength: 500 },
    url: { type: String, trim: true, maxlength: 2000 },
    fileUrl: { type: String, trim: true, maxlength: 2000 },
    uploadThingKey: { type: String, trim: true, maxlength: 500 },
    fileName: { type: String, trim: true, maxlength: 500 },
    fileSizeBytes: { type: Number, min: 0 },
    mimeType: { type: String, trim: true, maxlength: 160 },
    fileType: {
      type: String,
      enum: ["pdf", "image", "video", "audio", "document", "slide", "other"],
    },
    linkType: { type: String, trim: true, maxlength: 40 },
    libraryBookId: { type: Schema.Types.ObjectId, ref: "LibraryBook", index: true },
    visibility: {
      type: String,
      enum: ["teacher_only", "students", "parents_only", "students_and_parents"],
      default: "students",
      index: true,
    },
    order: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

lessonResourceSchema.index({ schoolId: 1, lessonId: 1, order: 1 });
lessonResourceSchema.index({ schoolId: 1, sessionId: 1, order: 1 });
lessonResourceSchema.pre("validate", function validateResourceScope(next) {
  const hasLesson = Boolean(this.lessonId);
  const hasSession = Boolean(this.sessionId);
  if (hasLesson === hasSession) {
    next(new Error("Resource must reference exactly one of lessonId or sessionId"));
    return;
  }
  next();
});

export const LessonResource: Model<ILessonResource> =
  (models.LessonResource as Model<ILessonResource>) ||
  model<ILessonResource>("LessonResource", lessonResourceSchema);
