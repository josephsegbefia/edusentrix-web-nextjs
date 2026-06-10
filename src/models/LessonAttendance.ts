import { Schema, model, models, type Model, type Types } from "mongoose";

export type LessonAttendanceStudentStatus =
  | "present"
  | "absent"
  | "left_early"
  | "arrived_late"
  | "not_recorded";

export interface ILessonAttendanceStudent {
  studentId: Types.ObjectId;
  nameSnapshot: string;
  admissionNo?: string | null;
  preLesson: LessonAttendanceStudentStatus;
  postLesson: LessonAttendanceStudentStatus;
}

export interface ILessonAttendance {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;
  deliveryId?: Types.ObjectId | null;
  classGroupId: Types.ObjectId;
  subjectOfferingId?: Types.ObjectId | null;
  teacherId: Types.ObjectId;
  scheduledDate: Date;
  startTime: string;
  endTime: string;
  students: ILessonAttendanceStudent[];
  totalEnrolled: number;
  preRecordedAt?: Date | null;
  postRecordedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const studentMarkSchema = new Schema<ILessonAttendanceStudent>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    nameSnapshot: { type: String, trim: true, required: true, maxlength: 200 },
    admissionNo: { type: String, trim: true, maxlength: 50, default: null },
    preLesson: {
      type: String,
      enum: ["present", "absent", "left_early", "arrived_late", "not_recorded"],
      default: "not_recorded",
    },
    postLesson: {
      type: String,
      enum: ["present", "absent", "left_early", "arrived_late", "not_recorded"],
      default: "not_recorded",
    },
  },
  { _id: false },
);

const lessonAttendanceSchema = new Schema<ILessonAttendance>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "LessonSession", required: true, index: true },
    deliveryId: { type: Schema.Types.ObjectId, ref: "LessonDelivery", default: null, index: true },
    classGroupId: {
      type: Schema.Types.ObjectId,
      ref: "ClassGroup",
      required: true,
      index: true,
    },
    subjectOfferingId: { type: Schema.Types.ObjectId, ref: "SubjectOffering", default: null },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true, index: true },
    scheduledDate: { type: Date, required: true },
    startTime: { type: String, trim: true, required: true },
    endTime: { type: String, trim: true, required: true },
    students: { type: [studentMarkSchema], default: [] },
    totalEnrolled: { type: Number, default: 0, min: 0 },
    preRecordedAt: { type: Date, default: null },
    postRecordedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

lessonAttendanceSchema.index(
  { schoolId: 1, sessionId: 1, classGroupId: 1 },
  { unique: true },
);

export const LessonAttendance: Model<ILessonAttendance> =
  (models.LessonAttendance as Model<ILessonAttendance>) ||
  model<ILessonAttendance>("LessonAttendance", lessonAttendanceSchema);
