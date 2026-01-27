"use client";

import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";

type Metrics = {
  pending: number;
  approved: number;
  rejected: number;
  last7d?: number[]; // optional tiny sparkline data
};

export default function MetricsPanel() {
  const search = useSearchParams();
  const range = search.get("range") ?? "30d";

  const { data } = useQuery({
    queryKey: ["applications:metrics", { range }],
    queryFn: async () => {
      const res = await fetch(
        `/api/platform/applications/metrics?range=${range}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("metrics");
      const payload = await res.json();
      if (!payload?.success || !payload?.data) {
        throw new Error("metrics-payload");
      }
      return payload.data as Metrics;
    },
  });

  const m = data ?? { pending: 0, approved: 0, rejected: 0, last7d: [] };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <MetricCard
        label="Pending Applications"
        value={m.pending}
        accent="from-amber-500/25 via-amber-500/10 to-transparent"
      />
      <MetricCard
        label="Approved Applications"
        value={m.approved}
        accent="from-emerald-500/20 via-emerald-500/5 to-transparent"
      />
      <MetricCard
        label="Rejected Applications"
        value={m.rejected}
        accent="from-rose-500/25 via-rose-500/10 to-transparent"
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <Card className="relative overflow-hidden border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-5 shadow-lg shadow-black/20 backdrop-blur lg:p-6">
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent}`}
        aria-hidden="true"
      />
      <div className="relative z-10 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
          {label}
        </div>
        <div className="text-3xl font-semibold text-white drop-shadow-sm">
          {value.toLocaleString()}
        </div>
        <div className="h-[3px] w-12 rounded-full bg-white/30" />
      </div>
    </Card>
  );
}
