export const LEO_FEATURE_FLAG_KEY = "leo_copilot";
export const LEO_ENTITLEMENT_KEY = "ai_leo_copilot" as const;

export type LeoDisabledReason =
  | "enabled"
  | "disabled_runtime"
  | "disabled_platform"
  | "disabled_plan"
  | "disabled_school"
  | "disabled_role";

export type SchoolLeoSettingsDTO = {
  accessOverride: "inherit" | "enabled" | "disabled";
  entitlementBypass: boolean;
  roleOverrides?: {
    school_admin?: "inherit" | "enabled" | "disabled";
    teacher?: "inherit" | "enabled" | "disabled";
    parent?: "inherit" | "enabled" | "disabled";
    student?: "inherit" | "enabled" | "disabled";
    bursar?: "inherit" | "enabled" | "disabled";
    billing_owner?: "inherit" | "enabled" | "disabled";
  };
  allowWriteActions: boolean;
  allowBulkActions: boolean;
  allowDrafting: boolean;
  allowMonitors: boolean;
  retentionDays: number;
  defaultModelProfile: "low_cost" | "balanced" | "high_quality";
  privacyMode: "strict" | "balanced";
  ui?: {
    floatingPaneEnabled: boolean;
    homeSummaryCardsEnabled: boolean;
  };
};

export type LeoAccessResolution = {
  /** True when the user may open the assistant (launcher + API). */
  effectiveEnabled: boolean;
  reason: LeoDisabledReason;
  /** User-facing or support-oriented code for the disabled state. */
  reasonDetail?: string;
  schoolLeo: SchoolLeoSettingsDTO;
  platform: {
    defaultState: "enabled" | "disabled";
    forcedMode: "none" | "force_enabled" | "force_disabled";
    allowSchoolOverride: boolean;
    allowSchoolSelfService: boolean;
  };
  entitlement: {
    hasAiLeoCopilot: boolean;
    bypass: boolean;
  };
};

export type LeoBootstrapDTO = {
  access: LeoAccessResolution;
  role: string;
  schoolId: string;
  version: 1;
};

export type LeoCitation = {
  type: "route" | "entity" | "report" | "record";
  label: string;
  ref: string;
};

export type LeoToolKey =
  | "setup_readiness_summary"
  | "teacher_assignment_conflicts"
  | "class_timetable_status"
  | "class_subject_teacher_links"
  | "teacher_week_summary"
  | "student_risk_summary"
  | "fees_overdue_summary"
  | "report_brief"
  | "settings_change_impact";

export type LeoAssistantDraft = {
  contentText: string;
  citations: LeoCitation[];
  toolsUsed: LeoToolKey[];
};

export type LeoPageEntityContext = {
  type: "class" | "teacher" | "student" | "unknown";
  id?: string;
};

export type LeoPageContext = {
  route: string | null;
  tab: string | null;
  entity: LeoPageEntityContext | null;
  mode: "explain" | "investigate";
};

export type LeoActionKey =
  | "navigate_to_fix_surface"
  | "draft_school_notice"
  | "draft_parent_message"
  | "preview_teacher_assignment_change"
  | "preview_homeroom_change"
  | "preview_timetable_publish";

export type LeoActionCategory =
  | "navigate"
  | "draft"
  | "create"
  | "update"
  | "assign"
  | "publish"
  | "bulk"
  | "notify"
  | "export";

export type LeoActionPreviewDTO = {
  actionRunId: string;
  actionKey: LeoActionKey;
  title: string;
  description: string;
  confirmationRequired: boolean;
  preview: Record<string, unknown>;
};

export type LeoActionExecuteDTO = {
  actionRunId: string;
  actionKey: LeoActionKey;
  status: "executed" | "failed";
  output: Record<string, unknown>;
};
