"use client";

import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
      return (await res.json()) as Metrics;
    },
  });

  const m = data ?? { pending: 0, approved: 0, rejected: 0, last7d: [] };

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <MetricCard label="Pending" value={m.pending} />
      <MetricCard label="Approved" value={m.approved} />
      <MetricCard label="Rejected" value={m.rejected} />
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="bg-card/80 border border-white/10 p-4">
      <div className="text-sm text-muted">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {/* Optional: sparkline placeholder area */}
      <div className="h-8 mt-2 rounded bg-white/5" />
    </Card>
  );
}
