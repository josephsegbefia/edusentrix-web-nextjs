import { Schema, model, models, Types, type Model } from "mongoose";

export interface IAcademicPeriod {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  yearLabel: string;
  term: string;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
  isYearEndTerminal?: boolean;
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
    yearLabel: { type: String, required: true, trim: true },
    term: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isCurrent: { type: Boolean, default: false },
    isYearEndTerminal: { type: Boolean, default: false },
  },
  { timestamps: true }
);

academicPeriodSchema.index(
  { schoolId: 1, yearLabel: 1, term: 1 },
  { unique: true }
);

export const AcademicPeriod: Model<IAcademicPeriod> =
  (models.AcademicPeriod as Model<IAcademicPeriod>) ||
  model<IAcademicPeriod>("AcademicPeriod", academicPeriodSchema);
