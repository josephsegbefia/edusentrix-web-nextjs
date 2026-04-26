// src/models/AdmissionApplication.ts
// A submitted admission application. Distinct from `Application` (which is the
// platform-level "school requests EduSentrix" model).
// See docs/ADMISSIONS_DEVELOPMENT_SPEC.md §3.4.

import { Schema, model, models, Types, type Model } from "mongoose";
import type {
  AdmissionApplicationStatus,
  AdmissionChannel,
  AdmissionFeeStatus,
} from "@/lib/admissions/types";

const APPLICATION_STATUSES: AdmissionApplicationStatus[] = [
  "submitted",
  "under_review",
  "interview_scheduled",
  "accepted",
  "rejected",
  "waitlisted",
  "withdrawn",
  "expired",
];

const CHANNELS: AdmissionChannel[] = [
  "public_link",
  "embed",
  "qr",
  "direct_invite",
  "whatsapp",
  "internal",
];

const FEE_STATUSES: AdmissionFeeStatus[] = [
  "not_required",
  "pending",
  "paid",
  "waived",
];

export interface IAdmissionApplicationApplicant {
  firstName: string;
  lastName: string;
  sex?: "male" | "female" | null;
  dateOfBirth?: Date | null;
  intendedGradeId?: Types.ObjectId | null;
  photoUrl?: string | null;
  address?: string | null;
}

export interface IAdmissionApplicationGuardian {
  firstName: string;
  lastName: string;
  relationship?: string | null;
  email: string;
  phone?: string | null;
  address?: string | null;
  occupation?: string | null;
}

export interface IAdmissionApplicationDocument {
  requirementId: string;
  label: string;
  fileUrl: string;
  fileName?: string;
  sizeBytes?: number;
  mimeType?: string;
  uploadedAt: Date;
}

export interface IAdmissionApplicationDecision {
  outcome: "accepted" | "rejected" | "waitlisted";
  decidedBy: Types.ObjectId;
  decidedAt: Date;
  targetGradeId?: Types.ObjectId | null;
  targetClassGroupId?: Types.ObjectId | null;
  notes?: string | null;
}

export interface IAdmissionApplicationProvisioned {
  studentId: Types.ObjectId;
  guardianId: Types.ObjectId;
  parentUserId: Types.ObjectId;
  provisionedAt: Date;
}

export interface IAdmissionApplicationTracker {
  token: string;
  lastViewedAt?: Date | null;
  lastViewedIp?: string | null;
}

export interface IAdmissionApplicationFeePayment {
  /** Paystack reference (idempotency key — unique per application). */
  reference: string;
  amountMinor: number;
  currency: string;
  initiatedAt: Date;
  paidAt?: Date | null;
  failedAt?: Date | null;
  channel?: string | null;
  /** Verbatim payload echoed by Paystack for the audit trail (small subset). */
  paystackMeta?: Record<string, unknown> | null;
}

export interface IAdmissionApplication {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  cycleId: Types.ObjectId;
  formVersion: number;
  referenceCode: string;
  submittedAt?: Date | null;
  channel: AdmissionChannel;
  referrer?: string | null;
  inviteCode?: string | null;
  applicant: IAdmissionApplicationApplicant;
  guardian: IAdmissionApplicationGuardian;
  additional: Map<string, unknown> | Record<string, unknown>;
  documents: IAdmissionApplicationDocument[];
  status: AdmissionApplicationStatus;
  decision?: IAdmissionApplicationDecision | null;
  provisioned?: IAdmissionApplicationProvisioned | null;
  tracker: IAdmissionApplicationTracker;
  assignedReviewerId?: Types.ObjectId | null;
  feeStatus: AdmissionFeeStatus;
  feePayment?: IAdmissionApplicationFeePayment | null;
  notesPrivate?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<IAdmissionApplicationDocument>(
  {
    requirementId: { type: String, required: true },
    label: { type: String, required: true },
    fileUrl: { type: String, required: true },
    fileName: { type: String, default: undefined },
    sizeBytes: { type: Number, default: undefined },
    mimeType: { type: String, default: undefined },
    uploadedAt: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const applicantSchema = new Schema<IAdmissionApplicationApplicant>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    sex: { type: String, enum: ["male", "female", null], default: null },
    dateOfBirth: { type: Date, default: null },
    intendedGradeId: {
      type: Schema.Types.ObjectId,
      ref: "Grade",
      default: null,
    },
    photoUrl: { type: String, default: null },
    address: { type: String, default: null },
  },
  { _id: false }
);

const guardianSchema = new Schema<IAdmissionApplicationGuardian>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    relationship: { type: String, default: null },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: null },
    address: { type: String, default: null },
    occupation: { type: String, default: null },
  },
  { _id: false }
);

const decisionSchema = new Schema<IAdmissionApplicationDecision>(
  {
    outcome: {
      type: String,
      enum: ["accepted", "rejected", "waitlisted"],
      required: true,
    },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    decidedAt: { type: Date, required: true },
    targetGradeId: { type: Schema.Types.ObjectId, ref: "Grade", default: null },
    targetClassGroupId: {
      type: Schema.Types.ObjectId,
      ref: "ClassGroup",
      default: null,
    },
    notes: { type: String, default: null },
  },
  { _id: false }
);

const provisionedSchema = new Schema<IAdmissionApplicationProvisioned>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    guardianId: {
      type: Schema.Types.ObjectId,
      ref: "Guardian",
      required: true,
    },
    parentUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    provisionedAt: { type: Date, required: true },
  },
  { _id: false }
);

const trackerSchema = new Schema<IAdmissionApplicationTracker>(
  {
    token: { type: String, required: true },
    lastViewedAt: { type: Date, default: null },
    lastViewedIp: { type: String, default: null },
  },
  { _id: false }
);

const feePaymentSchema = new Schema<IAdmissionApplicationFeePayment>(
  {
    reference: { type: String, required: true },
    amountMinor: { type: Number, required: true },
    currency: { type: String, required: true },
    initiatedAt: { type: Date, required: true },
    paidAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    channel: { type: String, default: null },
    paystackMeta: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const admissionApplicationSchema = new Schema<IAdmissionApplication>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    cycleId: {
      type: Schema.Types.ObjectId,
      ref: "AdmissionCycle",
      required: true,
      index: true,
    },
    formVersion: { type: Number, required: true, default: 1 },
    referenceCode: { type: String, required: true, uppercase: true },
    submittedAt: { type: Date, default: null },
    channel: { type: String, enum: CHANNELS, default: "public_link" },
    referrer: { type: String, default: null },
    inviteCode: { type: String, default: null, index: true },
    applicant: { type: applicantSchema, required: true },
    guardian: { type: guardianSchema, required: true },
    additional: { type: Map, of: Schema.Types.Mixed, default: () => new Map() },
    documents: { type: [documentSchema], default: [] },
    status: {
      type: String,
      enum: APPLICATION_STATUSES,
      default: "submitted",
      index: true,
    },
    decision: { type: decisionSchema, default: null },
    provisioned: { type: provisionedSchema, default: null },
    tracker: { type: trackerSchema, required: true },
    assignedReviewerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    feeStatus: {
      type: String,
      enum: FEE_STATUSES,
      default: "not_required",
    },
    feePayment: { type: feePaymentSchema, default: null },
    notesPrivate: { type: String, default: null },
  },
  { timestamps: true }
);

admissionApplicationSchema.index(
  { schoolId: 1, referenceCode: 1 },
  { unique: true }
);
admissionApplicationSchema.index({ schoolId: 1, cycleId: 1, status: 1 });
admissionApplicationSchema.index({ schoolId: 1, cycleId: 1, createdAt: -1 });
admissionApplicationSchema.index({ "guardian.email": 1, schoolId: 1 });
admissionApplicationSchema.index({ "feePayment.reference": 1 }, { sparse: true });

export const AdmissionApplication: Model<IAdmissionApplication> =
  (models.AdmissionApplication as Model<IAdmissionApplication>) ||
  model<IAdmissionApplication>(
    "AdmissionApplication",
    admissionApplicationSchema
  );
