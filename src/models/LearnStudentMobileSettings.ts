import { Schema, model, models, Types, type Model } from "mongoose";

export interface ILearnStudentMobileSettings {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  accountId: Types.ObjectId;
  notificationsEnabled: boolean;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  soundEffectsEnabled: boolean;
  reducedMotionEnabled: boolean;
  dailyGoalMinutes: number;
  offlineDownloadsEnabled: boolean;
  leoTutorHintsFirst: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const learnStudentMobileSettingsSchema = new Schema<ILearnStudentMobileSettings>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "LearnStudentAccount",
      required: true,
      index: true,
    },
    notificationsEnabled: { type: Boolean, default: true },
    dailyReminderEnabled: { type: Boolean, default: true },
    dailyReminderTime: { type: String, default: "16:30", trim: true },
    soundEffectsEnabled: { type: Boolean, default: true },
    reducedMotionEnabled: { type: Boolean, default: false },
    dailyGoalMinutes: { type: Number, default: 20, min: 5, max: 120 },
    offlineDownloadsEnabled: { type: Boolean, default: false },
    leoTutorHintsFirst: { type: Boolean, default: true },
  },
  { timestamps: true }
);

learnStudentMobileSettingsSchema.index(
  { schoolId: 1, studentId: 1, accountId: 1 },
  { unique: true }
);

export const LearnStudentMobileSettings: Model<ILearnStudentMobileSettings> =
  (models.LearnStudentMobileSettings as Model<ILearnStudentMobileSettings>) ||
  model<ILearnStudentMobileSettings>(
    "LearnStudentMobileSettings",
    learnStudentMobileSettingsSchema
  );
