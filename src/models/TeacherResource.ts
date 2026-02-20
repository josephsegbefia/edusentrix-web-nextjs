import { Schema, model, models, Types, type Model } from "mongoose";

export type TeacherResourceType =
  | "link"
  | "pdf"
  | "video"
  | "image"
  | "doc"
  | "slides"
  | "other";

export type ResourceShareTargetType = "teacher" | "student" | "parent";

export interface ITeacherResourceShare {
  targetType: ResourceShareTargetType;
  targetId: Types.ObjectId;
  targetName: string;
  targetAvatarUrl?: string | null;
  targetSubtitle?: string | null;
  sharedAt: Date;
}

export interface ITeacherResource {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  title: string;
  description?: string;
  url: string;
  type: TeacherResourceType;
  tags?: string[];
  subjectId?: Types.ObjectId | null;
  classGroupIds?: Types.ObjectId[];
  sharedWith: ITeacherResourceShare[];
  createdAt: Date;
  updatedAt: Date;
}

const ResourceShareSchema = new Schema<ITeacherResourceShare>(
  {
    targetType: {
      type: String,
      enum: ["teacher", "student", "parent"],
      required: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    targetName: { type: String, required: true, trim: true, maxlength: 160 },
    targetAvatarUrl: { type: String, trim: true, default: null },
    targetSubtitle: { type: String, trim: true, default: null, maxlength: 200 },
    sharedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

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
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      default: null,
      index: true,
    },
    classGroupIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "ClassGroup",
      },
    ],
    sharedWith: { type: [ResourceShareSchema], default: [] },
  },
  { timestamps: true }
);

TeacherResourceSchema.index({ schoolId: 1, teacherId: 1, type: 1, createdAt: -1 });
TeacherResourceSchema.index({ schoolId: 1, teacherId: 1, tags: 1 });
TeacherResourceSchema.index({ schoolId: 1, teacherId: 1, subjectId: 1, createdAt: -1 });
TeacherResourceSchema.index({ schoolId: 1, teacherId: 1, classGroupIds: 1, createdAt: -1 });

const existingResourceModel = models.TeacherResource as Model<ITeacherResource> | undefined;
if (
  existingResourceModel &&
  (!existingResourceModel.schema.path("subjectId") ||
    !existingResourceModel.schema.path("classGroupIds") ||
    !existingResourceModel.schema.path("sharedWith"))
) {
  delete models.TeacherResource;
}

export const TeacherResource =
  (models.TeacherResource as Model<ITeacherResource> | undefined) ||
  model<ITeacherResource>("TeacherResource", TeacherResourceSchema);
