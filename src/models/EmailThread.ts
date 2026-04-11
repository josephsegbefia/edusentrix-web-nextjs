import { Schema, model, models, Types, type Model } from "mongoose";

export interface IEmailThreadParticipant {
  email: string;
  name?: string | null;
  roleHint?: string | null;
  userId?: Types.ObjectId | null;
}

export type EmailThreadType =
  | "support"
  | "billing"
  | "school_ops"
  | "invitation"
  | "application"
  | "payment_setup"
  | "invoice"
  | "manual";

export type EmailThreadStatus = "open" | "closed" | "archived";

export interface IEmailThread {
  _id: Types.ObjectId;
  mailboxScope: "platform" | "school";
  mailboxKey: string;
  schoolId?: Types.ObjectId | null;

  subject: string;
  participants: IEmailThreadParticipant[];

  threadType: EmailThreadType;

  relatedEntityType?: string | null;
  relatedEntityId?: string | null;

  lastMessageAt: Date;
  lastOutboundAt?: Date | null;
  lastInboundAt?: Date | null;
  unreadCountPlatform: number;
  unreadCountSchool: number;

  routingToken: string;
  status: EmailThreadStatus;
  createdAt: Date;
  updatedAt: Date;
}

const EmailThreadParticipantSchema = new Schema<IEmailThreadParticipant>(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, default: null, trim: true },
    roleHint: { type: String, default: null, trim: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: false },
);

const emailThreadSchema = new Schema<IEmailThread>(
  {
    mailboxScope: {
      type: String,
      enum: ["platform", "school"],
      required: true,
    },
    mailboxKey: { type: String, required: true, trim: true },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      default: null,
      index: true,
    },

    subject: { type: String, required: true, trim: true },
    participants: {
      type: [EmailThreadParticipantSchema],
      default: [],
    },

    threadType: {
      type: String,
      enum: [
        "support",
        "billing",
        "school_ops",
        "invitation",
        "application",
        "payment_setup",
        "invoice",
        "manual",
      ],
      required: true,
    },

    relatedEntityType: { type: String, default: null, trim: true },
    relatedEntityId: { type: String, default: null, trim: true },

    lastMessageAt: { type: Date, required: true },
    lastOutboundAt: { type: Date, default: null },
    lastInboundAt: { type: Date, default: null },
    unreadCountPlatform: { type: Number, default: 0 },
    unreadCountSchool: { type: Number, default: 0 },

    routingToken: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["open", "closed", "archived"],
      default: "open",
    },
  },
  { timestamps: true },
);

emailThreadSchema.index({ mailboxScope: 1, mailboxKey: 1, lastMessageAt: -1 });
emailThreadSchema.index({ relatedEntityType: 1, relatedEntityId: 1 });

export const EmailThread: Model<IEmailThread> =
  (models.EmailThread as Model<IEmailThread>) ||
  model<IEmailThread>("EmailThread", emailThreadSchema);
