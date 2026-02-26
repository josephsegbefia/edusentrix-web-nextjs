// src/models/ClassRoleDefinition.ts
import { Schema, model, models, Types } from "mongoose";

/**
 * Role categories for organization
 */
export type ClassRoleCategory =
  | "leadership" // Class Captain, Assistant
  | "academic" // Subject Rep, Homework Monitor
  | "service" // Cleanliness, Environment
  | "social" // Welfare, Entertainment
  | "custom"; // School-defined roles

/**
 * Default system-provided class roles
 * These are seeded for all schools but can be disabled
 */
export const DEFAULT_CLASS_ROLES = [
  // Leadership
  {
    name: "Class Captain",
    code: "CLASS_CAPTAIN",
    category: "leadership" as ClassRoleCategory,
    description: "Primary student leader, liaises between class and teachers",
    maxPerClass: 1,
    isDefault: true,
  },
  {
    name: "Assistant Class Captain",
    code: "ASST_CLASS_CAPTAIN",
    category: "leadership" as ClassRoleCategory,
    description: "Supports captain, acts in their absence",
    maxPerClass: 1,
    isDefault: true,
  },
  // Academic
  {
    name: "Subject Representative",
    code: "SUBJECT_REP",
    category: "academic" as ClassRoleCategory,
    description: "Collects/submits assignments for a specific subject",
    maxPerClass: null, // Multiple allowed (one per subject)
    isDefault: true,
  },
  {
    name: "Homework Monitor",
    code: "HOMEWORK_MONITOR",
    category: "academic" as ClassRoleCategory,
    description: "Tracks homework completion, reminds classmates",
    maxPerClass: 2,
    isDefault: true,
  },
  {
    name: "Class Library Prefect",
    code: "CLASS_LIBRARY_PREFECT",
    category: "academic" as ClassRoleCategory,
    description: "Manages class library corner, book returns, and reading order",
    maxPerClass: 2,
    isDefault: true,
  },
  {
    name: "Cupboard Steward",
    code: "CUPBOARD_STEWARD",
    category: "service" as ClassRoleCategory,
    description: "Oversees classroom cupboard materials and supplies",
    maxPerClass: 2,
    isDefault: true,
  },
  // Service
  {
    name: "Attendance Monitor",
    code: "ATTENDANCE_MONITOR",
    category: "service" as ClassRoleCategory,
    description: "Helps take daily attendance",
    maxPerClass: 2,
    isDefault: true,
  },
  {
    name: "Time Keeper",
    code: "TIME_KEEPER",
    category: "service" as ClassRoleCategory,
    description: "Signals class transitions, manages schedule",
    maxPerClass: 1,
    isDefault: true,
  },
  {
    name: "Cleanliness Captain",
    code: "CLEANLINESS_CAPTAIN",
    category: "service" as ClassRoleCategory,
    description: "Oversees classroom cleanliness",
    maxPerClass: 2,
    isDefault: true,
  },
  {
    name: "Notice Board Monitor",
    code: "NOTICE_BOARD_MONITOR",
    category: "service" as ClassRoleCategory,
    description: "Updates class announcements",
    maxPerClass: 1,
    isDefault: true,
  },
  // Social/Welfare
  {
    name: "Welfare Officer",
    code: "WELFARE_OFFICER",
    category: "social" as ClassRoleCategory,
    description: "Checks on absent students, reports concerns",
    maxPerClass: 2,
    isDefault: true,
  },
  {
    name: "Sports Captain",
    code: "SPORTS_CAPTAIN",
    category: "social" as ClassRoleCategory,
    description: "Organizes class sports activities",
    maxPerClass: 2,
    isDefault: true,
  },
  {
    name: "Entertainment Captain",
    code: "ENTERTAINMENT_CAPTAIN",
    category: "social" as ClassRoleCategory,
    description: "Plans class events, celebrations",
    maxPerClass: 2,
    isDefault: true,
  },
] as const;

/**
 * Class Role Definition
 * Defines what roles are available for students within classes
 * Can be system defaults or school-custom
 */
export interface IClassRoleDefinition {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  name: string;
  code: string; // Unique identifier like "CLASS_CAPTAIN"
  category: ClassRoleCategory;
  description?: string;
  maxPerClass?: number | null; // null = unlimited
  isDefault: boolean; // System-provided vs school-created
  isActive: boolean;
  order?: number; // For display ordering
  createdAt: Date;
  updatedAt: Date;
}

const ClassRoleDefinitionSchema = new Schema<IClassRoleDefinition>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 50,
    },
    category: {
      type: String,
      enum: ["leadership", "academic", "service", "social", "custom"],
      required: true,
      default: "custom",
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    maxPerClass: {
      type: Number,
      min: 1,
      default: null, // null means unlimited
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Unique role code per school
ClassRoleDefinitionSchema.index(
  { schoolId: 1, code: 1 },
  { unique: true }
);

// For listing active roles by category
ClassRoleDefinitionSchema.index(
  { schoolId: 1, isActive: 1, category: 1, order: 1 }
);

export const ClassRoleDefinition =
  models.ClassRoleDefinition ||
  model<IClassRoleDefinition>("ClassRoleDefinition", ClassRoleDefinitionSchema);
