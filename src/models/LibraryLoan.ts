import { Schema, model, models, type Model, type Types } from "mongoose";
import type { LibraryBookCopyCondition } from "@/models/LibraryBookCopy";

export type LibraryBorrowerType = "student" | "teacher" | "staff";

export type LibraryLoanStatus =
  | "active"
  | "returned"
  | "overdue"
  | "lost"
  | "damaged"
  | "cancelled";

export type LibraryFineStatus = "none" | "pending" | "paid" | "waived";

export interface ILibraryLoan {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  bookId: Types.ObjectId;
  bookCopyId: Types.ObjectId;
  borrowerType: LibraryBorrowerType;
  borrowerId: Types.ObjectId;
  issuedBy: Types.ObjectId;
  returnedTo?: Types.ObjectId;
  issuedAt: Date;
  dueAt: Date;
  returnedAt?: Date;
  status: LibraryLoanStatus;
  isOpen: boolean;
  renewalCount: number;
  lastRenewedAt?: Date;
  lastRenewedBy?: Types.ObjectId;
  returnCondition?: LibraryBookCopyCondition;
  fineAmount: number;
  fineStatus: LibraryFineStatus;
  fineWaivedBy?: Types.ObjectId;
  fineWaivedAt?: Date;
  fineWaiverReason?: string;
  replacementFeeAmount?: number;
  replacementFeeStatus?: "none" | "pending" | "paid" | "waived";
  linkedFeeId?: Types.ObjectId;
  /** When a "due soon" reminder was last sent (separate from overdue cadence). */
  lastDueSoonReminderAt?: Date;
  lastReminderSentAt?: Date;
  reminderCount?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const libraryLoanSchema = new Schema<ILibraryLoan>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    bookId: { type: Schema.Types.ObjectId, ref: "LibraryBook", required: true, index: true },
    bookCopyId: { type: Schema.Types.ObjectId, ref: "LibraryBookCopy", required: true, index: true },
    borrowerType: {
      type: String,
      enum: ["student", "teacher", "staff"],
      required: true,
      index: true,
    },
    borrowerId: { type: Schema.Types.ObjectId, required: true, index: true },
    issuedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    returnedTo: { type: Schema.Types.ObjectId, ref: "User" },
    issuedAt: { type: Date, required: true, default: Date.now, index: true },
    dueAt: { type: Date, required: true, index: true },
    returnedAt: { type: Date, index: true },
    status: {
      type: String,
      enum: ["active", "returned", "overdue", "lost", "damaged", "cancelled"],
      default: "active",
      index: true,
    },
    isOpen: { type: Boolean, default: true, index: true },
    renewalCount: { type: Number, default: 0, min: 0 },
    lastRenewedAt: { type: Date },
    lastRenewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    returnCondition: {
      type: String,
      enum: ["new", "good", "fair", "damaged", "lost"],
    },
    fineAmount: { type: Number, default: 0, min: 0 },
    fineStatus: {
      type: String,
      enum: ["none", "pending", "paid", "waived"],
      default: "none",
      index: true,
    },
    fineWaivedBy: { type: Schema.Types.ObjectId, ref: "User" },
    fineWaivedAt: { type: Date },
    fineWaiverReason: { type: String, trim: true },
    replacementFeeAmount: { type: Number, min: 0 },
    replacementFeeStatus: {
      type: String,
      enum: ["none", "pending", "paid", "waived"],
      default: "none",
    },
    linkedFeeId: { type: Schema.Types.ObjectId, sparse: true },
    lastDueSoonReminderAt: { type: Date },
    lastReminderSentAt: { type: Date },
    reminderCount: { type: Number, default: 0 },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

libraryLoanSchema.index({ schoolId: 1, borrowerType: 1, borrowerId: 1, status: 1 });
libraryLoanSchema.index({ schoolId: 1, status: 1, dueAt: 1 });
libraryLoanSchema.index({ schoolId: 1, bookId: 1, status: 1 });
libraryLoanSchema.index(
  { schoolId: 1, bookCopyId: 1, isOpen: 1 },
  {
    unique: true,
    partialFilterExpression: { isOpen: true },
  }
);

export const LibraryLoan: Model<ILibraryLoan> =
  models.LibraryLoan || model<ILibraryLoan>("LibraryLoan", libraryLoanSchema);
