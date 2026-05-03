import { Schema, model, models, type Model, type Types } from "mongoose";

/** Row-normalized config for internal test schools (see internal-test-school-mode-final spec §6). */
export interface IInternalTestSchoolConfig {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;

  suppressEmailInvitations: boolean;
  autoActivateCreatedUsers: boolean;
  markEmailsAsVerified: boolean;

  suppressSms: boolean;
  suppressWhatsapp: boolean;
  suppressPushNotifications: boolean;
  suppressParentNotifications: boolean;

  useSandboxPayments: boolean;
  disableRealPaymentCollection: boolean;

  allowImpersonation: boolean;
  showInternalTestBadge: boolean;

  allowSeedGeneration: boolean;
  allowResetGeneratedData: boolean;

  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const internalTestSchoolConfigSchema = new Schema<IInternalTestSchoolConfig>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      unique: true,
      index: true,
    },
    suppressEmailInvitations: { type: Boolean, default: true },
    autoActivateCreatedUsers: { type: Boolean, default: true },
    markEmailsAsVerified: { type: Boolean, default: true },
    suppressSms: { type: Boolean, default: true },
    suppressWhatsapp: { type: Boolean, default: true },
    suppressPushNotifications: { type: Boolean, default: true },
    suppressParentNotifications: { type: Boolean, default: true },
    useSandboxPayments: { type: Boolean, default: true },
    disableRealPaymentCollection: { type: Boolean, default: true },
    allowImpersonation: { type: Boolean, default: true },
    showInternalTestBadge: { type: Boolean, default: true },
    allowSeedGeneration: { type: Boolean, default: true },
    allowResetGeneratedData: { type: Boolean, default: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export const InternalTestSchoolConfig: Model<IInternalTestSchoolConfig> =
  (models.InternalTestSchoolConfig as Model<IInternalTestSchoolConfig>) ||
  model<IInternalTestSchoolConfig>("InternalTestSchoolConfig", internalTestSchoolConfigSchema);
