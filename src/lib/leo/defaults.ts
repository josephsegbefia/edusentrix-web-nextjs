import type { SchoolLeoSettingsDTO } from "@/lib/leo/types";

export const DEFAULT_SCHOOL_LEO_SETTINGS: SchoolLeoSettingsDTO = {
  accessOverride: "inherit",
  entitlementBypass: false,
  roleOverrides: {
    school_admin: "inherit",
    teacher: "inherit",
    parent: "inherit",
    student: "inherit",
    bursar: "inherit",
    billing_owner: "inherit",
  },
  allowWriteActions: false,
  allowBulkActions: false,
  allowDrafting: true,
  allowMonitors: false,
  retentionDays: 90,
  defaultModelProfile: "balanced",
  privacyMode: "balanced",
  ui: {
    floatingPaneEnabled: true,
    homeSummaryCardsEnabled: false,
  },
};

export function mergeSchoolLeo(
  doc: Record<string, unknown> | null | undefined
): SchoolLeoSettingsDTO {
  if (!doc || typeof doc !== "object") {
    return { ...DEFAULT_SCHOOL_LEO_SETTINGS };
  }
  return {
    ...DEFAULT_SCHOOL_LEO_SETTINGS,
    ...doc,
    roleOverrides: {
      ...DEFAULT_SCHOOL_LEO_SETTINGS.roleOverrides,
      ...(doc.roleOverrides as SchoolLeoSettingsDTO["roleOverrides"]),
    },
    ui: {
      ...DEFAULT_SCHOOL_LEO_SETTINGS.ui!,
      ...(doc.ui as SchoolLeoSettingsDTO["ui"]),
    },
  };
}
