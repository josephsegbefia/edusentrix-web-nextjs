// src/models/Teacher.ts
import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

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

const PayoutDestinationSchema = new Schema(
  {
    method: {
      type: String,
      enum: ["bank", "mobile_money"],
      required: true,
    },
    accountName: { type: String, required: true, trim: true },
    accountNumber: { type: String, required: true, trim: true },
    bankName: { type: String, default: null, trim: true },
    bankCode: { type: String, default: null, trim: true },
    providerName: { type: String, default: null, trim: true },
    notes: { type: String, default: null, trim: true },
  },
  { _id: false }
);

const TeacherPayoutProfileSchema = new Schema(
  {
    destination: { type: PayoutDestinationSchema, default: null },
    updatedAt: { type: Date, default: null },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
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
    subjectOfferingIds: [
      { type: Schema.Types.ObjectId, ref: "SubjectOffering", index: true },
    ],
    /** Grade-scoped subject offerings this teacher is cleared to teach. */
    subjectOfferingIds: [
      { type: Schema.Types.ObjectId, ref: "SubjectOffering", index: true },
    ],
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
    employeeId: {
      type: String,
      trim: true,
      set: (value: unknown) =>
        typeof value === "string" && value.trim() ? value.trim() : undefined,
    },
    hireDate: { type: Date },
    terminationDate: { type: Date },
    leaveStartDate: { type: Date, default: null },
    leaveEndDate: { type: Date, default: null, index: true },
    leaveReason: { type: String, trim: true, default: null },
    leaveReminderOffsetsSent: { type: [Number], default: [] },
    leaveLastReminderAt: { type: Date, default: null },
    leaveEndedAt: { type: Date, default: null },
    leaveEndedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    leaveAutoActivatedAt: { type: Date, default: null },
    department: { type: String, trim: true },
    qualifications: { type: [QualificationSchema], default: [] },

    // Capacity details
    maxClasses: { type: Number, min: 0 },
    maxStudents: { type: Number, min: 0 },

    // Emergency / Internal contacts
    emergencyContact: { type: EmergencyContactSchema, default: null },
    payoutProfile: { type: TeacherPayoutProfileSchema, default: null },
    notes: { type: String, trim: true },
    tags: { type: [String], default: [], index: true },
    // Permission bundles applied to this teacher (kept for backward compatibility)
    subroles: { type: [String], default: [], index: true },
  },
  { timestamps: true }
);

// One teacher per user school
TeacherSchema.index({ userId: 1, schoolId: 1 }, { unique: true });

// employeeId is optional. Use a partial index so teachers without employee IDs
// do not collide as `{ employeeId: null }` within the same school.
TeacherSchema.index(
  { schoolId: 1, employeeId: 1 },
  {
    unique: true,
    partialFilterExpression: { employeeId: { $type: "string" } },
  }
);
TeacherSchema.index({ schoolId: 1, status: 1, leaveEndDate: 1 });

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

export const Teacher: Model<ITeacher> =
  (models.Teacher as Model<ITeacher>) ||
  model<ITeacher>("Teacher", TeacherSchema);
