// src/models/Teacher.ts
import { Schema, model, models, type InferSchemaType } from "mongoose";

const QualificationSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["degree", "diploma", "certificate", "other"],
      required: true,
    },
    name: { type: String, required: true, trim: true },
    institution: { type: String, required: true, trim: true },
    year: { type: Number, required: true, min: 1900, max: 2100 },
    documentUrl: { type: String, required: false, trim: true },
  },
  { _id: false }
);

const EmergencyContactSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    relationship: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: false, trim: true },
  },
  { _id: false }
);

const TeacherSchema = new Schema(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    subjectIds: [{ type: Schema.Types.ObjectId, ref: "Subject", index: true }],
    homeroomClassGroupId: {
      type: Schema.Types.ObjectId,
      ref: "ClassGroup",
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "on_leave", "terminated"],
      default: "active",
      index: true,
    },
    // Professional details
    employeeId: { type: String, trim: true },
    hireDate: { type: Date },
    terminationDate: { type: Date },
    department: { type: String, trim: true },
    qualifications: { type: [QualificationSchema], default: [] },

    // Capacity details
    maxClasses: { type: Number, min: 0 },
    maxStudents: { type: Number, min: 0 },

    // Emergency / Internal contacts
    emergencyContact: { type: EmergencyContactSchema, default: null },
    notes: { type: String, trim: true },
    tags: { type: [String], default: [], index: true },
    // Demo tenant ID for demo environment isolation
    demoTenantId: { type: String, default: null, index: true, sparse: true },
  },
  { timestamps: true }
);

// One teacher per user school
TeacherSchema.index({ userId: 1, schoolId: 1 }, { unique: true });

// employeeId unique per school (optional)
TeacherSchema.index(
  { schoolId: 1, employeeId: 1 },
  { unique: true, sparse: true }
);

type ITeacher = InferSchemaType<typeof TeacherSchema>;
// Guardrail: homeroom class group (when set) must belong to the same school
TeacherSchema.pre("save", async function (next) {
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

export const Teacher =
  models.Teacher || model<ITeacher>("Teacher", TeacherSchema);
