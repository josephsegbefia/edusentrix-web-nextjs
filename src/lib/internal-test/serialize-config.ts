import type { IInternalTestSchoolConfig } from "@/models/InternalTestSchoolConfig";
import type { ISchool } from "@/models/School";

export type InternalTestSchoolConfigDTO = {
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
  updatedAt: string;
};

export type InternalTestSchoolSummaryDTO = {
  id: string;
  name: string;
  isInternalTestSchool: boolean;
  environmentType: string;
  internalTest: {
    enabled: boolean;
    enabledAt: string | null;
    enabledBy: string | null;
    disabledAt: string | null;
    disabledBy: string | null;
    mode: "manual" | "seeded" | "manual_and_seeded" | null;
    visibleBadgeEnabled: boolean;
    notes: string | null;
  } | null;
};

export function serializeInternalTestSchoolSummary(school: ISchool): InternalTestSchoolSummaryDTO {
  const it = school.internalTest;
  return {
    id: String(school._id),
    name: school.name,
    isInternalTestSchool: Boolean(school.isInternalTestSchool),
    environmentType: school.environmentType ?? "production",
    internalTest: it
      ? {
          enabled: Boolean(it.enabled),
          enabledAt: it.enabledAt ? new Date(it.enabledAt).toISOString() : null,
          enabledBy: it.enabledBy ? String(it.enabledBy) : null,
          disabledAt: it.disabledAt ? new Date(it.disabledAt).toISOString() : null,
          disabledBy: it.disabledBy ? String(it.disabledBy) : null,
          mode: it.mode ?? null,
          visibleBadgeEnabled: Boolean(it.visibleBadgeEnabled),
          notes: it.notes ?? null,
        }
      : null,
  };
}

export function serializeInternalTestSchoolConfig(
  doc: IInternalTestSchoolConfig
): InternalTestSchoolConfigDTO {
  return {
    suppressEmailInvitations: doc.suppressEmailInvitations,
    autoActivateCreatedUsers: doc.autoActivateCreatedUsers,
    markEmailsAsVerified: doc.markEmailsAsVerified,
    suppressSms: doc.suppressSms,
    suppressWhatsapp: doc.suppressWhatsapp,
    suppressPushNotifications: doc.suppressPushNotifications,
    suppressParentNotifications: doc.suppressParentNotifications,
    useSandboxPayments: doc.useSandboxPayments,
    disableRealPaymentCollection: doc.disableRealPaymentCollection,
    allowImpersonation: doc.allowImpersonation,
    showInternalTestBadge: doc.showInternalTestBadge,
    allowSeedGeneration: doc.allowSeedGeneration,
    allowResetGeneratedData: doc.allowResetGeneratedData,
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}
