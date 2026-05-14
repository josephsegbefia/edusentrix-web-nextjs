import mongoose, { Schema, model, models, Types, type Model } from "mongoose";

export type TimetableSlotSource = "manual" | "imported" | "assignment_sync";

export interface ITimetableSlot {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  versionId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  gradeId: Types.ObjectId;
  subjectId: Types.ObjectId;
  subjectOfferingId?: Types.ObjectId | null;
  /** Set when a teacher is assigned; omitted until subject–teacher assignment exists. */
  teacherId?: Types.ObjectId | null;
  roomId?: Types.ObjectId | null;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startTime: string;
  endTime: string;
  classroomLabel: string;
  source: TimetableSlotSource;
  legacyAssignmentId?: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const timetableSlotSchema = new Schema<ITimetableSlot>(
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
      required: true,
      index: true,
    },
    versionId: {
      type: Schema.Types.ObjectId,
      ref: "TimetableVersion",
      required: true,
      index: true,
    },
    classGroupId: {
      type: Schema.Types.ObjectId,
      ref: "ClassGroup",
      required: true,
      index: true,
    },
    gradeId: {
      type: Schema.Types.ObjectId,
      ref: "Grade",
      required: true,
      index: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },
    subjectOfferingId: {
      type: Schema.Types.ObjectId,
      ref: "SubjectOffering",
      default: null,
      index: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: false,
      index: true,
      // Intentionally no default: omit field when unassigned; queries treat missing as "no teacher".
    },
    roomId: {
      type: Schema.Types.ObjectId,
      ref: "Room",
      default: null,
      index: true,
    },
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    startTime: {
      type: String,
      required: true,
      trim: true,
      match: /^([01][0-9]|2[0-3]):[0-5][0-9]$/,
    },
    endTime: {
      type: String,
      required: true,
      trim: true,
      match: /^([01][0-9]|2[0-3]):[0-5][0-9]$/,
    },
    classroomLabel: { type: String, required: true, trim: true },
    source: {
      type: String,
      enum: ["manual", "imported", "assignment_sync"],
      required: true,
      default: "manual",
      index: true,
    },
    legacyAssignmentId: {
      type: Schema.Types.ObjectId,
      ref: "TeacherAssignment",
      default: null,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

timetableSlotSchema.index({
  schoolId: 1,
  academicPeriodId: 1,
  versionId: 1,
  dayOfWeek: 1,
  startTime: 1,
});
timetableSlotSchema.index({
  schoolId: 1,
  academicPeriodId: 1,
  versionId: 1,
  classGroupId: 1,
  dayOfWeek: 1,
  startTime: 1,
});
timetableSlotSchema.index({
  schoolId: 1,
  academicPeriodId: 1,
  versionId: 1,
  teacherId: 1,
  dayOfWeek: 1,
  startTime: 1,
});
timetableSlotSchema.index({
  schoolId: 1,
  academicPeriodId: 1,
  versionId: 1,
  roomId: 1,
  dayOfWeek: 1,
  startTime: 1,
});
timetableSlotSchema.index({
  schoolId: 1,
  versionId: 1,
  legacyAssignmentId: 1,
  source: 1,
});
timetableSlotSchema.index({
  schoolId: 1,
  academicPeriodId: 1,
  versionId: 1,
  subjectOfferingId: 1,
});

// Next.js dev hot-reload can keep a stale compiled model with old paths; drop so schema updates apply.
if (process.env.NODE_ENV === "development" && mongoose.models.TimetableSlot) {
  delete mongoose.models.TimetableSlot;
}

export const TimetableSlot: Model<ITimetableSlot> =
  (models.TimetableSlot as Model<ITimetableSlot>) ||
  model<ITimetableSlot>("TimetableSlot", timetableSlotSchema);
