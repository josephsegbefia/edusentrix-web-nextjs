import { Schema, model, models, type Model, type Types } from "mongoose";

export type LessonWeekPlanStatus = "draft" | "ready" | "archived";

export interface ILessonWeekPlan {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  subjectOfferingId: Types.ObjectId;
  lessonNoteId: Types.ObjectId;
  ownerTeacherId: Types.ObjectId;
  weekStartDate: Date;
  weekEndDate: Date;
  weekLabel: string;
  title: string;
  status: LessonWeekPlanStatus;
  sessionIds: Types.ObjectId[];
  clonedFromWeekPlanId?: Types.ObjectId | null;
  timetableVersionId?: Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const lessonWeekPlanSchema = new Schema<ILessonWeekPlan>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    academicPeriodId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      required: true,
      index: true,
    },
    classGroupId: { type: Schema.Types.ObjectId, ref: "ClassGroup", required: true, index: true },
    subjectOfferingId: {
      type: Schema.Types.ObjectId,
      ref: "SubjectOffering",
      required: true,
      index: true,
    },
    lessonNoteId: { type: Schema.Types.ObjectId, ref: "LessonNote", required: true, index: true },
    ownerTeacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true, index: true },
    weekStartDate: { type: Date, required: true },
    weekEndDate: { type: Date, required: true },
    weekLabel: { type: String, trim: true, maxlength: 80, default: "" },
    title: { type: String, trim: true, maxlength: 220, required: true },
    status: {
      type: String,
      enum: ["draft", "ready", "archived"],
      default: "draft",
      index: true,
    },
    sessionIds: [{ type: Schema.Types.ObjectId, ref: "LessonSession" }],
    clonedFromWeekPlanId: { type: Schema.Types.ObjectId, ref: "LessonWeekPlan", default: null },
    timetableVersionId: { type: Schema.Types.ObjectId, ref: "TimetableVersion", default: null },
  },
  { timestamps: true },
);

lessonWeekPlanSchema.index(
  { schoolId: 1, classGroupId: 1, subjectOfferingId: 1, weekStartDate: 1 },
  { unique: true },
);

export const LessonWeekPlan: Model<ILessonWeekPlan> =
  (models.LessonWeekPlan as Model<ILessonWeekPlan>) ||
  model<ILessonWeekPlan>("LessonWeekPlan", lessonWeekPlanSchema);
