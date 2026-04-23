const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function hhmmToMinutes(time: string): number | null {
  const t = time.trim();
  if (!HHMM.test(t)) return null;
  const [h, m] = t.split(":").map((x) => parseInt(x, 10));
  if (h == null || m == null) return null;
  return h * 60 + m;
}

export function minutesToHhmm(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes)) % (24 * 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function isBefore(a: string, b: string): boolean {
  const x = hhmmToMinutes(a);
  const y = hhmmToMinutes(b);
  if (x == null || y == null) return false;
  return x < y;
}
