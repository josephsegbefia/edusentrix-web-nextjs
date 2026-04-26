// src/models/AdmissionEvent.ts
// Append-only timeline for admission applications and cycles.
// See docs/ADMISSIONS_DEVELOPMENT_SPEC.md §3.5.

import { Schema, model, models, Types, type Model } from "mongoose";

export type AdmissionEventKind =
  | "cycle.created"
  | "cycle.updated"
  | "cycle.published"
  | "cycle.paused"
  | "cycle.closed"
  | "cycle.delegate_assigned"
  | "cycle.delegate_revoked"
  | "form.updated"
  | "form.reset_to_defaults"
  | "application.submitted"
  | "application.viewed_by_admin"
  | "application.note_added"
  | "application.status_changed"
  | "application.decision_recorded"
  | "application.email_sent"
  | "application.provisioned"
  | "application.withdrawn"
  | "application.expired"
  | "application.fee_initiated"
  | "application.fee_paid"
  | "application.fee_waived"
  | "application.fee_failed";

const EVENT_KINDS: AdmissionEventKind[] = [
  "cycle.created",
  "cycle.updated",
  "cycle.published",
  "cycle.paused",
  "cycle.closed",
  "cycle.delegate_assigned",
  "cycle.delegate_revoked",
  "form.updated",
  "form.reset_to_defaults",
  "application.submitted",
  "application.viewed_by_admin",
  "application.note_added",
  "application.status_changed",
  "application.decision_recorded",
  "application.email_sent",
  "application.provisioned",
  "application.withdrawn",
  "application.expired",
  "application.fee_initiated",
  "application.fee_paid",
  "application.fee_waived",
  "application.fee_failed",
];

export interface IAdmissionEventActor {
  userId?: Types.ObjectId | null;
  role?: string | null;
  label: string;
}

export interface IAdmissionEvent {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  cycleId: Types.ObjectId;
  applicationId?: Types.ObjectId | null;
  actor: IAdmissionEventActor;
  kind: AdmissionEventKind;
  metadata?: Record<string, unknown>;
  at: Date;
}

const actorSchema = new Schema<IAdmissionEventActor>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    role: { type: String, default: null },
    label: { type: String, required: true },
  },
  { _id: false }
);

const admissionEventSchema = new Schema<IAdmissionEvent>(
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
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "AdmissionApplication",
      default: null,
      index: true,
    },
    actor: { type: actorSchema, required: true },
    kind: { type: String, enum: EVENT_KINDS, required: true, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    at: { type: Date, default: () => new Date(), index: true },
  },
  { timestamps: { createdAt: false, updatedAt: false } }
);

admissionEventSchema.index({ schoolId: 1, cycleId: 1, at: -1 });
admissionEventSchema.index({ applicationId: 1, at: -1 });

export const AdmissionEvent: Model<IAdmissionEvent> =
  (models.AdmissionEvent as Model<IAdmissionEvent>) ||
  model<IAdmissionEvent>("AdmissionEvent", admissionEventSchema);
