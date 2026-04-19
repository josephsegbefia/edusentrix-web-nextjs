import { Schema, model, models, Types, type Model } from "mongoose";

export type MeetingParticipantRole = "parent" | "teacher" | "bursar";

export type MeetingInviteStatus = "invited" | "accepted" | "declined";

export type MeetingAttendanceStatus = "invited" | "joined" | "left" | "no_show";

export interface IMeetingParticipant {
  _id: Types.ObjectId;
  meetingId: Types.ObjectId;
  schoolId: Types.ObjectId;
  userId: Types.ObjectId;
  role: MeetingParticipantRole;
  wardIds?: Types.ObjectId[];
  invitedByUserId: Types.ObjectId;
  inviteStatus: MeetingInviteStatus;
  attendanceStatus: MeetingAttendanceStatus;
  responseNote?: string | null;
  respondedAt?: Date | null;
  joinedAt?: Date | null;
  leftAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const meetingParticipantSchema = new Schema<IMeetingParticipant>(
  {
    meetingId: {
      type: Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
      index: true,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["parent", "teacher", "bursar"],
      required: true,
      index: true,
    },
    wardIds: [{ type: Schema.Types.ObjectId, ref: "Student", default: [] }],
    invitedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    inviteStatus: {
      type: String,
      enum: ["invited", "accepted", "declined"],
      default: "invited",
      index: true,
    },
    attendanceStatus: {
      type: String,
      enum: ["invited", "joined", "left", "no_show"],
      default: "invited",
      index: true,
    },
    responseNote: { type: String, default: null, trim: true },
    respondedAt: { type: Date, default: null },
    joinedAt: { type: Date, default: null },
    leftAt: { type: Date, default: null },
  },
  { timestamps: true }
);

meetingParticipantSchema.index({ meetingId: 1, userId: 1 }, { unique: true });
meetingParticipantSchema.index({ schoolId: 1, userId: 1, createdAt: -1 });
meetingParticipantSchema.index({ meetingId: 1, role: 1 });

export const MeetingParticipant: Model<IMeetingParticipant> =
  (models.MeetingParticipant as Model<IMeetingParticipant>) ||
  model<IMeetingParticipant>("MeetingParticipant", meetingParticipantSchema);
