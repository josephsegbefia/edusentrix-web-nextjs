// src/models/AdmissionInviteLink.ts
// Per-recipient short link used for the Direct invite, QR, and WhatsApp channels.
// See docs/ADMISSIONS_DEVELOPMENT_SPEC.md §3.6.

import { Schema, model, models, Types, type Model } from "mongoose";
import type { AdmissionChannel } from "@/lib/admissions/types";

const INVITE_CHANNELS: AdmissionChannel[] = [
  "direct_invite",
  "qr",
  "whatsapp",
];

export interface IAdmissionInviteLink {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  cycleId: Types.ObjectId;
  code: string;
  label: string;
  channel: AdmissionChannel;
  targetEmail?: string | null;
  targetPhone?: string | null;
  expiresAt?: Date | null;
  usageCount: number;
  submissionCount: number;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const inviteLinkSchema = new Schema<IAdmissionInviteLink>(
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
    code: { type: String, required: true, uppercase: true },
    label: { type: String, required: true, trim: true },
    channel: {
      type: String,
      enum: INVITE_CHANNELS,
      default: "direct_invite",
    },
    targetEmail: { type: String, default: null, lowercase: true, trim: true },
    targetPhone: { type: String, default: null, trim: true },
    expiresAt: { type: Date, default: null },
    usageCount: { type: Number, default: 0 },
    submissionCount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

inviteLinkSchema.index({ schoolId: 1, code: 1 }, { unique: true });
inviteLinkSchema.index({ cycleId: 1, channel: 1 });

export const AdmissionInviteLink: Model<IAdmissionInviteLink> =
  (models.AdmissionInviteLink as Model<IAdmissionInviteLink>) ||
  model<IAdmissionInviteLink>("AdmissionInviteLink", inviteLinkSchema);
