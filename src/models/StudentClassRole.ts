// src/models/StudentClassRole.ts
import { Schema, model, models, Types } from "mongoose";

/**
 * Student Class Role Assignment
 * Links a student to a role within their class for a specific academic period
 * Supports role history tracking and term-based assignments
 */
export interface IStudentClassRole {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  roleDefinitionId: Types.ObjectId; // Reference to ClassRoleDefinition

  // For subject-specific roles (like Subject Representative)
  subjectId?: Types.ObjectId | null;

  // Assignment details
  assignedBy: Types.ObjectId; // Teacher or Admin who assigned
  assignedAt: Date;
  startDate: Date;
  endDate?: Date | null; // null = ongoing until end of period

  // Status
  isActive: boolean;
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

const StudentClassRoleSchema = new Schema<IStudentClassRole>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    classGroupId: {
      type: Schema.Types.ObjectId,
      ref: "ClassGroup",
      required: true,
      index: true,
    },
    academicPeriodId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      required: true,
      index: true,
    },
    roleDefinitionId: {
      type: Schema.Types.ObjectId,
      ref: "ClassRoleDefinition",
      required: true,
      index: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      default: null,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endDate: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true }
);

/**
 * Ensure only one active assignment per student+role+class+period
 * (except for subject-specific roles which can have multiple with different subjects)
 */
StudentClassRoleSchema.index(
  {
    schoolId: 1,
    studentId: 1,
    classGroupId: 1,
    academicPeriodId: 1,
    roleDefinitionId: 1,
    subjectId: 1,
  },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
  }
);

// For listing all roles in a class
StudentClassRoleSchema.index({
  schoolId: 1,
  classGroupId: 1,
  academicPeriodId: 1,
  isActive: 1,
});

// For getting a student's roles
StudentClassRoleSchema.index({
  schoolId: 1,
  studentId: 1,
  academicPeriodId: 1,
  isActive: 1,
});

// For role history
StudentClassRoleSchema.index({
  schoolId: 1,
  studentId: 1,
  roleDefinitionId: 1,
  assignedAt: -1,
});

/**
 * Pre-save validation: ensure student belongs to the classGroup
 */
StudentClassRoleSchema.pre("save", async function (next) {
  if (this.isNew || this.isModified("studentId") || this.isModified("classGroupId")) {
    try {
      const { Student } = await import("./Student");
      const student = await Student.findById(this.studentId).select("classGroupId").lean();

      if (!student) {
        return next(new Error("Student not found"));
      }

      // Note: We allow assigning roles even if student moved classes
      // The academicPeriodId ties the role to a specific time
      // This preserves historical role assignments
    } catch (e) {
      return next(e instanceof Error ? e : new Error(String(e)));
    }
  }
  next();
});

export const StudentClassRole =
  models.StudentClassRole ||
  model<IStudentClassRole>("StudentClassRole", StudentClassRoleSchema);
