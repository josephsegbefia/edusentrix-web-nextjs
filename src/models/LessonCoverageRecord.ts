import { Schema, model, models, type Model, type Types } from "mongoose";

export interface ILessonCoverageRecord {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  subjectOfferingId: Types.ObjectId;
  weekPlanId: Types.ObjectId;
  lessonNoteId: Types.ObjectId;
  sessionId: Types.ObjectId;
  deliveryId: Types.ObjectId;
  schemeItemId: Types.ObjectId;
  coveredAt: Date;
  coveredByTeacherId: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const lessonCoverageRecordSchema = new Schema<ILessonCoverageRecord>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    classGroupId: { type: Schema.Types.ObjectId, ref: "ClassGroup", required: true, index: true },
    subjectOfferingId: {
      type: Schema.Types.ObjectId,
      ref: "SubjectOffering",
      required: true,
      index: true,
    },
    weekPlanId: { type: Schema.Types.ObjectId, ref: "LessonWeekPlan", required: true, index: true },
    lessonNoteId: { type: Schema.Types.ObjectId, ref: "LessonNote", required: true, index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "LessonSession", required: true, index: true },
    deliveryId: { type: Schema.Types.ObjectId, ref: "LessonDelivery", required: true, index: true },
    schemeItemId: { type: Schema.Types.ObjectId, ref: "SchemeItem", required: true, index: true },
    coveredAt: { type: Date, required: true, index: true },
    coveredByTeacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true },
  },
  { timestamps: true },
);

lessonCoverageRecordSchema.index(
  { schoolId: 1, classGroupId: 1, schemeItemId: 1, weekPlanId: 1 },
  { unique: true },
);

export const LessonCoverageRecord: Model<ILessonCoverageRecord> =
  (models.LessonCoverageRecord as Model<ILessonCoverageRecord>) ||
  model<ILessonCoverageRecord>("LessonCoverageRecord", lessonCoverageRecordSchema);
