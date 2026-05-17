import { Schema, model, models, type Model, type Types } from "mongoose";

export const IMPLEMENTATION_PHASES = [
  "school_profile",
  "academic_setup",
  "people_setup",
  "finance_setup",
  "communications_setup",
  "go_live",
] as const;

export const IMPLEMENTATION_CHECKLIST_STATUSES = [
  "pending",
  "in_progress",
  "blocked",
  "done",
  "skipped",
  "not_applicable",
] as const;

export type ImplementationPhase = (typeof IMPLEMENTATION_PHASES)[number];
export type ImplementationChecklistStatus = (typeof IMPLEMENTATION_CHECKLIST_STATUSES)[number];
export type ImplementationCriticality = "low" | "medium" | "high" | "critical";

const DEFAULT_IMPLEMENTATION_CHECKLIST: Array<{
  key: string;
  label: string;
  phase: ImplementationPhase;
  description: string;
  requiredForGoLive: boolean;
  criticality: ImplementationCriticality;
}> = [];

export const SCHOOL_IMPLEMENTATION_STATUSES = [
  "not_started",
  "in_progress",
  "blocked",
  "ready_for_review",
  "ready_for_go_live",
  "live",
  "paused",
  "cancelled",
  /** @deprecated Use `live` — kept for existing records */
  "completed",
] as const;

export type SchoolImplementationStatus = (typeof SCHOOL_IMPLEMENTATION_STATUSES)[number];

/** @deprecated Use DEFAULT_IMPLEMENTATION_CHECKLIST from implementation-checklist */
export const DEFAULT_IMPLEMENTATION_CHECKLIST_LEGACY = DEFAULT_IMPLEMENTATION_CHECKLIST.map((item) => ({
  key: item.key,
  label: item.label,
}));

export interface IImplementationChecklistItem {
  key: string;
  label: string;
  phase?: ImplementationPhase;
  description?: string;
  status: ImplementationChecklistStatus;
  requiredForGoLive?: boolean;
  criticality?: ImplementationCriticality;
  setupHref?: string;
  assignedToUserId?: Types.ObjectId | null;
  assignedTaskId?: Types.ObjectId | null;
  blockerReason?: string;
  blockerNotes?: string;
  skippedReason?: string;
  notApplicableReason?: string;
  startedAt?: Date | null;
  completedAt?: Date | null;
  completedByUserId?: Types.ObjectId | null;
  lastUpdatedAt?: Date | null;
  lastUpdatedByUserId?: Types.ObjectId | null;
  notes?: Array<{
    body: string;
    createdByUserId: Types.ObjectId;
    createdAt: Date;
  }>;
}

export interface ISchoolImplementationProject {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  status: SchoolImplementationStatus;
  assignedOwnerUserId?: Types.ObjectId | null;
  startDate?: Date | null;
  targetGoLiveDate?: Date | null;
  actualGoLiveDate?: Date | null;
  completedAt?: Date | null;
  readinessScore?: number | null;
  lastReadinessCheckAt?: Date | null;
  blockerSummary?: {
    totalBlocked: number;
    criticalBlocked: number;
    lastBlockedAt?: Date | null;
  };
  checklist: IImplementationChecklistItem[];
  createdAt: Date;
  updatedAt: Date;
}

const ChecklistItemSchema = new Schema<IImplementationChecklistItem>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true, trim: true },
    phase: { type: String, enum: IMPLEMENTATION_PHASES, default: "school_profile" },
    description: { type: String, trim: true, maxlength: 500, default: null },
    status: {
      type: String,
      enum: IMPLEMENTATION_CHECKLIST_STATUSES,
      default: "pending",
    },
    requiredForGoLive: { type: Boolean, default: true },
    criticality: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    setupHref: { type: String, trim: true, maxlength: 500, default: null },
    assignedToUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    assignedTaskId: { type: Schema.Types.ObjectId, ref: "PlatformTask", default: null },
    blockerReason: { type: String, trim: true, maxlength: 500, default: null },
    blockerNotes: { type: String, trim: true, maxlength: 2000, default: null },
    skippedReason: { type: String, trim: true, maxlength: 500, default: null },
    notApplicableReason: { type: String, trim: true, maxlength: 500, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    completedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    lastUpdatedAt: { type: Date, default: null },
    lastUpdatedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    notes: {
      type: [
        {
          body: { type: String, required: true, trim: true, maxlength: 2000 },
          createdByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { _id: false },
);

const SchoolImplementationProjectSchema = new Schema<ISchoolImplementationProject>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, unique: true, index: true },
    status: { type: String, enum: SCHOOL_IMPLEMENTATION_STATUSES, default: "not_started", index: true },
    assignedOwnerUserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    startDate: { type: Date, default: null },
    targetGoLiveDate: { type: Date, default: null, index: true },
    actualGoLiveDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    readinessScore: { type: Number, min: 0, max: 100, default: null },
    lastReadinessCheckAt: { type: Date, default: null },
    blockerSummary: {
      totalBlocked: { type: Number, default: 0 },
      criticalBlocked: { type: Number, default: 0 },
      lastBlockedAt: { type: Date, default: null },
    },
    checklist: {
      type: [ChecklistItemSchema],
      default: () =>
        DEFAULT_IMPLEMENTATION_CHECKLIST.map((item) => ({
          key: item.key,
          label: item.label,
          phase: item.phase,
          description: item.description,
          status: "pending",
          requiredForGoLive: item.requiredForGoLive,
          criticality: item.criticality,
        })),
    },
  },
  { timestamps: true },
);

SchoolImplementationProjectSchema.index({ status: 1, targetGoLiveDate: 1 });

export const SchoolImplementationProject: Model<ISchoolImplementationProject> =
  (models.SchoolImplementationProject as Model<ISchoolImplementationProject>) ||
  model<ISchoolImplementationProject>("SchoolImplementationProject", SchoolImplementationProjectSchema);
