import { Schema, model, models, Types, type Model } from "mongoose";
import type { ExamTimetableEntryStatus } from "@/types/academics/exam-scheduling-engine";
import {
  examTimeFieldSchema,
  examTimetableEntryStatusEnum,
} from "@/models/academics/exam-scheduling-engine-schemas";
import { EXAM_TIME_PATTERN } from "@/constants/academics/exam-scheduling-engine";

export interface IExamTimetableEntry {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  examSessionId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  title?: string | null;
  subjectId: Types.ObjectId;
  gradeId?: Types.ObjectId | null;
  classGroupIds: Types.ObjectId[];
  date: Date;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  venueId?: Types.ObjectId | null;
  roomLabel?: string | null;
  capacityRequired?: number | null;
  assessmentItemId?: Types.ObjectId | null;
  contributesToReport: boolean;
  assessmentComponentKey?: string | null;
  maxScore?: number | null;
  instructionsForInvigilators?: string | null;
  instructionsForStudents?: string | null;
  materialsAllowed?: string[];
  specialNotes?: string | null;
  status: ExamTimetableEntryStatus;
  isUnscheduled: boolean;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const examTimetableEntrySchema = new Schema<IExamTimetableEntry>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    examSessionId: {
      type: Schema.Types.ObjectId,
      ref: "ExamSession",
      required: true,
      index: true,
    },
    academicPeriodId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      required: true,
      index: true,
    },
    title: { type: String, default: null, trim: true, maxlength: 300 },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },
    gradeId: {
      type: Schema.Types.ObjectId,
      ref: "Grade",
      default: null,
      index: true,
    },
    classGroupIds: {
      type: [Schema.Types.ObjectId],
      ref: "ClassGroup",
      required: true,
      validate: {
        validator: (value: Types.ObjectId[]) => Array.isArray(value) && value.length > 0,
        message: "At least one class group is required.",
      },
    },
    date: { type: Date, required: true, index: true },
    startTime: examTimeFieldSchema,
    endTime: examTimeFieldSchema,
    durationMinutes: { type: Number, required: true, min: 1, max: 720 },
    venueId: {
      type: Schema.Types.ObjectId,
      ref: "ExamVenue",
      default: null,
      index: true,
    },
    roomLabel: { type: String, default: null, trim: true, maxlength: 200 },
    capacityRequired: { type: Number, default: null, min: 1 },
    assessmentItemId: {
      type: Schema.Types.ObjectId,
      ref: "AssessmentItem",
      default: null,
      index: true,
    },
    contributesToReport: { type: Boolean, required: true, default: true },
    assessmentComponentKey: { type: String, default: null, trim: true, maxlength: 80 },
    maxScore: { type: Number, default: null, min: 1, max: 1000 },
    instructionsForInvigilators: {
      type: String,
      default: null,
      trim: true,
      maxlength: 5000,
    },
    instructionsForStudents: {
      type: String,
      default: null,
      trim: true,
      maxlength: 5000,
    },
    materialsAllowed: { type: [String], default: [] },
    specialNotes: { type: String, default: null, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: examTimetableEntryStatusEnum,
      required: true,
      default: "draft",
      index: true,
    },
    isUnscheduled: { type: Boolean, required: true, default: false, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

examTimetableEntrySchema.index(
  { schoolId: 1, examSessionId: 1 },
  { name: "exam_entry_by_school_session" }
);

examTimetableEntrySchema.index(
  { schoolId: 1, date: 1 },
  { name: "exam_entry_by_school_date" }
);

examTimetableEntrySchema.index(
  { examSessionId: 1, subjectId: 1 },
  { name: "exam_entry_by_session_subject" }
);

examTimetableEntrySchema.index(
  { examSessionId: 1, classGroupIds: 1 },
  { name: "exam_entry_by_session_class_groups" }
);

function parseTimeToMinutes(value: string): number | null {
  if (!EXAM_TIME_PATTERN.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

examTimetableEntrySchema.pre("validate", function validateExamTimetableEntryTimes() {
  if (this.isUnscheduled) {
    if (!this.durationMinutes || this.durationMinutes < 1) {
      this.invalidate("durationMinutes", "Duration must be at least 1 minute.");
    }
    return;
  }

  const startMinutes = parseTimeToMinutes(this.startTime);
  const endMinutes = parseTimeToMinutes(this.endTime);

  if (startMinutes === null || endMinutes === null) {
    return;
  }

  if (endMinutes <= startMinutes) {
    this.invalidate("endTime", "End time must be after start time.");
    return;
  }

  const computedDuration = endMinutes - startMinutes;
  if (!this.durationMinutes || this.durationMinutes !== computedDuration) {
    this.durationMinutes = computedDuration;
  }
});

export const ExamTimetableEntry: Model<IExamTimetableEntry> =
  (models.ExamTimetableEntry as Model<IExamTimetableEntry>) ||
  model<IExamTimetableEntry>("ExamTimetableEntry", examTimetableEntrySchema);
