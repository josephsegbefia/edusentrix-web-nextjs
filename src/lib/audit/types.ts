import type { Types } from "mongoose";

export type AuditScopeType = "platform" | "school";

export type AuditDomain =
  | "identity"
  | "academics"
  | "finance"
  | "billing"
  | "communication"
  | "applications"
  | "timetable"
  | "system"
  | "email";

export type AuditTier = 0 | 1 | 2;

export type AuditResult =
  | "attempted"
  | "succeeded"
  | "failed"
  | "skipped"
  | "compensated";

export type AuditActorType =
  | "user"
  | "system"
  | "webhook"
  | "job"
  | "ai_assist"
  | "migration";

export type AuditSensitivity =
  | "low"
  | "moderate"
  | "high"
  | "guardian_only"
  | "financial_secret";

export type AuditRedactionMode = "none" | "masked" | "hidden";

export type AuditRetentionClass =
  | "financial_critical"
  | "academic_record"
  | "identity_and_permissions"
  | "operational"
  | "feed_noise";

/** Policy entry for a single action code — see EDUSENTRIX_AUDIT_HARDENING_SPEC §10.2 */
export type AuditPolicyEntry = {
  domain: AuditDomain;
  tier: AuditTier;
  sensitivity: AuditSensitivity;
  retentionClass: AuditRetentionClass;
  requiresReason: boolean;
  requiresBeforeAfter: boolean;
  requiresHashChain: boolean;
  requiresIdempotencyKey: boolean;
  /** Max JSON byte length for before + after + metadata combined (UTF-8) */
  maxPayloadBytes: number;
  /** Substrings that must not appear in JSON-serialized payload (case-insensitive) */
  prohibitedPayloadSubstrings: string[];
  derivesActivityFeed: boolean;
};

export type AuditRequestContext = {
  requestId: string;
  correlationId: string;
  idempotencyKey?: string;
  actorType: AuditActorType;
  actorId?: string | Types.ObjectId | null;
  actorRole?: string | null;
  actorEmail?: string | null;
  actorName?: string | null;
  schoolId?: string | Types.ObjectId | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  routePath?: string | null;
  clientSurface?: string | null;
};

export type AuditPayloadFields = {
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  changedFields?: string[] | null;
  metadata?: Record<string, unknown> | null;
};

export type AuditTarget = {
  targetEntityType: string;
  targetEntityId: string | Types.ObjectId;
  secondaryEntityType?: string | null;
  secondaryEntityId?: string | Types.ObjectId | null;
};

export type AuditReason = {
  reasonCode?: string | null;
  reason?: string | null;
};

export type AuditApproval = {
  reviewedById?: string | Types.ObjectId | null;
  reviewedByRole?: string | null;
  approvedById?: string | Types.ObjectId | null;
  approvedByRole?: string | null;
};
