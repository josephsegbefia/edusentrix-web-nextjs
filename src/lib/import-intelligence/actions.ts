import { importProposalSchema, naturalLanguageResolutionSchema } from "./schemas";
import type { ImportProposedAction, ImportRowReference, ImportNaturalLanguageResolution } from "./types";

const objectIdLike = /^[a-f0-9]{24}$/i;

export type ProposalValidationResult =
  | { ok: true; proposal: ReturnType<typeof importProposalSchema.parse> }
  | { ok: false; code: "IMPORT_AI_VALIDATION_FAILED"; message: string };

export function validateImportProposal(input: {
  proposal: unknown;
  allowedRowRefs: Iterable<ImportRowReference | string>;
  allowedCatalogKeys?: Iterable<string>;
  allowedIssueIds?: Iterable<string>;
}): ProposalValidationResult {
  const parsed = importProposalSchema.safeParse(input.proposal);
  if (!parsed.success) {
    return { ok: false, code: "IMPORT_AI_VALIDATION_FAILED", message: "Leo returned an invalid import proposal." };
  }
  const rows = new Set(input.allowedRowRefs);
  const catalogs = new Set(input.allowedCatalogKeys ?? []);
  const issues = new Set(input.allowedIssueIds ?? []);
  for (const action of parsed.data.proposedActions) {
    if (action.issueId && issues.size && !issues.has(action.issueId)) {
      return { ok: false, code: "IMPORT_AI_VALIDATION_FAILED", message: "Leo referenced an unknown import issue." };
    }
    if (action.rowRefs.some((ref) => !rows.has(ref))) {
      return { ok: false, code: "IMPORT_AI_VALIDATION_FAILED", message: "Leo referenced an unknown import row." };
    }
    const actionRecord = action as unknown as Record<string, unknown>;
    for (const value of Object.values(actionRecord)) {
      if (typeof value === "string" && objectIdLike.test(value)) {
        return { ok: false, code: "IMPORT_AI_VALIDATION_FAILED", message: "Leo returned a database identifier instead of an opaque catalog key." };
      }
    }
    for (const key of ["catalogKey", "classGroupKey", "subjectOfferingKey", "gradeKey", "academicPeriodKey"]) {
      const value = actionRecord[key];
      if (typeof value === "string" && catalogs.size && !catalogs.has(value)) {
        return { ok: false, code: "IMPORT_AI_VALIDATION_FAILED", message: "Leo referenced an unknown catalog key." };
      }
    }
  }
  return { ok: true, proposal: parsed.data };
}

export function createPendingNaturalLanguageResolution(input: {
  issueId: string;
  instructionText: string;
  submittedBy: string;
  instructionId?: string;
  now?: Date;
}): ImportNaturalLanguageResolution {
  const now = input.now ?? new Date();
  const instructionId = input.instructionId ?? `instruction_${cryptoRandomId()}`;
  return {
    instructionId,
    issueId: input.issueId,
    instructionText: input.instructionText.trim().slice(0, 2000),
    submittedBy: input.submittedBy,
    submittedAt: now.toISOString(),
    interpretationStatus: "pending",
    proposedActions: [],
    explanation: null,
    confirmationText: null,
    confirmedAt: null,
    confirmedBy: null,
  };
}

export function validateNaturalLanguageResolution(value: unknown) {
  return naturalLanguageResolutionSchema.safeParse(value);
}

export function formatUnderstoodProposal(proposal: {
  confirmationText?: string | null;
  proposedActions: ImportProposedAction[];
  explanation?: string | null;
}) {
  if (proposal.confirmationText?.trim()) return proposal.confirmationText.trim();
  const lines = proposal.proposedActions.map((action) => `• ${action.type.replaceAll("_", " ")}`);
  return ["I understood that you want to:", ...lines, proposal.explanation || "Please confirm these changes before applying them."].join("\n");
}

function cryptoRandomId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}
