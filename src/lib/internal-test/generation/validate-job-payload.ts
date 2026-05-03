import "server-only";

export type AcademicPeriodInput = {
  name: string;
  termLabel: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
};

export function validateAcademicPeriods(periods: AcademicPeriodInput[]): {
  ok: true;
  normalized: Array<{
    name: string;
    termLabel: string;
    startDate: Date;
    endDate: Date;
    isCurrent: boolean;
  }>;
} | { ok: false; error: string } {
  if (!Array.isArray(periods) || periods.length < 1 || periods.length > 2) {
    return { ok: false, error: "Provide 1 or 2 academic periods." };
  }

  const currentCount = periods.filter((p) => p.isCurrent).length;
  if (currentCount !== 1) {
    return { ok: false, error: "Exactly one period must be marked as current." };
  }

  const normalized: Array<{
    name: string;
    termLabel: string;
    startDate: Date;
    endDate: Date;
    isCurrent: boolean;
  }> = [];

  for (const p of periods) {
    const start = new Date(p.startDate);
    const end = new Date(p.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return { ok: false, error: "Invalid period dates." };
    }
    if (end <= start) {
      return { ok: false, error: "Each period end date must be after its start date." };
    }
    if (!p.name?.trim() || !p.termLabel?.trim()) {
      return { ok: false, error: "Each period needs a name and term label." };
    }
    normalized.push({
      name: p.name.trim(),
      termLabel: p.termLabel.trim(),
      startDate: start,
      endDate: end,
      isCurrent: Boolean(p.isCurrent),
    });
  }

  if (normalized.length === 2) {
    const [a, b] = normalized;
    const overlap = a.startDate < b.endDate && b.startDate < a.endDate;
    if (overlap) {
      return { ok: false, error: "Academic periods must not overlap." };
    }
  }

  return { ok: true, normalized };
}
