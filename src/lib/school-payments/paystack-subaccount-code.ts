/**
 * Paystack returns subaccount codes like `ACCT_xxxxxxxx`. Anything else stored in
 * MongoDB is not a valid linked subaccount (stale data, bugs, or wrong field).
 */
export function isLikelyPaystackSubaccountCode(
  value: string | null | undefined
): boolean {
  const v = (value || "").trim();
  return v.startsWith("ACCT_") && v.length >= 10;
}
