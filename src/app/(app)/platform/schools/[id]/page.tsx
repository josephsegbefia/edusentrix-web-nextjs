"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/fees/money";

type SchoolDetail = {
  id: string;
  name: string;
  status: string;
  city: string | null;
  region: string | null;
  email: string | null;
  paymentReady: boolean;
  subscription: {
    tierName: string | null;
    status: string;
    effectivePriceMinor: number;
    discountExposureMinor: number;
  } | null;
  usage: {
    totalEstimatedCostMinor: number;
    metricsCount: number;
  };
  events: Array<{
    id: string;
    summary: string;
    actorEmail: string | null;
    createdAt: string;
  }>;
};

export default function PlatformSchoolDetailPage() {
  const params = useParams<{ id: string }>();
  const schoolId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<SchoolDetail | null>(null);

  const loadData = React.useCallback(async () => {
    if (!schoolId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/platform/schools/${schoolId}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load school detail");
      }
      setData(json.data as SchoolDetail);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load school detail");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <div className="space-y-6 p-2 md:p-4">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="w-fit px-0 text-white/70 hover:text-white">
          <Link href="/platform/schools">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Schools
          </Link>
        </Button>
        <h1 className="text-3xl font-semibold text-white">{data?.name || "School Overview"}</h1>
        {data ? (
          <p className="text-sm text-white/60">
            {data.status} • {data.city || "No city"}{data.region ? `, ${data.region}` : ""}
          </p>
        ) : null}
      </div>

      {loading && !data ? (
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading school overview
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-white/10 bg-white/5"><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-white/50">Subscription</p><p className="mt-2 text-xl font-semibold text-white">{formatMoney(data.subscription?.effectivePriceMinor || 0)}</p><p className="text-xs text-white/50">{data.subscription?.tierName || "Unassigned"}</p></CardContent></Card>
            <Card className="border-white/10 bg-white/5"><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-white/50">Attributed Cost</p><p className="mt-2 text-xl font-semibold text-white">{formatMoney(data.usage.totalEstimatedCostMinor)}</p><p className="text-xs text-white/50">{data.usage.metricsCount} metrics</p></CardContent></Card>
            <Card className="border-white/10 bg-white/5"><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-white/50">Payment Setup</p><p className="mt-2 text-xl font-semibold text-white">{data.paymentReady ? "Ready" : "Pending"}</p><p className="text-xs text-white/50">Paystack school settlement</p></CardContent></Card>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild className="bg-cyan-600 text-white hover:bg-cyan-700"><Link href={`/platform/schools/${data.id}/subscription`}>Manage Subscription</Link></Button>
            <Button asChild variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10"><Link href={`/platform/schools/${data.id}/usage`}>View Usage</Link></Button>
          </div>

          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader><CardTitle className="text-base">Recent Commercial Events</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {data.events.map((event) => (
                <div key={event.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm">
                  <p className="text-white">{event.summary}</p>
                  <p className="mt-1 text-xs text-white/50">{event.actorEmail || "System"} • {new Date(event.createdAt).toLocaleString()}</p>
                </div>
              ))}
              {data.events.length === 0 ? <p className="text-sm text-white/60">No subscription events yet.</p> : null}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
