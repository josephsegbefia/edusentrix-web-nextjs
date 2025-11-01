import { Schema, model, models, Types } from "mongoose";

export interface IAcademicPeriod {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  yearLabel: string;
  term: string;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const academicPeriodSchema = new Schema<IAcademicPeriod>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    yearLabel: { type: String, required: true },
    term: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isCurrent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

academicPeriodSchema.index(
  { schoolId: 1, yearLabel: 1, term: 1 },
  { unique: true }
);

export const AcademicPeriod =
  models.AcademicPeriod ||
  model<IAcademicPeriod>("AcademicPeriod", academicPeriodSchema);
