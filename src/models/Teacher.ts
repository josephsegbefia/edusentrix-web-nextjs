/* eslint-disable @typescript-eslint/no-explicit-any */
// src/models/Teacher.ts
import { Schema, model, models, Types } from "mongoose";

export interface ITeacher {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  schoolId: Types.ObjectId;
  subjectIds: Types.ObjectId[];
  homeroomClassGroupId?: Types.ObjectId | null;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

const teacherSchema = new Schema<ITeacher>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    subjectIds: [{ type: Schema.Types.ObjectId, ref: "Subject", default: [] }],
    homeroomClassGroupId: {
      type: Schema.Types.ObjectId,
      ref: "ClassGroup",
      default: null,
    },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

// One teacher per user per school
teacherSchema.index({ schoolId: 1, userId: 1 }, { unique: true });

// Guardrail: homeroom class group (when set) must belong to the same school
teacherSchema.pre("save", async function (next) {
  try {
    if (!this.homeroomClassGroupId) return next();
    const { ClassGroup } = await import("./ClassGroup");
    const grpRaw = await ClassGroup.findById(this.homeroomClassGroupId)
      .select("schoolId")
      .lean();
    const grp = Array.isArray(grpRaw) ? grpRaw[0] : grpRaw;
    if (!grp) return next(new Error("Homeroom class group not found"));
    if (String(grp.schoolId) !== String(this.schoolId)) {
      return next(
        new Error("Teacher.schoolId must match homeroom classGroup.schoolId")
      );
    }
    next();
  } catch (e) {
    next(e instanceof Error ? e : new Error(String(e)));
  }
});

export const Teacher = models.Teacher || model<ITeacher>("Teacher", teacherSchema);
