"use client";

import Link from "next/link";
import { BookOpenCheck, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SchoolSchemeWeekSnapshot } from "@/lib/schemes/resolve-scheme-week";

type SchemeRow = {
  id: string;
  schemeId: string;
  schemeTitle: string;
  title: string;
  weekNumber: number | null;
  className: string;
  subjectName: string;
  coverageStatus: string;
};

type Props = {
  rows?: SchemeRow[];
  loading?: boolean;
  currentSchemeWeek?: SchoolSchemeWeekSnapshot | null;
};

export function ThisWeekSchemeRows({ rows = [], loading, currentSchemeWeek }: Props) {
  return (
    <section className="rounded-2xl border border-white/10 bg-linear-to-br from-white/5 to-transparent p-5 shadow-lg shadow-black/20 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-500/15">
            <BookOpenCheck className="h-5 w-5 text-emerald-200" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">This week&apos;s Scheme of Learning</h2>
            <p className="mt-1 text-xs text-white/45">
              {currentSchemeWeek?.status === "active" && currentSchemeWeek.label
                ? `${currentSchemeWeek.label}${
                    currentSchemeWeek.rangeLabel ? ` (${currentSchemeWeek.rangeLabel})` : ""
                  } · scheme rows ready for Lesson Notes.`
                : "Active scheme rows ready to become Lesson Notes."}
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline" className="border-white/10 bg-white/5 text-white/75">
          <Link href="/teacher/schemes">View schemes</Link>
        </Button>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="grid gap-2 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-xl border border-white/8 bg-white/5" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
            No active scheme rows are scheduled for this week.
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {rows.map((row) => (
              <div key={row.id} className="rounded-xl border border-white/10 bg-slate-950/35 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{row.title}</p>
                    <p className="mt-1 text-xs text-white/45">
                      {row.weekNumber != null ? `Term Week ${row.weekNumber} · ` : ""}
                      {[row.className, row.subjectName].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <Button asChild size="sm" className="shrink-0 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30">
                    <Link href={`/teacher/lesson-notes?createFromSchemeItem=${row.id}`}>
                      <FileText className="mr-2 h-4 w-4" />
                      Note
                    </Link>
                  </Button>
                </div>
                <p className="mt-2 truncate text-xs text-white/35">{row.schemeTitle}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
