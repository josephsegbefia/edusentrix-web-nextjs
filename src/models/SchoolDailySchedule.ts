import { Schema, model, models, type InferSchemaType, type Model, Types } from "mongoose";
import type { SchoolDailyScheduleConfigV2 } from "@/types/school-daily-schedule";

const schoolDailyScheduleSchema = new Schema(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      unique: true,
      index: true,
    },
    config: {
      type: Schema.Types.Mixed,
      required: true,
    },
    revision: { type: Number, default: 0 },
    /** Ring buffer of past configs for audits (“which rule in Term 1?”). */
    scheduleHistory: {
      type: [
        {
          revision: { type: Number, required: true },
          savedAt: { type: Date, required: true },
          savedBy: { type: Schema.Types.ObjectId, ref: "User" },
          label: { type: String, maxlength: 200 },
          academicPeriodId: { type: Schema.Types.ObjectId, ref: "AcademicPeriod" },
          config: { type: Schema.Types.Mixed, required: true },
        },
      ],
      default: undefined,
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: false },
  },
  { timestamps: true }
);

export type ISchoolDailySchedule = InferSchemaType<typeof schoolDailyScheduleSchema> & {
  _id: Types.ObjectId;
  config: SchoolDailyScheduleConfigV2;
};

export const SchoolDailySchedule: Model<ISchoolDailySchedule> =
  models.SchoolDailySchedule ||
  model<ISchoolDailySchedule>("SchoolDailySchedule", schoolDailyScheduleSchema);
