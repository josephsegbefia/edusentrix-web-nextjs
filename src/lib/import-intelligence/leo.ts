import mongoose from "mongoose";
import type { ZodType } from "zod";
import { resolveImportLeoAccess } from "./access";
import { IMPORT_AI_MAX_CONTEXT_CHARS } from "./privacy";
import type { ImportDomain, ImportLeoMetadata, ImportLeoTask } from "./types";
import { createOpenAiImportProvider, type StructuredImportProvider } from "@/lib/leo/providers/openai-import-provider";

export type ImportLeoTracing = {
  importJobId?: string | null;
  schoolId?: string | null;
};

export type RunLeoImportIntelligenceInput<T> = {
  domain: ImportDomain;
  task: ImportLeoTask;
  schoolId: mongoose.Types.ObjectId;
  authorized: boolean;
  context: string;
  responseSchema: ZodType<T>;
  inputCount: number;
  tracing?: ImportLeoTracing;
  privacyOptOut?: boolean;
};

export type RunLeoImportIntelligenceResult<T> =
  | { ok: true; data: T; metadata: ImportLeoMetadata }
  | { ok: false; metadata: ImportLeoMetadata };

export async function runLeoImportIntelligence<T>(
  input: RunLeoImportIntelligenceInput<T>,
  dependencies?: { provider?: StructuredImportProvider; platform?: { enabled: boolean; forcedDisabled?: boolean } }
): Promise<RunLeoImportIntelligenceResult<T>> {
  const startedAt = new Date();
  const model = process.env.LEO_IMPORT_MODEL || "gpt-4o-mini";
  const base: ImportLeoMetadata = {
    status: "pending",
    provider: dependencies?.provider?.provider || "leo",
    model,
    startedAt,
    inputCount: Math.max(0, input.inputCount),
    attempts: 1,
    task: input.task,
    domain: input.domain,
    importJobId: input.tracing?.importJobId ?? null,
  };
  const access = await resolveImportLeoAccess({
    schoolId: input.schoolId,
    authorized: input.authorized,
    privacyOptOut: input.privacyOptOut,
    platform: dependencies?.platform,
    providerConfigured: dependencies?.provider ? true : undefined,
  });
  if (!access.available) {
    return {
      ok: false,
      metadata: {
        ...base,
        status: access.reasonCode === "provider_not_configured" ? "unavailable" : "degraded",
        reasonCode: access.reasonCode,
        retryable: access.retryable,
        reason: importAccessReason(access.reasonCode),
        completedAt: new Date(),
        lastErrorCode: access.reasonCode === "provider_not_configured" ? "IMPORT_AI_UNAVAILABLE" : null,
      },
    };
  }
  if (input.context.length > IMPORT_AI_MAX_CONTEXT_CHARS) {
    return {
      ok: false,
      metadata: {
        ...base,
        status: "degraded",
        reasonCode: "context_too_large",
        retryable: false,
        reason: "The import intelligence context exceeded the safe limit.",
        completedAt: new Date(),
        lastErrorCode: "IMPORT_AI_CONTEXT_TOO_LARGE",
      },
    };
  }
  try {
    const provider = dependencies?.provider ?? createOpenAiImportProvider();
    const content = await provider.completeJson({ model, context: input.context, maxTokens: 6000, responseSchema: input.responseSchema });
    if (!content) return failure(base, "invalid_response", "Leo returned an empty response.", "IMPORT_AI_INVALID_RESPONSE");
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(content);
    } catch {
      return failure(base, "invalid_response", "Leo returned malformed JSON.", "IMPORT_AI_INVALID_RESPONSE");
    }
    const parsed = input.responseSchema.safeParse(parsedJson);
    if (!parsed.success) return failure(base, "validation_failed", "Leo returned a response that failed schema validation.", "IMPORT_AI_VALIDATION_FAILED");
    const metadata: ImportLeoMetadata = {
      ...base,
      status: "completed",
      reasonCode: "available",
      retryable: false,
      recommendationCount: 1,
      completedAt: new Date(),
    };
    safeImportAiLog({ input, metadata, resultStatus: "completed" });
    return { ok: true, data: parsed.data, metadata };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Leo provider failed.";
    const timeout = /timeout|timed out|ETIMEDOUT/i.test(message);
    const providerMissing = /NOT_CONFIGURED/.test(message);
    return failure(
      base,
      providerMissing ? "provider_not_configured" : timeout ? "timeout" : "provider_error",
      providerMissing ? "Leo provider credentials are not configured." : timeout ? "Leo timed out." : "Leo could not complete the import intelligence pass.",
      providerMissing ? "IMPORT_AI_UNAVAILABLE" : timeout ? "IMPORT_AI_TIMEOUT" : "IMPORT_AI_PROVIDER_ERROR"
    );
  }
}

function failure(
  base: ImportLeoMetadata,
  reasonCode: NonNullable<ImportLeoMetadata["reasonCode"]>,
  reason: string,
  lastErrorCode: NonNullable<ImportLeoMetadata["lastErrorCode"]>
): { ok: false; metadata: ImportLeoMetadata } {
  const retryable = reasonCode === "timeout" || reasonCode === "provider_error" || reasonCode === "provider_unavailable";
  const metadata = { ...base, status: "degraded" as const, reasonCode, retryable, reason, completedAt: new Date(), lastErrorCode };
  return { ok: false, metadata };
}

function importAccessReason(reasonCode: string) {
  const messages: Record<string, string> = {
    unauthorized: "The current user is not authorized to use import intelligence.",
    runtime_disabled: "Import intelligence is disabled in this runtime.",
    platform_disabled: "Import intelligence is administratively disabled.",
    privacy_disabled: "The school has disabled external AI processing for import intelligence.",
    provider_not_configured: "Leo import provider credentials are not configured.",
  };
  return messages[reasonCode] || "Leo import intelligence is unavailable.";
}

function safeImportAiLog(input: { input: RunLeoImportIntelligenceInput<unknown>; metadata: ImportLeoMetadata; resultStatus: string }) {
  console.info("import_leo_intelligence", {
    domain: input.input.domain,
    task: input.input.task,
    schoolId: input.input.tracing?.schoolId || String(input.input.schoolId),
    importJobId: input.input.tracing?.importJobId || null,
    attempt: input.metadata.attempts || 1,
    provider: input.metadata.provider || null,
    model: input.metadata.model || null,
    durationMs: input.metadata.completedAt && input.metadata.startedAt ? input.metadata.completedAt.getTime() - input.metadata.startedAt.getTime() : null,
    resultStatus: input.resultStatus,
  });
}
