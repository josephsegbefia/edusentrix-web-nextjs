import { Schema, model, models, type InferSchemaType, type Model, Types } from "mongoose";
import { UNALLOCATED_GAP_PRESET_CODES } from "@/lib/timetable/unallocated-gap-presets";

const schoolUnallocatedGapFillSchema = new Schema(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    gradeId: {
      type: Schema.Types.ObjectId,
      ref: "Grade",
      required: true,
      index: true,
    },
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    startTime: { type: String, required: true, trim: true },
    endTime: { type: String, required: true, trim: true },
    presetCode: {
      type: String,
      required: true,
      enum: [...UNALLOCATED_GAP_PRESET_CODES],
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

schoolUnallocatedGapFillSchema.index(
  { schoolId: 1, gradeId: 1, dayOfWeek: 1, startTime: 1, endTime: 1 },
  { unique: true }
);

export type ISchoolUnallocatedGapFill = InferSchemaType<typeof schoolUnallocatedGapFillSchema> & {
  _id: Types.ObjectId;
};

export const SchoolUnallocatedGapFill: Model<ISchoolUnallocatedGapFill> =
  models.SchoolUnallocatedGapFill ||
  model<ISchoolUnallocatedGapFill>("SchoolUnallocatedGapFill", schoolUnallocatedGapFillSchema);
