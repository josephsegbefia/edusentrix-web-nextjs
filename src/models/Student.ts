// src/models/Student.ts
import { Schema, model, models, Types } from "mongoose";
import type { IClassGroup } from "./ClassGroup";
import type { IGrade } from "./Grade";

export interface IStudent {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  userId?: Types.ObjectId | null; // optional link to User (Clerk-backed)
  admissionNo?: string | null;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  sex?: "male" | "female";
  dateOfBirth?: Date | null;

  gradeId: Types.ObjectId; // required
  classGroupId: Types.ObjectId; // required

  // Subject overrides relative to ClassGroup.subjectIds
  subjectAddIds?: Types.ObjectId[]; // extra subjects only this student takes
  subjectRemoveIds?: Types.ObjectId[]; // subjects this student does NOT take

  photoUrl?: string | null;
  status: "active" | "inactive" | "withdrawn";
  enrolledAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const studentSchema = new Schema<IStudent>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },

    admissionNo: { type: String, default: null, trim: true },
    firstName: { type: String, required: true, trim: true },
    middleName: { type: String, default: null, trim: true },
    lastName: { type: String, required: true, trim: true },
    sex: { type: String, enum: ["male", "female"], default: "male" },
    dateOfBirth: { type: Date, default: null },

    gradeId: {
      type: Schema.Types.ObjectId,
      ref: "Grade",
      required: true,
      index: true,
    },
    classGroupId: {
      type: Schema.Types.ObjectId,
      ref: "ClassGroup",
      required: true,
      index: true,
    },

    subjectAddIds: [
      { type: Schema.Types.ObjectId, ref: "Subject", default: [] },
    ],
    subjectRemoveIds: [
      { type: Schema.Types.ObjectId, ref: "Subject", default: [] },
    ],

    photoUrl: { type: String, default: null },
    status: {
      type: String,
      enum: ["active", "inactive", "withdrawn"],
      default: "active",
    },
    enrolledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Useful lookups
studentSchema.index({ schoolId: 1, lastName: 1, firstName: 1 });
studentSchema.index({ schoolId: 1, classGroupId: 1 });

// Guardrail: classGroup.schoolId & grade.schoolId must match student.schoolId
studentSchema.pre("save", async function (next) {
  try {
    const { ClassGroup } = await import("./ClassGroup");
    const { Grade } = await import("./Grade");
    const grpRaw = await ClassGroup.findById(this.classGroupId).lean();
    const grp = (Array.isArray(grpRaw) ? grpRaw[0] : grpRaw) as Pick<
      IClassGroup,
      "schoolId" | "gradeId"
    > | null;
    if (!grp) return next(new Error("ClassGroup not found"));

    const grdRaw = await Grade.findById(this.gradeId).lean();
    const grd = (Array.isArray(grdRaw) ? grdRaw[0] : grdRaw) as Pick<
      IGrade,
      "schoolId"
    > | null;
    if (!grd) return next(new Error("Grade not found"));

    if (String(grp.schoolId) !== String(this.schoolId)) {
      return next(new Error("Student.schoolId must match ClassGroup.schoolId"));
    }
    if (String(grd.schoolId) !== String(this.schoolId)) {
      return next(new Error("Student.schoolId must match Grade.schoolId"));
    }
    if (String(grp.gradeId) !== String(this.gradeId)) {
      return next(new Error("ClassGroup.gradeId must match Student.gradeId"));
    }
    next();
  } catch (e) {
    next(e instanceof Error ? e : new Error(String(e)));
  }
});

// Instance helper: resolve effective subjects
studentSchema.methods.getEffectiveSubjectIds = async function (): Promise<
  Types.ObjectId[]
> {
  const { ClassGroup } = await import("./ClassGroup");
  const grpRaw = await ClassGroup.findById(this.classGroupId)
    .select("subjectIds")
    .lean();
  const grpNormalized = Array.isArray(grpRaw) ? grpRaw[0] : grpRaw;
  const grp = grpNormalized as Pick<IClassGroup, "subjectIds"> | null;
  const base = new Set<string>(
    (grp?.subjectIds || []).map((id: Types.ObjectId) => String(id))
  );

  for (const add of this.subjectAddIds || []) base.add(String(add));
  for (const rem of this.subjectRemoveIds || []) base.delete(String(rem));

  return Array.from(base).map((id) => new Types.ObjectId(id));
};

export const Student =
  models.Student || model<IStudent>("Student", studentSchema);
