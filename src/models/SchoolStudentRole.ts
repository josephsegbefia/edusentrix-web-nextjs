// src/models/SchoolStudentRole.ts
/**
 * School-wide student roles (Head Boy/Girl, School Prefect, etc.)
 * These are distinct from class-level roles and apply to the entire school.
 */
import mongoose, { Schema, model, models, Types } from "mongoose";

export type SchoolRoleCategory =
  | "prefect"      // Head Boy/Girl, Senior/Junior Prefects
  | "council"      // Student council positions
  | "club"         // Club leaders (Science Club President, etc.)
  | "sports"       // Sports Captain, House Captain
  | "cultural"     // Cultural/Arts leaders
  | "service"      // Community service leaders
  | "custom";

export interface ISchoolRoleDefinition {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;

  name: string;                      // e.g., "Head Boy", "School Prefect"
  code: string;                      // e.g., "HEAD_BOY", "PREFECT"
  category: SchoolRoleCategory;
  description?: string;

  // Constraints
  maxPerSchool?: number;             // e.g., 1 for Head Boy
  eligibleGrades?: Types.ObjectId[]; // Which grades can hold this role

  // Display
  badgeColor?: string;               // For UI display
  icon?: string;                     // Icon name
  order: number;                     // Display order

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISchoolStudentRole {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;

  studentId: Types.ObjectId;
  roleDefinitionId: Types.ObjectId;  // Reference to SchoolRoleDefinition
  academicPeriodId: Types.ObjectId;

  // Optional house/team assignment for sports roles
  houseId?: Types.ObjectId;

  // Assignment details
  assignedAt: Date;
  assignedBy?: Types.ObjectId;       // Admin who assigned
  startDate: Date;
  endDate?: Date;                    // When role ends (term end, etc.)

  notes?: string;
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

// Schema for role definitions
const SchoolRoleDefinitionSchema = new Schema<ISchoolRoleDefinition>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    name: { type: String, required: true },
    code: { type: String, required: true },
    category: {
      type: String,
      enum: ["prefect", "council", "club", "sports", "cultural", "service", "custom"],
      default: "prefect",
    },
    description: { type: String },
    maxPerSchool: { type: Number },
    eligibleGrades: [{ type: Schema.Types.ObjectId, ref: "Grade" }],
    badgeColor: { type: String },
    icon: { type: String },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

SchoolRoleDefinitionSchema.index({ schoolId: 1, code: 1 }, { unique: true });
SchoolRoleDefinitionSchema.index({ schoolId: 1, category: 1, order: 1 });

// Schema for role assignments
const SchoolStudentRoleSchema = new Schema<ISchoolStudentRole>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    roleDefinitionId: { type: Schema.Types.ObjectId, ref: "SchoolRoleDefinition", required: true },
    academicPeriodId: { type: Schema.Types.ObjectId, ref: "AcademicPeriod", required: true },
    houseId: { type: Schema.Types.ObjectId, ref: "House" },
    assignedAt: { type: Date, default: Date.now },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User" },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    notes: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
SchoolStudentRoleSchema.index({ schoolId: 1, academicPeriodId: 1, isActive: 1 });
SchoolStudentRoleSchema.index({ studentId: 1, academicPeriodId: 1 });
SchoolStudentRoleSchema.index({ roleDefinitionId: 1, academicPeriodId: 1, isActive: 1 });

// Default school-wide roles to seed
export const DEFAULT_SCHOOL_ROLES: Array<{
  name: string;
  code: string;
  category: SchoolRoleCategory;
  description: string;
  maxPerSchool?: number;
  badgeColor: string;
}> = [
  // Prefect roles
  {
    name: "Head Boy",
    code: "HEAD_BOY",
    category: "prefect",
    description: "Male student leader of the school",
    maxPerSchool: 1,
    badgeColor: "#FFD700", // Gold
  },
  {
    name: "Head Girl",
    code: "HEAD_GIRL",
    category: "prefect",
    description: "Female student leader of the school",
    maxPerSchool: 1,
    badgeColor: "#FFD700", // Gold
  },
  {
    name: "Senior Prefect (Boys)",
    code: "SENIOR_PREFECT_BOY",
    category: "prefect",
    description: "Senior male prefect",
    maxPerSchool: 2,
    badgeColor: "#C0C0C0", // Silver
  },
  {
    name: "Senior Prefect (Girls)",
    code: "SENIOR_PREFECT_GIRL",
    category: "prefect",
    description: "Senior female prefect",
    maxPerSchool: 2,
    badgeColor: "#C0C0C0", // Silver
  },
  {
    name: "School Prefect",
    code: "SCHOOL_PREFECT",
    category: "prefect",
    description: "General school prefect",
    badgeColor: "#CD7F32", // Bronze
  },
  {
    name: "Dining Hall Prefect",
    code: "DINING_PREFECT",
    category: "prefect",
    description: "Oversees dining hall activities",
    maxPerSchool: 4,
    badgeColor: "#8B4513",
  },
  {
    name: "Compound Prefect",
    code: "COMPOUND_PREFECT",
    category: "prefect",
    description: "Oversees school compound cleanliness",
    maxPerSchool: 4,
    badgeColor: "#228B22",
  },

  // Sports roles
  {
    name: "Sports Captain",
    code: "SPORTS_CAPTAIN",
    category: "sports",
    description: "Overall sports leader",
    maxPerSchool: 2,
    badgeColor: "#FF4500",
  },
  {
    name: "House Captain",
    code: "HOUSE_CAPTAIN",
    category: "sports",
    description: "Leader of a school house",
    badgeColor: "#4169E1",
  },

  // Cultural roles
  {
    name: "Entertainment Prefect",
    code: "ENTERTAINMENT_PREFECT",
    category: "cultural",
    description: "Coordinates entertainment and cultural activities",
    maxPerSchool: 2,
    badgeColor: "#9932CC",
  },
  {
    name: "Chapel/Mosque Prefect",
    code: "RELIGIOUS_PREFECT",
    category: "cultural",
    description: "Coordinates religious activities",
    maxPerSchool: 2,
    badgeColor: "#2F4F4F",
  },

  // Club roles
  {
    name: "Science Club President",
    code: "SCIENCE_CLUB_PRES",
    category: "club",
    description: "Leader of the Science Club",
    maxPerSchool: 1,
    badgeColor: "#00CED1",
  },
  {
    name: "Debate Club President",
    code: "DEBATE_CLUB_PRES",
    category: "club",
    description: "Leader of the Debate Club",
    maxPerSchool: 1,
    badgeColor: "#DC143C",
  },
];

export const SchoolRoleDefinition =
  models.SchoolRoleDefinition ||
  model<ISchoolRoleDefinition>("SchoolRoleDefinition", SchoolRoleDefinitionSchema);

export const SchoolStudentRole =
  models.SchoolStudentRole ||
  model<ISchoolStudentRole>("SchoolStudentRole", SchoolStudentRoleSchema);
