import { Schema, model, models, Types, type Model } from "mongoose";

export interface IExamPolicy {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  name: string;
  isDefault: boolean;
  requireVenue: boolean;
  requireInvigilator: boolean;
  requireTeacherAcknowledgement: boolean;
  allowSubjectTeacherInvigilation: boolean;
  maxInvigilationSessionsPerTeacherPerDay?: number | null;
  maxInvigilationSessionsPerTeacherPerSession?: number | null;
  maxExamsPerClassPerDay?: number | null;
  minBreakMinutesBetweenExams?: number | null;
  preventRoomDoubleBooking: boolean;
  preventClassExamOverlap: boolean;
  preventTeacherInvigilationOverlap: boolean;
  preventHolidayScheduling: boolean;
  coreSubjectsMorningPreference?: boolean;
  allowConflictOverride: boolean;
  requireOverrideReason: boolean;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const examPolicySchema = new Schema<IExamPolicy>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    isDefault: { type: Boolean, required: true, default: false, index: true },
    requireVenue: { type: Boolean, required: true, default: true },
    requireInvigilator: { type: Boolean, required: true, default: true },
    requireTeacherAcknowledgement: {
      type: Boolean,
      required: true,
      default: false,
    },
    allowSubjectTeacherInvigilation: {
      type: Boolean,
      required: true,
      default: false,
    },
    maxInvigilationSessionsPerTeacherPerDay: {
      type: Number,
      default: null,
      min: 1,
    },
    maxInvigilationSessionsPerTeacherPerSession: {
      type: Number,
      default: null,
      min: 1,
    },
    maxExamsPerClassPerDay: { type: Number, default: null, min: 1 },
    minBreakMinutesBetweenExams: { type: Number, default: null, min: 0 },
    preventRoomDoubleBooking: { type: Boolean, required: true, default: true },
    preventClassExamOverlap: { type: Boolean, required: true, default: true },
    preventTeacherInvigilationOverlap: {
      type: Boolean,
      required: true,
      default: true,
    },
    preventHolidayScheduling: { type: Boolean, required: true, default: true },
    coreSubjectsMorningPreference: { type: Boolean, default: false },
    allowConflictOverride: { type: Boolean, required: true, default: true },
    requireOverrideReason: { type: Boolean, required: true, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

examPolicySchema.index(
  { schoolId: 1, isDefault: 1 },
  { name: "exam_policy_by_school_default" }
);

examPolicySchema.index(
  { schoolId: 1, name: 1 },
  { name: "exam_policy_by_school_name", unique: true }
);

export const ExamPolicy: Model<IExamPolicy> =
  (models.ExamPolicy as Model<IExamPolicy>) ||
  model<IExamPolicy>("ExamPolicy", examPolicySchema);
