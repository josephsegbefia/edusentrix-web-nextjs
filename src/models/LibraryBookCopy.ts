import { Schema, model, models, type Model, type Types } from "mongoose";

export type LibraryBookCopyCondition = "new" | "good" | "fair" | "damaged" | "lost";

export type LibraryBookCopyStatus =
  | "available"
  | "borrowed"
  | "reserved"
  | "maintenance"
  | "lost"
  | "damaged"
  | "archived";

export interface ILibraryBookCopy {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  bookId: Types.ObjectId;
  copyCode: string;
  barcode?: string;
  qrCode?: string;
  condition: LibraryBookCopyCondition;
  status: LibraryBookCopyStatus;
  shelfLocation?: string;
  acquisitionDate?: Date;
  acquisitionCost?: number;
  source?: "purchase" | "donation" | "government" | "other";
  notes?: string;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const libraryBookCopySchema = new Schema<ILibraryBookCopy>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    bookId: { type: Schema.Types.ObjectId, ref: "LibraryBook", required: true, index: true },
    copyCode: { type: String, required: true, trim: true },
    barcode: { type: String, trim: true },
    qrCode: { type: String, trim: true },
    condition: {
      type: String,
      enum: ["new", "good", "fair", "damaged", "lost"],
      default: "good",
      index: true,
    },
    status: {
      type: String,
      enum: ["available", "borrowed", "reserved", "maintenance", "lost", "damaged", "archived"],
      default: "available",
      index: true,
    },
    shelfLocation: { type: String, trim: true, index: true },
    acquisitionDate: { type: Date },
    acquisitionCost: { type: Number, min: 0 },
    source: {
      type: String,
      enum: ["purchase", "donation", "government", "other"],
      default: "purchase",
    },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

libraryBookCopySchema.index({ schoolId: 1, copyCode: 1 }, { unique: true });
libraryBookCopySchema.index({ schoolId: 1, barcode: 1 }, { sparse: true });
libraryBookCopySchema.index({ schoolId: 1, qrCode: 1 }, { sparse: true });
libraryBookCopySchema.index({ schoolId: 1, bookId: 1, status: 1 });
libraryBookCopySchema.index({ schoolId: 1, status: 1, condition: 1 });

export const LibraryBookCopy: Model<ILibraryBookCopy> =
  models.LibraryBookCopy || model<ILibraryBookCopy>("LibraryBookCopy", libraryBookCopySchema);
