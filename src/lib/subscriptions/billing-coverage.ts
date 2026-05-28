import "server-only";

import { Types } from "mongoose";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import type { BillingCadence } from "@/lib/platform-billing/subscription-pricing";

export const BILLING_TERMS_PER_YEAR = 3;
export const ESTIMATED_TERM_DAYS = 120;

export type BillingCoverageSegment = {
  sequence: number;
  academicPeriodId?: string | null;
  academicYearLabel: string;
  termOrdinal: 1 | 2 | 3;
  termLabel: string;
  startsAt: string | null;
  endsAt: string | null;
  estimated: boolean;
};

export type BillingCoverageSnapshot = {
  unit: "term";
  termCount: number;
  cadence: BillingCadence;
  anchor: {
    academicPeriodId?: string | null;
    academicYearLabel: string;
    termOrdinal: 1 | 2 | 3;
    termLabel: string;
    estimated: boolean;
  };
  segments: BillingCoverageSegment[];
  startsAt: string;
  endsAt: string;
  alignedToAcademicPeriods: boolean;
  summary: string;
};

type AcademicPeriodLike = {
  _id: Types.ObjectId;
  yearLabel: string;
  term: string;
  startDate: Date;
  endDate: Date;
  isCurrent?: boolean;
};

function parseTermOrdinal(term: string | null | undefined): 1 | 2 | 3 {
  const normalized = String(term || "").toLowerCase();
  if (/\b3\b|third|term\s*3|trinity/.test(normalized)) return 3;
  if (/\b2\b|second|term\s*2/.test(normalized)) return 2;
  return 1;
}

function termLabel(ordinal: 1 | 2 | 3) {
  return `Term ${ordinal}`;
}

function incrementAcademicYearLabel(label: string) {
  const match = label.match(/(\d{4})\D+(\d{4})/);
  if (match) return `${Number(match[1]) + 1}/${Number(match[2]) + 1}`;
  const year = Number(label.match(/\d{4}/)?.[0]);
  if (Number.isFinite(year)) return String(year + 1);
  return `Next ${label}`;
}

function fallbackYearLabel(date: Date) {
  const year = date.getUTCFullYear();
  return date.getUTCMonth() >= 8 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
}

function fallbackTermOrdinal(date: Date): 1 | 2 | 3 {
  const month = date.getUTCMonth();
  if (month >= 8) return 1;
  if (month >= 0 && month <= 3) return 2;
  return 3;
}

function advanceTerm(input: { academicYearLabel: string; termOrdinal: 1 | 2 | 3 }) {
  if (input.termOrdinal === 3) {
    return {
      academicYearLabel: incrementAcademicYearLabel(input.academicYearLabel),
      termOrdinal: 1 as const,
    };
  }
  return {
    academicYearLabel: input.academicYearLabel,
    termOrdinal: (input.termOrdinal + 1) as 1 | 2 | 3,
  };
}

function termCountForCadence(cadence: BillingCadence | null | undefined) {
  return cadence === "annual" ? BILLING_TERMS_PER_YEAR : 1;
}

function buildEstimatedDate(start: Date, sequence: number) {
  return new Date(start.getTime() + sequence * ESTIMATED_TERM_DAYS * 24 * 60 * 60 * 1000);
}

export async function resolveBillingCoverage(input: {
  schoolId: string | Types.ObjectId;
  billingCadence: BillingCadence | null | undefined;
  startsAt?: Date | null;
  preferNextTerm?: boolean;
}) {
  const startsAt = input.startsAt ?? new Date();
  const schoolId = typeof input.schoolId === "string" ? new Types.ObjectId(input.schoolId) : input.schoolId;
  const cadence = input.billingCadence ?? "term";
  const termCount = termCountForCadence(cadence);

  const periods = await AcademicPeriod.find({ schoolId })
    .sort({ startDate: 1 })
    .lean<AcademicPeriodLike[]>();

  const currentPeriod =
    periods.find((period) => period.startDate <= startsAt && period.endDate >= startsAt) ??
    periods.find((period) => period.isCurrent) ??
    null;

  let anchor = currentPeriod
    ? {
        academicPeriodId: String(currentPeriod._id),
        academicYearLabel: currentPeriod.yearLabel,
        termOrdinal: parseTermOrdinal(currentPeriod.term),
        termLabel: currentPeriod.term || termLabel(parseTermOrdinal(currentPeriod.term)),
        estimated: false,
      }
    : {
        academicPeriodId: null,
        academicYearLabel: fallbackYearLabel(startsAt),
        termOrdinal: fallbackTermOrdinal(startsAt),
        termLabel: termLabel(fallbackTermOrdinal(startsAt)),
        estimated: true,
      };

  if (input.preferNextTerm) {
    const next = advanceTerm(anchor);
    anchor = {
      ...anchor,
      academicPeriodId: null,
      academicYearLabel: next.academicYearLabel,
      termOrdinal: next.termOrdinal,
      termLabel: termLabel(next.termOrdinal),
      estimated: true,
    };
  }

  const segments: BillingCoverageSegment[] = [];
  let cursor = {
    academicYearLabel: anchor.academicYearLabel,
    termOrdinal: anchor.termOrdinal,
  };

  for (let i = 0; i < termCount; i += 1) {
    const matchingPeriod = periods.find(
      (period) =>
        period.yearLabel === cursor.academicYearLabel &&
        parseTermOrdinal(period.term) === cursor.termOrdinal
    );
    const estimatedStart = buildEstimatedDate(startsAt, i);
    const estimatedEnd = buildEstimatedDate(startsAt, i + 1);
    segments.push({
      sequence: i + 1,
      academicPeriodId: matchingPeriod ? String(matchingPeriod._id) : null,
      academicYearLabel: cursor.academicYearLabel,
      termOrdinal: cursor.termOrdinal,
      termLabel: matchingPeriod?.term || termLabel(cursor.termOrdinal),
      startsAt: (matchingPeriod?.startDate ?? (i === 0 ? startsAt : estimatedStart)).toISOString(),
      endsAt: (matchingPeriod?.endDate ?? estimatedEnd).toISOString(),
      estimated: !matchingPeriod,
    });
    cursor = advanceTerm(cursor);
  }

  const firstStartsAt = segments[0]?.startsAt ? new Date(segments[0].startsAt) : startsAt;
  const lastEndsAt = segments.at(-1)?.endsAt ? new Date(segments.at(-1)!.endsAt!) : buildEstimatedDate(startsAt, termCount);
  const alignedToAcademicPeriods = segments.every((segment) => !segment.estimated);

  return {
    unit: "term",
    termCount,
    cadence,
    anchor,
    segments,
    startsAt: firstStartsAt.toISOString(),
    endsAt: lastEndsAt.toISOString(),
    alignedToAcademicPeriods,
    summary:
      termCount === 1
        ? `Covers ${segments[0]?.academicYearLabel ?? anchor.academicYearLabel} ${segments[0]?.termLabel ?? anchor.termLabel}.`
        : `Covers ${segments.map((segment) => `${segment.academicYearLabel} ${segment.termLabel}`).join(", ")}.`,
  } satisfies BillingCoverageSnapshot;
}
