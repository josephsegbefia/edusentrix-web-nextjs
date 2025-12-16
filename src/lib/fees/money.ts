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

/**
 * Format minor units as currency string
 * @param minorUnits - Amount in minor units
 * @param currency - Currency code (default: "GHS")
 * @returns Formatted string (e.g., "GHS 100.50")
 */
export function formatMoney(minorUnits: number, currency: string = "GHS"): string {
  const major = toMajorUnits(minorUnits);
  return `${currency} ${major.toFixed(2)}`;
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
