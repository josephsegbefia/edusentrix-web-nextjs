"use client";

import { CalendarRange, Layers, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { V2CoverageAnalytics } from "@/lib/lessons/lessons-v2-coverage-analytics";

function StatCard({
  label,
  value,
  subtitle,
  loading,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  loading?: boolean;
}) {
  return (
    <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-white/45">{label}</p>
        {loading ? (
          <div className="mt-2 h-9 w-24 animate-pulse rounded bg-white/10" />
        ) : (
          <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
        )}
        {subtitle && <p className="mt-1 text-xs text-white/50">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

type Props = {
  v2Coverage?: V2CoverageAnalytics | null;
  loading?: boolean;
};

/** Delivery and scheme coverage from Lessons v2 (sessions & deliveries). */
export function LessonsV2CoverageSection({ v2Coverage, loading }: Props) {
  if (!loading && !v2Coverage) return null;

  const byClass = v2Coverage?.byClassGroup ?? [];
  const byWeek = v2Coverage?.byWeek ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/55">
          <CalendarRange className="h-4 w-4" />
          Lessons v2 — delivery coverage
        </h2>
        <p className="mb-4 max-w-3xl text-xs text-white/50">
          Completed timetable deliveries and scheme items recorded in the selected date range.
          Legacy lesson publish metrics above remain for historical comparison.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Completed deliveries"
            value={v2Coverage?.deliveriesCompletedInRange ?? "—"}
            subtitle="Sessions marked complete in range"
            loading={loading}
          />
          <StatCard
            label="Scheme items covered"
            value={v2Coverage?.coverageRecordsInRange ?? "—"}
            subtitle="Coverage records written in range"
            loading={loading}
          />
        </div>
      </div>

      {byClass.length > 0 ? (
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/50">
            <Users className="h-3.5 w-3.5" />
            By class group
          </h3>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase text-white/45">
                  <th className="px-4 py-3 font-medium">Class</th>
                  <th className="px-4 py-3 font-medium">Deliveries</th>
                  <th className="px-4 py-3 font-medium">Scheme items</th>
                </tr>
              </thead>
              <tbody>
                {byClass.map((row) => (
                  <tr key={row.classGroupId} className="border-b border-white/5 text-white/80">
                    <td className="px-4 py-3">{row.label}</td>
                    <td className="px-4 py-3">{row.completedDeliveries}</td>
                    <td className="px-4 py-3">{row.schemeItemsCovered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {byWeek.length > 0 ? (
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/50">
            <Layers className="h-3.5 w-3.5" />
            By week plan
          </h3>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase text-white/45">
                  <th className="px-4 py-3 font-medium">Week</th>
                  <th className="px-4 py-3 font-medium">Deliveries</th>
                  <th className="px-4 py-3 font-medium">Scheme items</th>
                </tr>
              </thead>
              <tbody>
                {byWeek.map((row) => (
                  <tr key={row.weekPlanId} className="border-b border-white/5 text-white/80">
                    <td className="px-4 py-3">
                      {row.weekLabel}
                      {row.weekStartDate ? (
                        <span className="ml-2 text-xs text-white/40">{row.weekStartDate}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{row.completedDeliveries}</td>
                    <td className="px-4 py-3">{row.schemeItemsCovered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
