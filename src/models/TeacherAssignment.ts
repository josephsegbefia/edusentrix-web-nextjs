// src/models/TeacherAssignment.ts
import { Schema, model, models, Types, type Model } from "mongoose";

export type AssignmentStatus = "active" | "inactive" | "archived";

export interface ITeacherAssignment {
  _id: Types.ObjectId;
  teacherId: Types.ObjectId;
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  subjectId: Types.ObjectId;
  subjectOfferingId?: Types.ObjectId | null;
  classGroupId: Types.ObjectId;

  // Contact hours per week for this subject in this class
  contactHoursPerWeek?: number;
  // Total workload hours (can be calculated from schedules)
  workloadHours?: number;
  status: AssignmentStatus;

  notes?: string;
  assignedBy?: Types.ObjectId | null; // keep optional (depends on requireSchoolAdmin return)
  assignedAt: Date;


  createdAt: Date;
  updatedAt: Date;
}

const TeacherAssignmentSchema = new Schema<ITeacherAssignment>(
  {
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    academicPeriodId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      required: true,
      index: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },
    subjectOfferingId: {
      type: Schema.Types.ObjectId,
      ref: "SubjectOffering",
      default: null,
      index: true,
    },
    classGroupId: {
      type: Schema.Types.ObjectId,
      ref: "ClassGroup",
      required: true,
      index: true,
    },

    contactHoursPerWeek: { type: Number, min: 0, max: 40 }, // Contact hours per week
    workloadHours: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["active", "inactive", "archived"],
      default: "active",
      index: true,
    },

    notes: { type: String, trim: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    assignedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

/**
 * ✅ Critical: allow history + replacements
 * Only ONE ACTIVE assignment per teacher+period+subject+classGroup
 */
TeacherAssignmentSchema.index(
  {
    schoolId: 1,
    academicPeriodId: 1,
    teacherId: 1,
    classGroupId: 1,
    subjectId: 1,
    subjectOfferingId: 1,
    status: 1,
  },
  { unique: true, partialFilterExpression: { status: "active" } }
);

/**
 * ⚠️ Note: Multiple teachers can teach the same subject/class/period (co-teaching)
 * Conflict detection is handled in application logic with warnings
 * This index is non-unique to allow multiple active assignments
 */
TeacherAssignmentSchema.index(
  {
    schoolId: 1,
    academicPeriodId: 1,
    classGroupId: 1,
    subjectId: 1,
    subjectOfferingId: 1,
    status: 1,
  }
);

// Performance indexes
TeacherAssignmentSchema.index({
  schoolId: 1,
  teacherId: 1,
  academicPeriodId: 1,
  status: 1,
});
TeacherAssignmentSchema.index({
  schoolId: 1,
  classGroupId: 1,
  academicPeriodId: 1,
  status: 1,
});
TeacherAssignmentSchema.index({
  schoolId: 1,
  subjectId: 1,
  academicPeriodId: 1,
  status: 1,
});
TeacherAssignmentSchema.index({
  schoolId: 1,
  subjectOfferingId: 1,
  academicPeriodId: 1,
  status: 1,
});

export const TeacherAssignment: Model<ITeacherAssignment> =
  (models.TeacherAssignment as Model<ITeacherAssignment>) ||
  model<ITeacherAssignment>("TeacherAssignment", TeacherAssignmentSchema);
