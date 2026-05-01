"use client";

import Link from "next/link";
import { useTeacherCoverageDashboard } from "@/hooks/teacher/useTeacherSchemes";

export default function TeacherCoveragePage() {
  const { data: rows, isLoading, error } = useTeacherCoverageDashboard();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
      <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
        <h1 className="text-xl font-semibold text-white">Scheme coverage</h1>
        <p className="mt-1 text-sm text-white/65">
          Approved and active schemes only. Open a scheme to update row-level coverage.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-rose-300">{error.message}</p>
      ) : isLoading ? (
        <p className="text-sm text-white/70">Loading coverage…</p>
      ) : !rows?.length ? (
        <p className="text-sm text-white/60">
          No approved or active schemes yet. Submit and approve a scheme of work to track coverage
          here.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map(({ scheme, summary }) => (
            <Link
              key={scheme.id}
              href={`/teacher/schemes/${scheme.id}`}
              className="block rounded-xl border border-white/10 bg-slate-950/30 p-4 transition hover:border-white/20"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-medium text-white">{scheme.title}</h2>
                  <p className="mt-0.5 text-xs text-white/50">{scheme.status}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-emerald-400">{summary.coveragePercentage}%</p>
                  <p className="text-xs text-white/55">
                    {summary.covered}/{summary.totalItems} covered
                  </p>
                </div>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${summary.coveragePercentage}%` }}
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
