import { Schema, model, models, Types, type Model } from "mongoose";
import type {
  ExamTimetableEntryStatus,
  ExamVenueType,
} from "@/types/academics/exam-scheduling-engine";
import {
  examTimeFieldSchema,
  examTimetableEntryStatusEnum,
  examVenueTypeEnum,
} from "@/models/academics/exam-scheduling-engine-schemas";

export interface IExamVenue {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  name: string;
  code?: string | null;
  type: ExamVenueType;
  capacity?: number | null;
  locationNote?: string | null;
  isActive: boolean;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const examVenueSchema = new Schema<IExamVenue>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    code: { type: String, default: null, trim: true, maxlength: 40 },
    type: {
      type: String,
      enum: examVenueTypeEnum,
      required: true,
      default: "classroom",
      index: true,
    },
    capacity: { type: Number, default: null, min: 1 },
    locationNote: { type: String, default: null, trim: true, maxlength: 500 },
    isActive: { type: Boolean, required: true, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

examVenueSchema.index(
  { schoolId: 1, isActive: 1, name: 1 },
  { name: "exam_venue_by_school_active_name" }
);

examVenueSchema.index(
  { schoolId: 1, code: 1 },
  {
    name: "exam_venue_by_school_code",
    unique: true,
    partialFilterExpression: { code: { $type: "string", $ne: null } },
  }
);

export const ExamVenue: Model<IExamVenue> =
  (models.ExamVenue as Model<IExamVenue>) ||
  model<IExamVenue>("ExamVenue", examVenueSchema);
