import { Schema, model, models, type Model, type Types } from "mongoose";

export type LibraryNoticeAudience =
  | "all"
  | "students"
  | "teachers"
  | "parents"
  | "class_group"
  | "grade";

export type LibraryNoticeStatus = "draft" | "published" | "archived";

export interface ILibraryNotice {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  title: string;
  message: string;
  audience: LibraryNoticeAudience;
  audienceRefId?: Types.ObjectId;
  publishedAt?: Date;
  expiresAt?: Date;
  status: LibraryNoticeStatus;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const libraryNoticeSchema = new Schema<ILibraryNotice>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 16_000 },
    audience: {
      type: String,
      enum: ["all", "students", "teachers", "parents", "class_group", "grade"],
      required: true,
      index: true,
    },
    audienceRefId: { type: Schema.Types.ObjectId, index: true },
    publishedAt: { type: Date, index: true },
    expiresAt: { type: Date, index: true },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

libraryNoticeSchema.index({ schoolId: 1, status: 1, publishedAt: -1 });

export const LibraryNotice: Model<ILibraryNotice> =
  models.LibraryNotice || model<ILibraryNotice>("LibraryNotice", libraryNoticeSchema);
