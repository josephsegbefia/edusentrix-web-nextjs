import { Schema, model, models, type Model, type Types } from "mongoose";

export type LearnFactCardStatus = "draft" | "published";

export interface ILearnFactCard {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  subjectId?: Types.ObjectId | null;
  subjectOfferingId?: Types.ObjectId | null;
  teacherId: Types.ObjectId;
  /** The short hook sentence shown as the card "front". */
  fact: string;
  /** 2-3 sentences of context or explanation. */
  detail: string;
  tags: string[];
  status: LearnFactCardStatus;
  publishedToLearn: boolean;
  publishedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const learnFactCardSchema = new Schema<ILearnFactCard>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "LessonSession", required: true, index: true },
    classGroupId: {
      type: Schema.Types.ObjectId,
      ref: "ClassGroup",
      required: true,
      index: true,
    },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", default: null },
    subjectOfferingId: { type: Schema.Types.ObjectId, ref: "SubjectOffering", default: null },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true, index: true },
    fact: { type: String, trim: true, required: true, maxlength: 500 },
    detail: { type: String, trim: true, required: true, maxlength: 2000 },
    tags: [{ type: String, trim: true, maxlength: 60 }],
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
      index: true,
    },
    publishedToLearn: { type: Boolean, default: false, index: true },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

learnFactCardSchema.index({ schoolId: 1, sessionId: 1 });
learnFactCardSchema.index({ schoolId: 1, classGroupId: 1, publishedToLearn: 1 });

export const LearnFactCard: Model<ILearnFactCard> =
  (models.LearnFactCard as Model<ILearnFactCard>) ||
  model<ILearnFactCard>("LearnFactCard", learnFactCardSchema);
