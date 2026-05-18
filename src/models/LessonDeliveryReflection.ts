import { Schema, model, models, type Model, type Types } from "mongoose";
import type { LessonObjectivesMet } from "@/models/LessonReflection";

export interface ILessonDeliveryReflection {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  deliveryId: Types.ObjectId;
  sessionId: Types.ObjectId;
  teacherId: Types.ObjectId;
  completed: boolean;
  objectivesMet: LessonObjectivesMet;
  notes?: string;
  studentsWhoStruggled: string[];
  followUpRequired: boolean;
  followUpNotes?: string;
  nextStep?: string;
  createdAt: Date;
  updatedAt: Date;
}

const lessonDeliveryReflectionSchema = new Schema<ILessonDeliveryReflection>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    deliveryId: { type: Schema.Types.ObjectId, ref: "LessonDelivery", required: true, index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "LessonSession", required: true, index: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true, index: true },
    completed: { type: Boolean, default: false, index: true },
    objectivesMet: {
      type: String,
      enum: ["yes", "partially", "no"],
      default: "partially",
    },
    notes: { type: String, trim: true, maxlength: 8000 },
    studentsWhoStruggled: {
      type: [String],
      default: [],
      validate: {
        validator: (v: string[]) => v.length <= 60,
        message: "At most 60 entries",
      },
    },
    followUpRequired: { type: Boolean, default: false },
    followUpNotes: { type: String, trim: true, maxlength: 4000 },
    nextStep: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);

lessonDeliveryReflectionSchema.index({ schoolId: 1, deliveryId: 1 }, { unique: true });

export const LessonDeliveryReflection: Model<ILessonDeliveryReflection> =
  (models.LessonDeliveryReflection as Model<ILessonDeliveryReflection>) ||
  model<ILessonDeliveryReflection>("LessonDeliveryReflection", lessonDeliveryReflectionSchema);
