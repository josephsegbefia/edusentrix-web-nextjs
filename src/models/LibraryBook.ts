import { Schema, model, models, type Model, type Types } from "mongoose";

export type LibraryBookStatus = "active" | "archived";

export interface ILibraryBook {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  title: string;
  subtitle?: string;
  author?: string;
  publisher?: string;
  isbn?: string;
  edition?: string;
  publicationYear?: number;
  category?: string;
  subject?: string;
  gradeLevelIds: Types.ObjectId[];
  language: string;
  description?: string;
  coverImageUrl?: string;
  coverImageKey?: string;
  shelfLocation?: string;
  tags: string[];
  totalCopies: number;
  availableCopies: number;
  borrowedCopies: number;
  lostCopies: number;
  damagedCopies: number;
  reservedCopies: number;
  status: LibraryBookStatus;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const libraryBookSchema = new Schema<ILibraryBook>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    title: { type: String, required: true, trim: true, index: true },
    subtitle: { type: String, trim: true },
    author: { type: String, trim: true, index: true },
    publisher: { type: String, trim: true },
    isbn: { type: String, trim: true, index: true },
    edition: { type: String, trim: true },
    publicationYear: { type: Number },
    category: { type: String, trim: true, index: true },
    subject: { type: String, trim: true, index: true },
    gradeLevelIds: [{ type: Schema.Types.ObjectId, ref: "Grade" }],
    language: { type: String, trim: true, default: "English" },
    description: { type: String, trim: true },
    coverImageUrl: { type: String },
    coverImageKey: { type: String },
    shelfLocation: { type: String, trim: true, index: true },
    tags: [{ type: String, trim: true }],
    totalCopies: { type: Number, default: 0, min: 0 },
    availableCopies: { type: Number, default: 0, min: 0 },
    borrowedCopies: { type: Number, default: 0, min: 0 },
    lostCopies: { type: Number, default: 0, min: 0 },
    damagedCopies: { type: Number, default: 0, min: 0 },
    reservedCopies: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

libraryBookSchema.index({
  title: "text",
  author: "text",
  isbn: "text",
  tags: "text",
  category: "text",
  subject: "text",
  publisher: "text",
});
libraryBookSchema.index({ schoolId: 1, status: 1, category: 1 });
libraryBookSchema.index({ schoolId: 1, subject: 1 });
libraryBookSchema.index({ schoolId: 1, createdAt: -1 });

export const LibraryBook: Model<ILibraryBook> =
  models.LibraryBook || model<ILibraryBook>("LibraryBook", libraryBookSchema);
