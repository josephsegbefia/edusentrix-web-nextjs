import "server-only";

export type TransactionFeeConfig = {
  percent: number;
  capMinor: number | null;
};

export type TransactionFeePolicyMode =
  | "platform_default"
  | "custom"
  | "disabled";

export type SchoolTransactionFeePolicy = {
  mode?: TransactionFeePolicyMode | null;
  percent?: number | null;
  capMinor?: number | null;
};

export type TransactionFeeBreakdown = {
  amountMinor: number;
  percent: number;
  capMinor: number | null;
  feeMinor: number;
};

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getTransactionFeeConfig(): TransactionFeeConfig {
  const percent = Math.max(
    0,
    parseNumber(process.env.EDUSENTRIX_TRANSACTION_FEE_PERCENT) ?? 0
  );
  const rawCapMinor = parseNumber(process.env.EDUSENTRIX_TRANSACTION_FEE_CAP_MINOR);

  return {
    percent,
    capMinor:
      rawCapMinor !== null && rawCapMinor >= 0 ? Math.round(rawCapMinor) : null,
  };
}

export function resolveTransactionFeeConfigForSchool(
  policy?: SchoolTransactionFeePolicy | null
): TransactionFeeConfig {
  if (!policy || !policy.mode || policy.mode === "platform_default") {
    return getTransactionFeeConfig();
  }

  if (policy.mode === "disabled") {
    return { percent: 0, capMinor: null };
  }

  return {
    percent: Math.max(0, Number(policy.percent || 0)),
    capMinor:
      typeof policy.capMinor === "number" && Number.isFinite(policy.capMinor)
        ? Math.max(0, Math.round(policy.capMinor))
        : null,
  };
}

export function computeTransactionFee(
  amountMinor: number,
  config: TransactionFeeConfig = getTransactionFeeConfig()
): TransactionFeeBreakdown {
  const normalizedAmountMinor = Math.max(0, Math.round(amountMinor));
  const rawFeeMinor = Math.round((normalizedAmountMinor * config.percent) / 100);
  const feeMinor =
    config.capMinor !== null ? Math.min(rawFeeMinor, config.capMinor) : rawFeeMinor;

  return {
    amountMinor: normalizedAmountMinor,
    percent: config.percent,
    capMinor: config.capMinor,
    feeMinor: Math.max(0, feeMinor),
  };
}
