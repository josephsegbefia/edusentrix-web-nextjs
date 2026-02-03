import { Schema, model, models, Types } from "mongoose";

export interface IAcademicCalendar {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  academicPeriodId?: Types.ObjectId | null;
  name: string;
  description?: string | null;
  color?: string | null;
  isPublished: boolean;
  editors: Types.ObjectId[]; // User IDs (teachers/bursars)
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const academicCalendarSchema = new Schema<IAcademicCalendar>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    academicPeriodId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      default: null,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null, trim: true },
    color: { type: String, default: null, trim: true },
    isPublished: { type: Boolean, default: false, index: true },
    editors: [{ type: Schema.Types.ObjectId, ref: "User", default: [] }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

academicCalendarSchema.index({ schoolId: 1, academicPeriodId: 1, name: 1 });

export const AcademicCalendar =
  models.AcademicCalendar ||
  model<IAcademicCalendar>("AcademicCalendar", academicCalendarSchema);
