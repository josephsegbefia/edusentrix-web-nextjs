import { Schema, model, models, Types, type Model } from "mongoose";

export interface ILearnStudentSession {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  accountId: Types.ObjectId;
  /** SHA-256 hex hash of the opaque mobile Bearer token */
  tokenHash?: string | null;
  expiresAt?: Date | null;
  startedAt: Date;
  endedAt?: Date | null;
  lastSeenAt: Date;
  deviceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const learnStudentSessionSchema = new Schema<ILearnStudentSession>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "LearnStudentAccount",
      required: true,
      index: true,
    },
    tokenHash: { type: String, default: null, trim: true, index: true, sparse: true },
    expiresAt: { type: Date, default: null, index: true },
    startedAt: { type: Date, required: true, default: () => new Date(), index: true },
    endedAt: { type: Date, default: null },
    lastSeenAt: { type: Date, required: true, default: () => new Date(), index: true },
    deviceId: { type: String, default: null, trim: true },
    ipAddress: { type: String, default: null, trim: true },
    userAgent: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

learnStudentSessionSchema.index({ schoolId: 1, lastSeenAt: -1 });
learnStudentSessionSchema.index({ studentId: 1, lastSeenAt: -1 });

export const LearnStudentSession: Model<ILearnStudentSession> =
  (models.LearnStudentSession as Model<ILearnStudentSession>) ||
  model<ILearnStudentSession>("LearnStudentSession", learnStudentSessionSchema);
