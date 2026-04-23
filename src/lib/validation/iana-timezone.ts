/**
 * Best-effort IANA zone validation using Intl (browser + Node).
 */
export function isValidIanaTimeZone(tz: string): boolean {
  const s = typeof tz === "string" ? tz.trim() : "";
  if (s.length < 2 || s.length > 120) return false;
  if (!/^[A-Za-z0-9_/+\-]+$/.test(s)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: s }).format(new Date());
    return true;
  } catch {
    return false;
  }
}
