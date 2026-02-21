import { Schema, model, models, Types, type Model } from "mongoose";

export type EscalationType = "discipline" | "academic" | "welfare" | "other";
export type EscalationStatus = "open" | "in_review" | "resolved" | "closed";

export interface IEscalation {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  studentId?: Types.ObjectId;
  type: EscalationType;
  title: string;
  description: string;
  status: EscalationStatus;
  resolvedAt?: Date;
  resolvedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const escalationSchema = new Schema<IEscalation>(
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
    studentId: { type: Schema.Types.ObjectId, ref: "Student" },
    type: {
      type: String,
      enum: ["discipline", "academic", "welfare", "other"],
      default: "academic",
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["open", "in_review", "resolved", "closed"],
      default: "open",
      index: true,
    },
    resolvedAt: { type: Date },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

escalationSchema.index({ schoolId: 1, teacherId: 1, createdAt: -1 });

export const Escalation: Model<IEscalation> =
  (models.Escalation as Model<IEscalation>) ||
  model<IEscalation>("Escalation", escalationSchema);
