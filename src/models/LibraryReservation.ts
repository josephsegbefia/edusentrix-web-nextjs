import { Schema, model, models, type Model, type Types } from "mongoose";
import type { LibraryBorrowerType } from "@/models/LibraryLoan";

export type LibraryReservationStatus =
  | "pending"
  | "ready"
  | "fulfilled"
  | "cancelled"
  | "expired";

export interface ILibraryReservation {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  bookId: Types.ObjectId;
  bookCopyId?: Types.ObjectId;
  borrowerType: LibraryBorrowerType;
  borrowerId: Types.ObjectId;
  status: LibraryReservationStatus;
  queuePosition: number;
  reservedAt: Date;
  readyAt?: Date;
  expiresAt?: Date;
  fulfilledAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const libraryReservationSchema = new Schema<ILibraryReservation>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    bookId: { type: Schema.Types.ObjectId, ref: "LibraryBook", required: true, index: true },
    bookCopyId: { type: Schema.Types.ObjectId, ref: "LibraryBookCopy" },
    borrowerType: {
      type: String,
      enum: ["student", "teacher", "staff"],
      required: true,
      index: true,
    },
    borrowerId: { type: Schema.Types.ObjectId, required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "ready", "fulfilled", "cancelled", "expired"],
      default: "pending",
      index: true,
    },
    queuePosition: { type: Number, required: true, min: 1 },
    reservedAt: { type: Date, required: true, default: Date.now, index: true },
    readyAt: { type: Date },
    expiresAt: { type: Date },
    fulfilledAt: { type: Date },
    cancelledAt: { type: Date },
  },
  { timestamps: true }
);

libraryReservationSchema.index({ schoolId: 1, bookId: 1, status: 1, queuePosition: 1 });
libraryReservationSchema.index({ schoolId: 1, borrowerType: 1, borrowerId: 1, status: 1 });

libraryReservationSchema.index(
  { schoolId: 1, bookId: 1, borrowerType: 1, borrowerId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["pending", "ready"] } },
  }
);

export const LibraryReservation: Model<ILibraryReservation> =
  models.LibraryReservation ||
  model<ILibraryReservation>("LibraryReservation", libraryReservationSchema);
