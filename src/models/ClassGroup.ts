/* eslint-disable @typescript-eslint/no-explicit-any */
// src/models/ClassGroup.ts
import { Schema, model, models, Types } from "mongoose";
import type { IGrade } from "./Grade";

export interface IClassGroup {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  gradeId: Types.ObjectId;
  name: string; // e.g. "A", "B"
  subjectIds: Types.ObjectId[]; // assigned subjects for the whole class group
  homeroomTeacherId?: Types.ObjectId | null;
  capacity?: number | null;
  defaultRoomId?: Types.ObjectId | null; // Home classroom where most lessons happen
  defaultRoomName?: string | null; // Friendly name like "Room 12", "Block A Room 3"
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const classGroupSchema = new Schema<IClassGroup>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    gradeId: {
      type: Schema.Types.ObjectId,
      ref: "Grade",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true }, // "A"

    subjectIds: [{ type: Schema.Types.ObjectId, ref: "Subject", default: [] }],
    homeroomTeacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      default: null,
    },
    capacity: { type: Number, default: null },
    defaultRoomId: {
      type: Schema.Types.ObjectId,
      ref: "Room", // Future Room model, nullable for now
      default: null,
    },
    defaultRoomName: {
      type: String,
      trim: true,
      default: null,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Ensure group name is unique per grade within a school (case-insensitive)
classGroupSchema.index(
  { schoolId: 1, gradeId: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

// Guardrail: grade.schoolId must match classGroup.schoolId
classGroupSchema.pre("save", async function (next) {
  try {
    const Grade = (await import("./Grade")).Grade;
    const gradeRaw = await Grade.findById(this.gradeId).lean();
    const grade = (Array.isArray(gradeRaw) ? gradeRaw[0] : gradeRaw) as Pick<
      IGrade,
      "schoolId"
    > | null;
    if (!grade) return next(new Error("Grade not found"));
    if (String(grade.schoolId) !== String(this.schoolId)) {
      return next(new Error("ClassGroup.schoolId must match Grade.schoolId"));
    }
    next();
  } catch (e) {
    next(e instanceof Error ? e : new Error(String(e)));
  }
});

classGroupSchema.virtual("fullLabel").get(function () {
  return this.populated("gradeId")
    ? `${(this as any).grade.name} ${this.name}`
    : this.name;
});

export const ClassGroup =
  models.ClassGroup || model<IClassGroup>("ClassGroup", classGroupSchema);
