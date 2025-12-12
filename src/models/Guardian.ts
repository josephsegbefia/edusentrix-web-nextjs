// src/models/Guardian.ts
import { Schema, model, models, Types } from "mongoose";

export type GuardianRelationship =
  | "mother"
  | "father"
  | "guardian"
  | "step_mother"
  | "step_father"
  | "grandmother"
  | "grandfather"
  | "aunt"
  | "uncle"
  | "other";

export interface IGuardian {
  _id: Types.ObjectId;
  studentId: Types.ObjectId; // ref: Student
  userId: Types.ObjectId; // ref: User (the parent account)
  relationship: GuardianRelationship;
  occupation?: string | null;
  isPrimary: boolean;
  phone?: string | null;
  email: string; // Denormalized for quick access
  photoUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const guardianSchema = new Schema<IGuardian>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    relationship: {
      type: String,
      enum: [
        "mother",
        "father",
        "guardian",
        "step_mother",
        "step_father",
        "grandmother",
        "grandfather",
        "aunt",
        "uncle",
        "other",
      ],
      required: true,
    },
    occupation: {
      type: String,
      default: null,
      trim: true,
    },
    isPrimary: {
      type: Boolean,
      default: false,
      index: true,
    },
    phone: {
      type: String,
      default: null,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    photoUrl: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
guardianSchema.index({ studentId: 1, isPrimary: 1 });
guardianSchema.index({ userId: 1, studentId: 1 }, { unique: true }); // One guardian per student per user
guardianSchema.index({ studentId: 1, relationship: 1 });

// Ensure only one primary guardian per student
guardianSchema.pre("save", async function (next) {
  if (this.isPrimary && this.isModified("isPrimary")) {
    const { Guardian } = await import("./Guardian");
    // Unset other primary guardians for this student
    await Guardian.updateMany(
      {
        studentId: this.studentId,
        _id: { $ne: this._id },
        isPrimary: true,
      },
      { $set: { isPrimary: false } }
    );
  }
  next();
});

export const Guardian =
  models.Guardian || model<IGuardian>("Guardian", guardianSchema);
