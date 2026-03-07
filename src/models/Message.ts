import { Schema, model, models, Types, type Model } from "mongoose";

export interface IMessageAttachment {
  name: string;
  url: string;
  type: string;
  size?: number;
  key?: string;
  customId?: string | null;
}

export interface IMessageReadReceipt {
  userId: Types.ObjectId;
  readAt: Date;
}

export interface IMessage {
  _id: Types.ObjectId;
  threadId: Types.ObjectId;
  schoolId: Types.ObjectId;
  senderId: Types.ObjectId;
  body: string;
  attachments?: IMessageAttachment[];
  readBy?: IMessageReadReceipt[];
  createdAt: Date;
  updatedAt: Date;
}

const AttachmentSchema = new Schema<IMessageAttachment>(
  {
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    size: { type: Number, min: 0 },
    key: { type: String, trim: true },
    customId: { type: String, trim: true, default: null },
  },
  { _id: false }
);

const ReadReceiptSchema = new Schema<IMessageReadReceipt>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    readAt: { type: Date, required: true },
  },
  { _id: false }
);

const messageSchema = new Schema<IMessage>(
  {
    threadId: {
      type: Schema.Types.ObjectId,
      ref: "MessageThread",
      required: true,
      index: true,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    body: { type: String, required: true, trim: true },
    attachments: { type: [AttachmentSchema], default: [] },
    readBy: { type: [ReadReceiptSchema], default: [] },
  },
  { timestamps: true }
);

messageSchema.index({ threadId: 1, createdAt: -1 });
messageSchema.index({ schoolId: 1, senderId: 1, createdAt: -1 });

export const Message: Model<IMessage> =
  (models.Message as Model<IMessage>) ||
  model<IMessage>("Message", messageSchema);
