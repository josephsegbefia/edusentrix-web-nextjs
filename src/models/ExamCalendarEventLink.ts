import { Schema, model, models, Types, type Model } from "mongoose";
import { EXAM_CALENDAR_LINK_KINDS } from "@/constants/academics/exam-scheduling-engine";

export type ExamCalendarLinkKind = (typeof EXAM_CALENDAR_LINK_KINDS)[number];

export interface IExamCalendarEventLink {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  examSessionId: Types.ObjectId;
  calendarId: Types.ObjectId;
  calendarEventId: Types.ObjectId;
  linkKind: ExamCalendarLinkKind;
  sourceRefId: Types.ObjectId;
  sourceRefKey: string;
  versionNumber: number;
  createdAt: Date;
  updatedAt: Date;
}

const examCalendarEventLinkSchema = new Schema<IExamCalendarEventLink>(
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
    calendarId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicCalendar",
      required: true,
      index: true,
    },
    calendarEventId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicCalendarEvent",
      required: true,
      index: true,
    },
    linkKind: {
      type: String,
      enum: [...EXAM_CALENDAR_LINK_KINDS],
      required: true,
      index: true,
    },
    sourceRefId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    sourceRefKey: { type: String, required: true, trim: true },
    versionNumber: { type: Number, required: true, min: 1 },
  },
  { timestamps: true }
);

examCalendarEventLinkSchema.index(
  { schoolId: 1, sourceRefKey: 1 },
  { name: "exam_calendar_link_source_key", unique: true }
);

examCalendarEventLinkSchema.index(
  { schoolId: 1, examSessionId: 1, versionNumber: 1 },
  { name: "exam_calendar_link_by_session_version" }
);

export const ExamCalendarEventLink: Model<IExamCalendarEventLink> =
  (models.ExamCalendarEventLink as Model<IExamCalendarEventLink>) ||
  model<IExamCalendarEventLink>("ExamCalendarEventLink", examCalendarEventLinkSchema);
