// src/types/demo.ts
// Demo system types - isolated from main app types

export interface DemoLeadInput {
  email: string;
  fullName: string;
  organization: string;
  role: DemoRole;
  schoolSize?: DemoSchoolSize;
  phone?: string;
  country?: string;
}

export type DemoRole = "admin" | "teacher" | "finance" | "it" | "other";
export type DemoSchoolSize = "small" | "medium" | "large" | "xlarge";

export interface DemoSessionData {
  demoTenantId: string;
  leadId: string;
  email: string;
  fullName: string;
  organization: string;
  role: DemoRole;
  createdAt: string;
  expiresAt: string;
  hardExpiresAt: string;
}

export interface DemoSessionEvent {
  type:
    | "session_start"
    | "page_view"
    | "feature_explore"
    | "action_attempted"
    | "action_blocked"
    | "cta_click"
    | "session_end";
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface DemoLeadDTO {
  id: string;
  email: string;
  fullName: string;
  organization: string;
  role: DemoRole;
  schoolSize?: DemoSchoolSize;
  phone?: string;
  country?: string;
  status: DemoLeadStatus;
  magicLinkToken?: string;
  magicLinkExpiresAt?: string;
  sessionsCount: number;
  lastSessionAt?: string;
  totalTimeSpentSeconds: number;
  featuresExplored: string[];
  highIntentSignals: string[];
  createdAt: string;
  updatedAt: string;
}

export type DemoLeadStatus =
  | "pending_verification"
  | "verified"
  | "session_active"
  | "session_completed"
  | "converted"
  | "expired";

export interface DemoSessionDTO {
  id: string;
  demoTenantId: string;
  leadId: string;
  status: DemoSessionStatus;
  startedAt: string;
  lastActivityAt: string;
  endedAt?: string;
  endReason?: DemoSessionEndReason;
  events: DemoSessionEvent[];
  pagesVisited: string[];
  actionsAttempted: string[];
  durationSeconds: number;
}

export type DemoSessionStatus = "active" | "expired" | "ended" | "cleaned_up";
export type DemoSessionEndReason =
  | "user_ended"
  | "inactivity_timeout"
  | "hard_timeout"
  | "browser_closed"
  | "cleanup_job";

// Sales notification types
export interface DemoSalesNotification {
  type: "new_demo" | "high_intent" | "session_ended";
  lead: DemoLeadDTO;
  session?: DemoSessionDTO;
  timestamp: string;
  highlights?: string[];
}

// Feature restriction configuration
export interface DemoFeatureConfig {
  feature: string;
  allowed: boolean;
  simulateAction?: boolean;
  message?: string;
}

// Demo seeding configuration
export interface DemoSeedConfig {
  studentsCount: number;
  teachersCount: number;
  classGroupsCount: number;
  subjectsCount: number;
  invoicesCount: number;
  activitiesCount: number;
}
