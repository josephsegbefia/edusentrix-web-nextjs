import { Schema, model, models, Types, type Model } from "mongoose";

export type MeetingKind =
  | "general"
  | "pta"
  | "parent_conference"
  | "fee_consultation";

export type MeetingStatus = "scheduled" | "cancelled" | "completed";

export type MeetingVisibility = "invite_only";

export type MeetingHostRole = "school_admin" | "teacher" | "bursar";

export type MeetingProvider = "none" | "livekit";

export type MeetingProviderStatus =
  | "not_configured"
  | "pending"
  | "ready"
  | "ended"
  | "failed";

export interface IMeeting {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  calendarId: Types.ObjectId;
  calendarEventId?: Types.ObjectId | null;
  title: string;
  description?: string | null;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  kind: MeetingKind;
  status: MeetingStatus;
  visibility: MeetingVisibility;
  hostUserId: Types.ObjectId;
  hostRole: MeetingHostRole;
  provider: MeetingProvider;
  providerStatus: MeetingProviderStatus;
  providerRoomName?: string | null;
  /** Last LiveKit (or other provider) provisioning error for staff debugging */
  providerLastError?: string | null;
  reminderMinutesBefore?: number[];
  participantCount: number;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  cancelledAt?: Date | null;
  cancelledBy?: Types.ObjectId | null;
  cancelReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const meetingSchema = new Schema<IMeeting>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
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
      default: null,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null, trim: true },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true },
    timezone: { type: String, required: true, default: "Africa/Accra", trim: true },
    kind: {
      type: String,
      enum: ["general", "pta", "parent_conference", "fee_consultation"],
      default: "general",
      index: true,
    },
    status: {
      type: String,
      enum: ["scheduled", "cancelled", "completed"],
      default: "scheduled",
      index: true,
    },
    visibility: {
      type: String,
      enum: ["invite_only"],
      default: "invite_only",
    },
    hostUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    hostRole: {
      type: String,
      enum: ["school_admin", "teacher", "bursar"],
      required: true,
    },
    provider: {
      type: String,
      enum: ["none", "livekit"],
      default: "none",
    },
    providerStatus: {
      type: String,
      enum: ["not_configured", "pending", "ready", "ended", "failed"],
      default: "not_configured",
      index: true,
    },
    providerRoomName: { type: String, default: null, trim: true },
    providerLastError: { type: String, default: null, trim: true },
    reminderMinutesBefore: { type: [Number], default: [] },
    participantCount: { type: Number, default: 0, min: 0 },
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
    cancelledAt: { type: Date, default: null },
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    cancelReason: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

meetingSchema.index({ schoolId: 1, status: 1, startsAt: 1 });
meetingSchema.index({ schoolId: 1, calendarId: 1, startsAt: 1 });
meetingSchema.index({ hostUserId: 1, status: 1, startsAt: 1 });

export const Meeting: Model<IMeeting> =
  (models.Meeting as Model<IMeeting>) ||
  model<IMeeting>("Meeting", meetingSchema);
