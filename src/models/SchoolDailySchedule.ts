import {
  Schema,
  deleteModel,
  model,
  models,
  type InferSchemaType,
  type Model,
  Types,
} from "mongoose";
import type { SchoolDailyScheduleConfigV2 } from "@/types/school-daily-schedule";

const scheduleGroupSchema = new Schema(
  {
    groupId: { type: String, required: true },
    label: { type: String, default: "" },
    gradeIds: [{ type: Schema.Types.ObjectId, ref: "Grade" }],
    classGroupIds: [{ type: Schema.Types.ObjectId, ref: "ClassGroup" }],
    config: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false }
);

const schoolDailyScheduleSchema = new Schema(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      unique: true,
      index: true,
    },
    /** unified: school uses root `config`. grouped: each entry in `scheduleGroups` has its own `config`. */
    scheduleMode: {
      type: String,
      enum: ["unified", "grouped"],
      default: "unified",
    },
    scheduleGroups: {
      type: [scheduleGroupSchema],
      default: undefined,
    },
    config: {
      type: Schema.Types.Mixed,
      required: false,
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
          scheduleMode: { type: String, enum: ["unified", "grouped"] },
          scheduleGroups: { type: Schema.Types.Mixed },
          config: { type: Schema.Types.Mixed },
        },
      ],
      default: undefined,
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: false },
  },
  { timestamps: true }
);

export type ISchoolDailySchedule = Omit<
  InferSchemaType<typeof schoolDailyScheduleSchema>,
  "config" | "scheduleGroups"
> & {
  _id: Types.ObjectId;
  config?: SchoolDailyScheduleConfigV2 | unknown;
  scheduleGroups?: Array<{
    groupId: string;
    label?: string;
    gradeIds: Types.ObjectId[];
    classGroupIds?: Types.ObjectId[];
    config: unknown;
  }>;
};

const existingSchoolDailyScheduleModel = models.SchoolDailySchedule as
  | Model<ISchoolDailySchedule>
  | undefined;

if (
  existingSchoolDailyScheduleModel &&
  (!existingSchoolDailyScheduleModel.schema.path("scheduleMode") ||
    !existingSchoolDailyScheduleModel.schema.path("scheduleGroups") ||
    !existingSchoolDailyScheduleModel.schema.path("scheduleGroups.classGroupIds"))
) {
  deleteModel("SchoolDailySchedule");
}

export const SchoolDailySchedule: Model<ISchoolDailySchedule> =
  (models.SchoolDailySchedule as Model<ISchoolDailySchedule> | undefined) ||
  model<ISchoolDailySchedule>("SchoolDailySchedule", schoolDailyScheduleSchema);
