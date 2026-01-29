import { Schema, model, models, Types } from "mongoose";

export type MessageParticipantRole =
  | "teacher"
  | "parent"
  | "student"
  | "school_admin"
  | "staff";

export interface IMessageParticipant {
  userId: Types.ObjectId;
  role: MessageParticipantRole;
}

export interface IMessageThread {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  studentId?: Types.ObjectId;
  subject?: string;
  participants: IMessageParticipant[];
  lastMessageAt?: Date;
  lastMessagePreview?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ParticipantSchema = new Schema<IMessageParticipant>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: {
      type: String,
      enum: ["teacher", "parent", "student", "school_admin", "staff"],
      required: true,
    },
  },
  { _id: false }
);

const messageThreadSchema = new Schema<IMessageThread>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    studentId: { type: Schema.Types.ObjectId, ref: "Student" },
    subject: { type: String, trim: true },
    participants: { type: [ParticipantSchema], default: [] },
    lastMessageAt: { type: Date, index: true },
    lastMessagePreview: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

messageThreadSchema.index({ schoolId: 1, lastMessageAt: -1 });
messageThreadSchema.index({ schoolId: 1, "participants.userId": 1 });

export const MessageThread =
  models.MessageThread ||
  model<IMessageThread>("MessageThread", messageThreadSchema);
