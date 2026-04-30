import { Schema, model, models, type Model, type Types } from "mongoose";

export interface ILibrarySettings {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  defaultLoanDaysStudent: number;
  defaultLoanDaysTeacher: number;
  defaultLoanDaysStaff: number;
  maxBooksPerStudent: number;
  maxBooksPerTeacher: number;
  maxBooksPerStaff: number;
  allowRenewals: boolean;
  maxRenewals: number;
  renewalDays: number;
  enableFines: boolean;
  finePerDay: number;
  graceDaysAfterDueDate: number;
  enableReplacementFees: boolean;
  notifyBeforeDueDate: boolean;
  dueReminderDaysBefore: number;
  notifyOnDueDate: boolean;
  notifyAfterOverdue: boolean;
  overdueReminderFrequencyDays: number;
  notifyParentsForStudentOverdue: boolean;
  notifyTeachersForTeacherOverdue: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const librarySettingsSchema = new Schema<ILibrarySettings>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, unique: true, index: true },
    defaultLoanDaysStudent: { type: Number, default: 14, min: 1, max: 365 },
    defaultLoanDaysTeacher: { type: Number, default: 30, min: 1, max: 365 },
    defaultLoanDaysStaff: { type: Number, default: 21, min: 1, max: 365 },
    maxBooksPerStudent: { type: Number, default: 2, min: 1, max: 50 },
    maxBooksPerTeacher: { type: Number, default: 5, min: 1, max: 100 },
    maxBooksPerStaff: { type: Number, default: 3, min: 1, max: 100 },
    allowRenewals: { type: Boolean, default: true },
    maxRenewals: { type: Number, default: 1, min: 0, max: 10 },
    renewalDays: { type: Number, default: 7, min: 1, max: 365 },
    enableFines: { type: Boolean, default: false },
    finePerDay: { type: Number, default: 1, min: 0, max: 1000 },
    graceDaysAfterDueDate: { type: Number, default: 0, min: 0, max: 90 },
    enableReplacementFees: { type: Boolean, default: true },
    notifyBeforeDueDate: { type: Boolean, default: true },
    dueReminderDaysBefore: { type: Number, default: 2, min: 0, max: 30 },
    notifyOnDueDate: { type: Boolean, default: true },
    notifyAfterOverdue: { type: Boolean, default: true },
    overdueReminderFrequencyDays: { type: Number, default: 3, min: 1, max: 30 },
    notifyParentsForStudentOverdue: { type: Boolean, default: true },
    notifyTeachersForTeacherOverdue: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const LibrarySettings: Model<ILibrarySettings> =
  models.LibrarySettings || model<ILibrarySettings>("LibrarySettings", librarySettingsSchema);
