import { Schema, model, models, Types } from "mongoose";

export type JournalStatus = "draft" | "published";

export interface IJournalEntry {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  subjectId?: Types.ObjectId;
  date: Date;
  title?: string;
  content: string;
  status: JournalStatus;
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
    size?: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const AttachmentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    size: { type: Number, min: 0 },
  },
  { _id: false }
);

const journalEntrySchema = new Schema<IJournalEntry>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },
    classGroupId: {
      type: Schema.Types.ObjectId,
      ref: "ClassGroup",
      required: true,
      index: true,
    },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject" },
    date: { type: Date, required: true, index: true },
    title: { type: String, trim: true },
    content: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
      index: true,
    },
    attachments: { type: [AttachmentSchema], default: [] },
  },
  { timestamps: true }
);

journalEntrySchema.index({ schoolId: 1, classGroupId: 1, date: -1 });

export const JournalEntry =
  models.JournalEntry ||
  model<IJournalEntry>("JournalEntry", journalEntrySchema);
