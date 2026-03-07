import { connectToDatabase } from "@/db/connectToDatabase";
import {
  AUTO_SYNC_PROVIDERS,
  executePlatformBillingProviderSyncRun,
} from "@/lib/platform-billing/provider-sync";
import {
  getCurrentMonthRange,
  parseDateOnly,
} from "@/lib/platform-billing/period-range";
import {
  PLATFORM_BILLING_PROVIDERS,
  type PlatformBillingProvider,
} from "@/lib/platform-billing/providers";

function resolveProviders(raw?: string | null): PlatformBillingProvider[] {
  if (!raw?.trim()) {
    return [...AUTO_SYNC_PROVIDERS];
  }

  const validProviders = new Set(PLATFORM_BILLING_PROVIDERS);
  const providers = raw
    .split(",")
    .map((value) => value.trim())
    .filter(
      (value): value is PlatformBillingProvider =>
        Boolean(value) && validProviders.has(value as PlatformBillingProvider)
    );

  return providers.length > 0 ? Array.from(new Set(providers)) : [...AUTO_SYNC_PROVIDERS];
}

export async function runProviderCostSyncJob(input?: {
  providers?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
}) {
  await connectToDatabase();

  const defaultRange = getCurrentMonthRange();
  const periodStart =
    parseDateOnly(input?.periodStart) || defaultRange.periodStart;
  const periodEnd =
    parseDateOnly(input?.periodEnd) || defaultRange.periodEnd;

  if (periodEnd.getTime() < periodStart.getTime()) {
    throw new Error("Invalid sync period.");
  }

  const providers = resolveProviders(input?.providers);
  const runs: Array<{
    provider: PlatformBillingProvider;
    runId?: string;
    metricsUpserted?: number;
    costEntriesUpserted?: number;
    summary?: string;
    error?: string;
  }> = [];

  for (const provider of providers) {
    try {
      const result = await executePlatformBillingProviderSyncRun({
        provider,
        periodStart,
        periodEnd,
        triggerMode: "scheduled",
        actor: {},
      });
      runs.push({
        provider,
        runId: result.runId,
        metricsUpserted: result.metricsUpserted,
        costEntriesUpserted: result.costEntriesUpserted,
        summary: result.summary,
      });
    } catch (error) {
      runs.push({
        provider,
        error: error instanceof Error ? error.message : "Provider sync failed.",
      });
    }
  }

  const completed = runs.filter((run) => !run.error).length;
  const failed = runs.length - completed;

  return {
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd: periodEnd.toISOString().slice(0, 10),
    processedProviders: runs.length,
    completed,
    failed,
    runs,
  };
}
