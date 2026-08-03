import { Schema, model, models, Types, type Model } from "mongoose";

export interface IEmailMessageAttachment {
  name: string;
  mimeType: string;
  sizeBytes?: number | null;
  storageKey?: string | null;
  generated: boolean;
}

export type EmailDirection = "outbound" | "inbound";
export type EmailMailboxScope = "platform" | "school";
export type EmailProvider = "brevo" | "resend" | "spaceship" | "clerk" | "system";

export type EmailMessageStatus =
  | "draft"
  | "queued"
  | "routing"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "deferred"
  | "blocked"
  | "bounced"
  | "complained"
  | "unsubscribed"
  | "failed"
  | "dead_letter"
  | "received";

export type EmailMessageClass =
  | "auth"
  | "invitation"
  | "billing_transactional"
  | "billing_reminder"
  | "academic"
  | "attendance"
  | "announcement"
  | "manual"
  | "bulk"
  | "support"
  | "digest"
  | "system";

export type EmailTrafficClass =
  | "transactional"
  | "manual"
  | "bulk"
  | "digest"
  | "system";

export type EmailPriority = "critical" | "high" | "normal" | "low";

export type EmailSensitivity = "low" | "moderate" | "high" | "guardian_only";

export type EmailSecureContentMode =
  | "none"
  | "summary_plus_link"
  | "attachment"
  | "portal_only";

export interface IEmailMessage {
  _id: Types.ObjectId;
  provider: EmailProvider;
  direction: EmailDirection;

  mailboxScope: EmailMailboxScope;
  mailboxKey: string;

  schoolId?: Types.ObjectId | null;
  threadId?: Types.ObjectId | null;
  batchId?: Types.ObjectId | null;

  from: string;
  fromName?: string | null;
  to: string;
  cc?: string | null;
  bcc?: string | null;
  replyTo?: string | null;

  subject: string;
  htmlBody?: string | null;
  textBody?: string | null;
  previewText?: string | null;

  status: EmailMessageStatus;
  messageClass: EmailMessageClass;
  trafficClass: EmailTrafficClass;
  priority: EmailPriority;

  templateKey?: string | null;
  templateVersion?: string | null;

  relatedEntityType?: string | null;
  relatedEntityId?: string | null;

  actorId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;

  recipientUserId?: Types.ObjectId | null;
  recipientRole?: string | null;
  recipientEmailVerified?: boolean | null;

  sensitivity: EmailSensitivity;
  secureContentMode: EmailSecureContentMode;

  providerMessageId?: string | null;
  messageIdHeader?: string | null;
  inReplyTo?: string | null;
  referencesHeader?: string[] | null;

  replyAlias?: string | null;
  routingToken?: string | null;

  attachments?: IEmailMessageAttachment[];

  failureReason?: string | null;
  skipReason?: string | null;
  sentAt?: Date | null;
  deliveredAt?: Date | null;
  openedAt?: Date | null;
  receivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const EmailMessageAttachmentSchema = new Schema<IEmailMessageAttachment>(
  {
    name: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    sizeBytes: { type: Number, default: null },
    storageKey: { type: String, default: null, trim: true },
    generated: { type: Boolean, required: true },
  },
  { _id: false },
);

const emailMessageSchema = new Schema<IEmailMessage>(
  {
    provider: {
      type: String,
      enum: ["brevo", "resend", "spaceship", "clerk", "system"],
      required: true,
    },
    direction: {
      type: String,
      enum: ["outbound", "inbound"],
      required: true,
    },

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
    threadId: {
      type: Schema.Types.ObjectId,
      ref: "EmailThread",
      default: null,
      index: true,
    },
    batchId: {
      type: Schema.Types.ObjectId,
      ref: "EmailBatch",
      default: null,
      index: true,
    },

    from: { type: String, required: true, trim: true },
    fromName: { type: String, default: null, trim: true },
    to: { type: String, required: true, trim: true },
    cc: { type: String, default: null, trim: true },
    bcc: { type: String, default: null, trim: true },
    replyTo: { type: String, default: null, trim: true },

    subject: { type: String, required: true, trim: true },
    htmlBody: { type: String, default: null },
    textBody: { type: String, default: null },
    previewText: { type: String, default: null, trim: true },

    status: {
      type: String,
      enum: [
        "draft",
        "queued",
        "routing",
        "sent",
        "delivered",
        "opened",
        "clicked",
        "deferred",
        "blocked",
        "bounced",
        "complained",
        "unsubscribed",
        "failed",
        "dead_letter",
        "received",
      ],
      default: "queued",
      index: true,
    },
    messageClass: {
      type: String,
      enum: [
        "auth",
        "invitation",
        "billing_transactional",
        "billing_reminder",
        "academic",
        "attendance",
        "announcement",
        "manual",
        "bulk",
        "support",
        "digest",
        "system",
      ],
      required: true,
    },
    trafficClass: {
      type: String,
      enum: ["transactional", "manual", "bulk", "digest", "system"],
      required: true,
    },
    priority: {
      type: String,
      enum: ["critical", "high", "normal", "low"],
      default: "normal",
    },

    templateKey: { type: String, default: null, trim: true },
    templateVersion: { type: String, default: null, trim: true },

    relatedEntityType: { type: String, default: null, trim: true },
    relatedEntityId: { type: String, default: null, trim: true },

    actorId: { type: String, default: null, trim: true },
    actorName: { type: String, default: null, trim: true },
    actorRole: { type: String, default: null, trim: true },

    recipientUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    recipientRole: { type: String, default: null, trim: true },
    recipientEmailVerified: { type: Boolean, default: null },

    sensitivity: {
      type: String,
      enum: ["low", "moderate", "high", "guardian_only"],
      default: "low",
    },
    secureContentMode: {
      type: String,
      enum: ["none", "summary_plus_link", "attachment", "portal_only"],
      default: "none",
    },

    providerMessageId: { type: String, default: null, trim: true },
    messageIdHeader: { type: String, default: null, trim: true },
    inReplyTo: { type: String, default: null, trim: true },
    referencesHeader: [{ type: String }],

    replyAlias: { type: String, default: null, trim: true },
    routingToken: { type: String, default: null, trim: true },

    attachments: { type: [EmailMessageAttachmentSchema], default: undefined },

    failureReason: { type: String, default: null, trim: true },
    skipReason: { type: String, default: null, trim: true },
    sentAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    openedAt: { type: Date, default: null },
    receivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

emailMessageSchema.index({ providerMessageId: 1 }, { sparse: true });
emailMessageSchema.index({ routingToken: 1 }, { sparse: true });
emailMessageSchema.index({ mailboxScope: 1, mailboxKey: 1, createdAt: -1 });
emailMessageSchema.index({ schoolId: 1, messageClass: 1, createdAt: -1 });
emailMessageSchema.index({ relatedEntityType: 1, relatedEntityId: 1 });

export const EmailMessage: Model<IEmailMessage> =
  (models.EmailMessage as Model<IEmailMessage>) ||
  model<IEmailMessage>("EmailMessage", emailMessageSchema);
