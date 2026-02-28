// src/lib/fees/money.ts
// Utility functions for handling money in minor units (pesewas)

/**
 * Convert major units (GHS) to minor units (pesewas)
 * @param amount - Amount in major units (e.g., 100.50 for GHS 100.50)
 * @returns Amount in minor units (e.g., 10050 for 100.50 GHS)
 */
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Convert minor units (pesewas) to major units (GHS)
 * @param minorUnits - Amount in minor units (e.g., 10050)
 * @returns Amount in major units (e.g., 100.50)
 */
export function toMajorUnits(minorUnits: number): number {
  return minorUnits / 100;
}

export interface FormatCurrencyOptions {
  /** Currency code (default: "GHS") */
  currency?: string;
  /** Locale for formatting (default: "en-GH" for Ghana) */
  locale?: string;
  /** Minimum decimal places (default: 2) */
  minimumFractionDigits?: number;
  /** Maximum decimal places (default: 2) */
  maximumFractionDigits?: number;
  /** Use compact notation for large numbers (e.g. 1.2K, 1.5M) */
  compact?: boolean;
}

/**
 * Format minor units as locale-aware currency string.
 * Use this for all money display across the app.
 *
 * @param minorUnits - Amount in minor units (pesewas for GHS)
 * @param options - Formatting options (currency, locale, etc.)
 * @returns Formatted string (e.g. "GH₵ 100.50" or "GHS 100.50")
 *
 * @example
 * formatCurrency(10050)           // "GH₵ 100.50" (en-GH)
 * formatCurrency(10050, { currency: "USD" })  // "$100.50"
 * formatCurrency(1200000, { compact: true })   // "GH₵ 12K"
 */
export function formatCurrency(
  minorUnits: number,
  options: FormatCurrencyOptions = {}
): string {
  const {
    currency = "GHS",
    locale = "en-GH",
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    compact = false,
  } = options;

  const major = toMajorUnits(minorUnits);

  if (compact && Math.abs(major) >= 1000) {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      notation: "compact",
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(major);
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(major);
}

/**
 * Format minor units as currency string.
 * Alias for formatCurrency with default options.
 *
 * @param minorUnits - Amount in minor units
 * @param currency - Currency code (default: "GHS")
 * @returns Formatted string (e.g. "GH₵ 100.50")
 */
export function formatMoney(minorUnits: number, currency: string = "GHS"): string {
  return formatCurrency(minorUnits, { currency });
}

/**
 * Format amount already in major units (e.g. from form input).
 * Use when the value is in whole currency units, not pesewas.
 *
 * @param majorUnits - Amount in major units (e.g. 100.50 for GHS 100.50)
 * @param options - Formatting options
 */
export function formatCurrencyFromMajor(
  majorUnits: number,
  options: FormatCurrencyOptions = {}
): string {
  return formatCurrency(Math.round((majorUnits || 0) * 100), options);
}

/**
 * Format minor units as currency string without currency code
 * @param minorUnits - Amount in minor units
 * @returns Formatted string (e.g., "100.50")
 */
export function formatAmount(minorUnits: number): string {
  const major = toMajorUnits(minorUnits);
  return major.toFixed(2);
}

/**
 * Calculate installment amounts with remainder handling
 * @param totalMinor - Total amount in minor units
 * @param numberOfInstallments - Number of installments
 * @returns Array of installment amounts in minor units
 */
export function calculateInstallmentAmounts(
  totalMinor: number,
  numberOfInstallments: number
): number[] {
  if (numberOfInstallments <= 0) return [];
  if (numberOfInstallments === 1) return [totalMinor];

  const baseAmount = Math.floor(totalMinor / numberOfInstallments);
  const remainder = totalMinor % numberOfInstallments;

  const amounts: number[] = [];
  for (let i = 0; i < numberOfInstallments; i++) {
    // Distribute remainder to first installments
    amounts.push(baseAmount + (i < remainder ? 1 : 0));
  }

  return amounts;
}

/**
 * Validate that sum of amounts equals total
 * @param amounts - Array of amounts in minor units
 * @param totalMinor - Expected total in minor units
 * @returns true if sum equals total
 */
export function validateAmountSum(amounts: number[], totalMinor: number): boolean {
  const sum = amounts.reduce((acc, amt) => acc + amt, 0);
  return sum === totalMinor;
}
