// src/models/AdmissionCycle.ts
// A "season" the school is admitting for. See docs/ADMISSIONS_DEVELOPMENT_SPEC.md §3.1.

import { Schema, model, models, Types, type Model } from "mongoose";
import type { AdmissionCycleStatus } from "@/lib/admissions/types";

const CYCLE_STATUSES: AdmissionCycleStatus[] = [
  "draft",
  "published",
  "paused",
  "closed",
  "archived",
];

export interface IAdmissionCycleApplicationFee {
  enabled: boolean;
  amountMinor: number;
  currency: string;
  mode: "manual_record" | "online_paystack";
  instructions?: string;
}

export interface IAdmissionCycleEmailTemplate {
  subject: string;
  htmlBody: string;
  /** Optional reply-to alias override; defaults to school inbound alias. */
  replyToAlias?: string | null;
}

export interface IAdmissionCycleBranding {
  heroImageUrl?: string | null;
  accentColor?: string | null;
  welcomeMessage?: string | null;
}

export interface IAdmissionCycleDelegate {
  userId: Types.ObjectId;
  teacherId?: Types.ObjectId | null;
  assignedAt: Date;
  assignedBy: Types.ObjectId;
}

export interface IAdmissionCycleAnalytics {
  totalSubmissions: number;
  byStatus: Record<string, number>;
  byChannel: Record<string, number>;
}

export interface IAdmissionCycle {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  name: string;
  slug: string;
  intakeGradeIds: Types.ObjectId[];
  targetAcademicPeriodId?: Types.ObjectId | null;
  applicationFee?: IAdmissionCycleApplicationFee | null;
  acceptsApplicationsFrom: Date;
  acceptsApplicationsUntil?: Date | null;
  decisionDueBy?: Date | null;
  status: AdmissionCycleStatus;
  formId?: Types.ObjectId | null;
  capacityByGradeId: Map<string, number> | Record<string, number>;
  waitlistEnabled: boolean;
  acceptanceTemplate: IAdmissionCycleEmailTemplate;
  rejectionTemplate: IAdmissionCycleEmailTemplate;
  branding?: IAdmissionCycleBranding;
  delegate?: IAdmissionCycleDelegate | null;
  analytics: IAdmissionCycleAnalytics;
  publishedAt?: Date | null;
  closedAt?: Date | null;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const applicationFeeSchema = new Schema<IAdmissionCycleApplicationFee>(
  {
    enabled: { type: Boolean, default: false },
    amountMinor: { type: Number, default: 0 },
    currency: { type: String, default: "GHS" },
    mode: {
      type: String,
      enum: ["manual_record", "online_paystack"],
      default: "manual_record",
    },
    instructions: { type: String, default: undefined },
  },
  { _id: false }
);

const emailTemplateSchema = new Schema<IAdmissionCycleEmailTemplate>(
  {
    subject: { type: String, required: true },
    htmlBody: { type: String, required: true },
    replyToAlias: { type: String, default: null },
  },
  { _id: false }
);

const brandingSchema = new Schema<IAdmissionCycleBranding>(
  {
    heroImageUrl: { type: String, default: null },
    accentColor: { type: String, default: null },
    welcomeMessage: { type: String, default: null },
  },
  { _id: false }
);

const delegateSchema = new Schema<IAdmissionCycleDelegate>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", default: null },
    assignedAt: { type: Date, required: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { _id: false }
);

const analyticsSchema = new Schema<IAdmissionCycleAnalytics>(
  {
    totalSubmissions: { type: Number, default: 0 },
    byStatus: { type: Schema.Types.Mixed, default: {} },
    byChannel: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const admissionCycleSchema = new Schema<IAdmissionCycle>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    intakeGradeIds: [{ type: Schema.Types.ObjectId, ref: "Grade" }],
    targetAcademicPeriodId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      default: null,
    },
    applicationFee: { type: applicationFeeSchema, default: null },
    acceptsApplicationsFrom: { type: Date, required: true },
    acceptsApplicationsUntil: { type: Date, default: null },
    decisionDueBy: { type: Date, default: null },
    status: {
      type: String,
      enum: CYCLE_STATUSES,
      default: "draft",
      index: true,
    },
    formId: {
      type: Schema.Types.ObjectId,
      ref: "AdmissionForm",
      default: null,
    },
    capacityByGradeId: {
      type: Map,
      of: Number,
      default: () => new Map<string, number>(),
    },
    waitlistEnabled: { type: Boolean, default: true },
    acceptanceTemplate: { type: emailTemplateSchema, required: true },
    rejectionTemplate: { type: emailTemplateSchema, required: true },
    branding: { type: brandingSchema, default: () => ({}) },
    delegate: { type: delegateSchema, default: null },
    analytics: { type: analyticsSchema, default: () => ({}) },
    publishedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

admissionCycleSchema.index({ schoolId: 1, slug: 1 }, { unique: true });
admissionCycleSchema.index({ schoolId: 1, status: 1, createdAt: -1 });

export const AdmissionCycle: Model<IAdmissionCycle> =
  (models.AdmissionCycle as Model<IAdmissionCycle>) ||
  model<IAdmissionCycle>("AdmissionCycle", admissionCycleSchema);
