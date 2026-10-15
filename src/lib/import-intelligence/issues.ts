import { createHash } from "node:crypto";
import type {
  ImportDomain,
  ImportIssueStatus,
  ImportIssueV2,
  ImportProposedAction,
  ImportResolutionSource,
  ImportResolutionClass,
  ImportRowReference,
} from "./types";

function normalized(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function stableImportIssueId(input: {
  domain: ImportDomain;
  issueType: string;
  scope: string;
  fieldKey?: string | null;
  rowRefs?: ImportRowReference[];
  sourceValues?: string[];
}) {
  const seed = [
    input.domain,
    input.issueType,
    input.scope,
    normalized(input.fieldKey),
    [...(input.rowRefs ?? [])].sort().join(","),
    [...(input.sourceValues ?? [])].map(normalized).sort().join("|").slice(0, 2000),
  ].join("|");
  return `issue_${createHash("sha256").update(seed).digest("hex").slice(0, 24)}`;
}

export function createImportIssue(input: {
  domain: ImportDomain;
  issueType: string;
  scope: ImportIssueV2["scope"];
  rowRefs?: ImportRowReference[];
  fieldKey?: string | null;
  severity: ImportIssueV2["severity"];
  sourceValues?: string[];
  explanation: string;
  recommendedAction?: string | null;
  candidateActions?: ImportProposedAction[];
  resolutionClass: ImportResolutionClass;
  requiresHumanConfirmation?: boolean;
  status?: ImportIssueStatus;
  context?: ImportIssueV2["context"];
  affectedCount?: number;
  now?: Date;
}): ImportIssueV2 {
  const now = input.now ?? new Date();
  const rowRefs = input.rowRefs ?? [];
  const sourceValues = input.sourceValues ?? [];
  return {
    issueId: stableImportIssueId(input),
    domain: input.domain,
    scope: input.scope,
    rowRefs,
    fieldKey: input.fieldKey ?? null,
    issueType: input.issueType,
    severity: input.severity,
    sourceValues,
    explanation: input.explanation,
    recommendedAction: input.recommendedAction ?? null,
    candidateActions: input.candidateActions ?? [],
    resolutionClass: input.resolutionClass,
    requiresHumanConfirmation: input.requiresHumanConfirmation ?? input.resolutionClass !== "AUTO",
    status: input.status ?? "open",
    resolvedAction: null,
    resolvedBy: null,
    context: input.context ?? null,
    affectedCount: input.affectedCount ?? rowRefs.length,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

const precedence: Record<ImportResolutionSource, number> = {
  leo: 1,
  deterministic: 2,
  admin_via_leo: 3,
  admin: 4,
};

export function resolutionWins(
  current: ImportResolutionSource | null | undefined,
  incoming: ImportResolutionSource
) {
  return (precedence[incoming] ?? 0) >= (precedence[current ?? "leo"] ?? 0);
}

export function applyIssueResolution(input: {
  issue: ImportIssueV2;
  action: ImportProposedAction;
  source: ImportResolutionSource;
  confirmed?: boolean;
  now?: Date;
}): ImportIssueV2 {
  const now = input.now ?? new Date();
  const isConfirmed = input.source === "admin" || input.source === "admin_via_leo" || input.confirmed === true;
  if (!resolutionWins(input.issue.resolvedBy, input.source) && input.issue.status === "resolved") {
    return input.issue;
  }
  return {
    ...input.issue,
    status: isConfirmed || input.issue.resolutionClass === "AUTO" ? "resolved" : "open",
    resolvedAction: input.action,
    resolvedBy: input.source,
    updatedAt: now.toISOString(),
  };
}
