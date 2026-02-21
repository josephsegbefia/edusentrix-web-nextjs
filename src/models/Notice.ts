import { Schema, model, models, Types, type Model } from "mongoose";

export type NoticeStatus = "draft" | "published" | "scheduled" | "archived";
export type NoticeAudience = "class" | "subject" | "school" | "custom";

export interface INotice {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  title: string;
  message: string;
  audience: NoticeAudience;
  classGroupIds?: Types.ObjectId[];
  subjectIds?: Types.ObjectId[];
  targetStudentIds?: Types.ObjectId[];
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
    size?: number;
  }>;
  status: NoticeStatus;
  scheduledFor?: Date;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AttachmentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    size: { type: Number, min: 0 },
  },
  { _id: false }
);

const noticeSchema = new Schema<INotice>(
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
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    audience: {
      type: String,
      enum: ["class", "subject", "school", "custom"],
      default: "class",
      index: true,
    },
    classGroupIds: [{ type: Schema.Types.ObjectId, ref: "ClassGroup" }],
    subjectIds: [{ type: Schema.Types.ObjectId, ref: "Subject" }],
    targetStudentIds: [{ type: Schema.Types.ObjectId, ref: "Student" }],
    attachments: { type: [AttachmentSchema], default: [] },
    status: {
      type: String,
      enum: ["draft", "published", "scheduled", "archived"],
      default: "draft",
      index: true,
    },
    scheduledFor: { type: Date },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

noticeSchema.index({ schoolId: 1, teacherId: 1, status: 1, createdAt: -1 });

export const Notice: Model<INotice> =
  (models.Notice as Model<INotice>) ||
  model<INotice>("Notice", noticeSchema);
