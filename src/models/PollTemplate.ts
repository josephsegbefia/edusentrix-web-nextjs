// src/models/PollTemplate.ts
/**
 * Poll templates for quick poll creation.
 * Templates can be platform-wide (schoolId = null) or school-specific.
 * Provides pre-configured questions, settings, and defaults for common poll types.
 */
import mongoose, { Schema, Types } from "mongoose";
import type { PollQuestionType, AudienceScope, RevealResults } from "./CommunityPoll";

// ============================================================================
// Types
// ============================================================================

export type TemplateCategory =
  | "wellbeing"
  | "academic"
  | "decision"
  | "parent"
  | "quick"
  | "election"
  | "feedback"
  | "administrative";

export type TemplateAudienceType =
  | "students"
  | "parents"
  | "teachers"
  | "staff"
  | "students_and_parents"
  | "all";

// ============================================================================
// Embedded Subdocument Interfaces
// ============================================================================

export interface ITemplateOption {
  label: string;
  imageUrl?: string | null;
  order: number;
}

export interface ITemplateQuestion {
  prompt: string;
  description?: string;
  type: PollQuestionType;
  options?: ITemplateOption[];
  required: boolean;
  allowOther: boolean;
  order: number;
}

export interface ITemplateDefaults {
  durationDays: number;
  anonymity: "anonymous" | "identified" | "admin_only";
  revealResults: RevealResults;
  allowComments: boolean;
  minResponseRate: number; // Percentage (0-100)
  audienceScope: AudienceScope;
  audienceType: TemplateAudienceType;
  requiresApproval: boolean;
}

// ============================================================================
// Main Interface
// ============================================================================

export interface IPollTemplate {
  _id: Types.ObjectId;
  
  // Scope: null = platform-wide, otherwise school-specific
  schoolId: Types.ObjectId | null;
  
  // Basic info
  name: string;
  description: string;
  category: TemplateCategory;
  icon?: string; // Icon name for UI (e.g., "heart", "book", "vote")
  color?: string; // Accent color for UI (e.g., "emerald", "violet")
  
  // Template questions (can be customized when creating poll)
  questions: ITemplateQuestion[];
  
  // Default settings (applied when creating poll from template)
  defaults: ITemplateDefaults;
  
  // Metadata
  isActive: boolean;
  isPlatformDefault: boolean; // True for built-in templates
  usageCount: number; // How many polls created from this template
  
  // Creator (null for platform defaults)
  createdBy?: Types.ObjectId | null;
  
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Schemas
// ============================================================================

const TemplateOptionSchema = new Schema<ITemplateOption>(
  {
    label: { type: String, required: true, maxlength: 200 },
    imageUrl: { type: String, default: null },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const TemplateQuestionSchema = new Schema<ITemplateQuestion>(
  {
    prompt: { type: String, required: true, maxlength: 500 },
    description: { type: String, maxlength: 1000 },
    type: {
      type: String,
      enum: ["single_choice", "multi_choice", "ranked_choice", "likert", "yes_no", "comment"],
      required: true,
    },
    options: [TemplateOptionSchema],
    required: { type: Boolean, default: true },
    allowOther: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const TemplateDefaultsSchema = new Schema<ITemplateDefaults>(
  {
    durationDays: { type: Number, default: 7 },
    anonymity: {
      type: String,
      enum: ["anonymous", "identified", "admin_only"],
      default: "anonymous",
    },
    revealResults: {
      type: String,
      enum: ["live", "after_close", "admin_only"],
      default: "after_close",
    },
    allowComments: { type: Boolean, default: false },
    minResponseRate: { type: Number, default: 60, min: 0, max: 100 },
    audienceScope: {
      type: String,
      enum: ["school", "grade", "class", "staff", "parents", "students"],
      default: "class",
    },
    audienceType: {
      type: String,
      enum: ["students", "parents", "teachers", "staff", "students_and_parents", "all"],
      default: "students",
    },
    requiresApproval: { type: Boolean, default: true },
  },
  { _id: false }
);

const PollTemplateSchema = new Schema<IPollTemplate>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", default: null, index: true },
    
    // Basic info
    name: { type: String, required: true, maxlength: 100 },
    description: { type: String, required: true, maxlength: 500 },
    category: {
      type: String,
      enum: ["wellbeing", "academic", "decision", "parent", "quick", "election", "feedback", "administrative"],
      required: true,
    },
    icon: { type: String, default: "vote" },
    color: { type: String, default: "violet" },
    
    // Template content
    questions: [TemplateQuestionSchema],
    defaults: { type: TemplateDefaultsSchema, default: () => ({}) },
    
    // Metadata
    isActive: { type: Boolean, default: true },
    isPlatformDefault: { type: Boolean, default: false },
    usageCount: { type: Number, default: 0 },
    
    // Creator
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

// ============================================================================
// Indexes
// ============================================================================

// List templates for a school (includes platform-wide templates)
PollTemplateSchema.index({ schoolId: 1, isActive: 1, category: 1 });

// Platform-wide templates
PollTemplateSchema.index({ schoolId: 1, isPlatformDefault: 1 });

// Popular templates
PollTemplateSchema.index({ usageCount: -1 });

// ============================================================================
// Export Model
// ============================================================================

export const PollTemplate =
  (mongoose.models.PollTemplate as mongoose.Model<IPollTemplate>) ||
  mongoose.model<IPollTemplate>("PollTemplate", PollTemplateSchema);
