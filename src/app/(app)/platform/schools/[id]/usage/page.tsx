"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/fees/money";

type UsageResponse = {
  periodStart: string;
  periodEnd: string;
  totalEstimatedCostMinor: number;
  metrics: Array<{
    id: string;
    provider: string;
    metricKey: string;
    quantity: number;
    unitLabel: string;
    estimatedCostMinor: number;
    allocationMethod: string;
    sourceType: string;
    updatedAt: string | null;
  }>;
};

export default function PlatformSchoolUsagePage() {
  const params = useParams<{ id: string }>();
  const schoolId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<UsageResponse | null>(null);

  const loadData = React.useCallback(async () => {
    if (!schoolId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/platform/schools/${schoolId}/usage`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to load school usage");
      setData(json.data as UsageResponse);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load school usage");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  React.useEffect(() => { void loadData(); }, [loadData]);

  return (
    <div className="space-y-6 p-2 md:p-4">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="w-fit px-0 text-white/70 hover:text-white"><Link href={schoolId ? `/platform/schools/${schoolId}` : "/platform/schools"}><ArrowLeft className="mr-2 h-4 w-4" />Back to School</Link></Button>
        <h1 className="text-3xl font-semibold text-white">School Usage</h1>
        {data ? <p className="text-sm text-white/60">{data.periodStart} to {data.periodEnd}</p> : null}
      </div>

      <Card className="border-white/10 bg-white/5 text-white">
        <CardHeader><CardTitle className="text-base">Attributed Usage Cost</CardTitle></CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold text-white">{formatMoney(data?.totalEstimatedCostMinor || 0)}</p>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-black text-white shadow-2xl">
        <CardHeader><CardTitle className="text-xl">Usage Metrics</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {loading && !data ? <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60"><Loader2 className="h-4 w-4 animate-spin" />Loading school usage</div> : null}
          {(data?.metrics || []).map((metric) => (
            <div key={metric.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-medium text-white">{metric.provider} • {metric.metricKey}</p>
                  <p className="text-xs text-white/50">{metric.quantity} {metric.unitLabel} • {metric.allocationMethod} • {metric.sourceType}</p>
                </div>
                <p className="text-sm font-medium text-white">{formatMoney(metric.estimatedCostMinor)}</p>
              </div>
            </div>
          ))}
          {!loading && (data?.metrics.length || 0) === 0 ? <p className="text-sm text-white/60">No usage metrics recorded for this school yet.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
