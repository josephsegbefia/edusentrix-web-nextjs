import type { IInternalTestSchoolConfig } from "@/models/InternalTestSchoolConfig";
import type { Types } from "mongoose";

export function buildDefaultInternalTestSchoolConfig(
  schoolId: Types.ObjectId,
  updatedBy: Types.ObjectId | null
): Omit<IInternalTestSchoolConfig, "_id" | "createdAt" | "updatedAt"> {
  return {
    schoolId,
    suppressEmailInvitations: true,
    autoActivateCreatedUsers: true,
    markEmailsAsVerified: true,
    suppressSms: true,
    suppressWhatsapp: true,
    suppressPushNotifications: true,
    suppressParentNotifications: true,
    useSandboxPayments: true,
    disableRealPaymentCollection: true,
    allowImpersonation: true,
    showInternalTestBadge: true,
    allowSeedGeneration: false,
    allowResetGeneratedData: false,
    updatedBy,
  };
}
