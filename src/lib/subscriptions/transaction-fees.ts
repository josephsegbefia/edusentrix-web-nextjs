/**
 * transaction-fees.ts — Plan-aware transaction fee resolver.
 *
 * Extends the existing billing/transaction-fees.ts with plan-level logic:
 *
 * - Pilot schools: fees waived (no payment processing expected).
 * - Starter: standard platform fee (payer_pays, 2.5%, no cap).
 * - Growth: same as starter but with school-absorbed option per school override.
 * - Enterprise: negotiable — defaults to standard, can be overridden per school.
 *
 * Returns a TransactionChargeResolution with rate, payer mode, and a human
 * label for the school admin subscription page.
 *
 * All enforcement is behind SUBSCRIPTION_PAYMENT_CHARGES_ENABLED.
 * While false: returns "standard" mode with the existing system rates.
 *
 * Spec §9.
 */

import "server-only";

import type { PlanCode } from "./plan-codes";
import { PLAN_CODES } from "./plan-codes";

const PAYMENT_CHARGES_ENABLED =
  process.env.SUBSCRIPTION_PAYMENT_CHARGES_ENABLED === "true";

export type TransactionPayerMode = "payer_pays" | "school_absorbs" | "waived";

export type TransactionChargeConfig = {
  /** Percentage (e.g. 2.5 = 2.5%). */
  ratePercent: number;
  /** Max fee in minor (pesewas). null = no cap. */
  capMinor: number | null;
  payerMode: TransactionPayerMode;
};

export type TransactionChargeResolution = {
  schoolFeesConfig: TransactionChargeConfig;
  admissionFeesConfig: TransactionChargeConfig;
  rateLabel: string;
  admissionRateLabel: string;
  defaultPayerMode: TransactionPayerMode;
};

const PLATFORM_DEFAULT_RATE = parseFloat(
  process.env.EDUSENTRIX_TRANSACTION_FEE_PERCENT ?? "2.5"
);

const PLATFORM_DEFAULT_CAP =
  process.env.EDUSENTRIX_TRANSACTION_FEE_CAP_MINOR
    ? parseInt(process.env.EDUSENTRIX_TRANSACTION_FEE_CAP_MINOR, 10)
    : null;

function makeStandardConfig(payerMode: TransactionPayerMode): TransactionChargeConfig {
  return {
    ratePercent: PLATFORM_DEFAULT_RATE,
    capMinor: PLATFORM_DEFAULT_CAP,
    payerMode,
  };
}

function rateLabel(config: TransactionChargeConfig): string {
  if (config.payerMode === "waived") return "Waived (Pilot)";
  if (config.ratePercent === 0) return "No charge";
  const pct = `${config.ratePercent}%`;
  const cap = config.capMinor ? ` (max GHS ${(config.capMinor / 100).toFixed(2)})` : "";
  const who = config.payerMode === "school_absorbs" ? " (school-absorbed)" : " (parent-paid)";
  return `${pct}${cap}${who}`;
}

type PlanChargeOverride = {
  payerMode?: TransactionPayerMode;
  ratePercent?: number;
  capMinor?: number | null;
};

/**
 * Resolve transaction charge config for a school.
 *
 * @param planCode  - The school's current plan code (null = no plan).
 * @param override  - Per-school override stored on SchoolSubscription (optional).
 */
export function resolveTransactionChargeConfig(
  planCode: PlanCode | null | undefined,
  override?: PlanChargeOverride | null
): TransactionChargeResolution {
  // While charges are disabled: return standard config but mark as system default
  if (!PAYMENT_CHARGES_ENABLED) {
    const config = makeStandardConfig("payer_pays");
    return {
      schoolFeesConfig: config,
      admissionFeesConfig: config,
      rateLabel: rateLabel(config),
      admissionRateLabel: rateLabel(config),
      defaultPayerMode: "payer_pays",
    };
  }

  // Pilot schools have fees waived
  if (planCode === PLAN_CODES.PILOT) {
    const config: TransactionChargeConfig = {
      ratePercent: 0,
      capMinor: null,
      payerMode: "waived",
    };
    return {
      schoolFeesConfig: config,
      admissionFeesConfig: config,
      rateLabel: "Waived (Pilot)",
      admissionRateLabel: "Waived (Pilot)",
      defaultPayerMode: "waived",
    };
  }

  // No plan → standard payer_pays
  if (!planCode) {
    const config = makeStandardConfig("payer_pays");
    return {
      schoolFeesConfig: config,
      admissionFeesConfig: config,
      rateLabel: rateLabel(config),
      admissionRateLabel: rateLabel(config),
      defaultPayerMode: "payer_pays",
    };
  }

  // Build base from plan
  const basePayer: TransactionPayerMode =
    planCode === PLAN_CODES.ENTERPRISE ? "school_absorbs" : "payer_pays";

  let schoolFeesConfig = makeStandardConfig(basePayer);
  let admissionFeesConfig = makeStandardConfig("payer_pays"); // always parent-paid

  // Apply per-school overrides
  if (override?.payerMode) schoolFeesConfig = { ...schoolFeesConfig, payerMode: override.payerMode };
  if (typeof override?.ratePercent === "number") {
    schoolFeesConfig = { ...schoolFeesConfig, ratePercent: override.ratePercent };
    admissionFeesConfig = { ...admissionFeesConfig, ratePercent: override.ratePercent };
  }
  if (override?.capMinor !== undefined) {
    schoolFeesConfig = { ...schoolFeesConfig, capMinor: override.capMinor };
    admissionFeesConfig = { ...admissionFeesConfig, capMinor: override.capMinor };
  }

  return {
    schoolFeesConfig,
    admissionFeesConfig,
    rateLabel: rateLabel(schoolFeesConfig),
    admissionRateLabel: rateLabel(admissionFeesConfig),
    defaultPayerMode: schoolFeesConfig.payerMode,
  };
}

/**
 * Compute the actual fee amount for a transaction.
 *
 * @param amountMinor - Payment amount in minor (pesewas).
 * @param config      - Resolved charge config.
 * @returns fee in minor units.
 */
export function computeTransactionFeeFromConfig(
  amountMinor: number,
  config: TransactionChargeConfig
): number {
  if (config.payerMode === "waived" || config.ratePercent === 0) return 0;
  const raw = Math.round((amountMinor * config.ratePercent) / 100);
  return config.capMinor !== null ? Math.min(raw, config.capMinor) : raw;
}
