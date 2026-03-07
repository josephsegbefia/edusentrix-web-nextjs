"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/fees/money";

type SchoolRow = {
  id: string;
  name: string;
  status: string;
  paymentReady: boolean;
  subscription: {
    tierName: string | null;
    status: string;
    effectivePriceMinor: number;
  } | null;
  usage: {
    totalEstimatedCostMinor: number;
    metricsCount: number;
  };
};

export default function PlatformSchoolsPage() {
  const [loading, setLoading] = React.useState(true);
  const [schools, setSchools] = React.useState<SchoolRow[]>([]);

  const loadSchools = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/platform/schools", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load platform schools");
      }
      setSchools((json.data?.schools || []) as SchoolRow[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load platform schools");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadSchools();
  }, [loadSchools]);

  return (
    <div className="space-y-6 p-2 md:p-4">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="w-fit px-0 text-white/70 hover:text-white">
          <Link href="/platform">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Platform
          </Link>
        </Button>
        <h1 className="text-3xl font-semibold text-white">Schools</h1>
        <p className="text-sm text-white/60">
          Platform-wide school commercial profile, subscription state, and attributed cost.
        </p>
      </div>

      <Card className="border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-black text-white shadow-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Building2 className="h-5 w-5 text-cyan-300" />
            School Directory
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading schools
            </div>
          ) : null}

          {schools.map((school) => (
            <div key={school.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="font-medium text-white">{school.name}</p>
                  <p className="text-xs text-white/50">
                    {school.status} • {school.paymentReady ? "payment ready" : "payment setup pending"}
                  </p>
                  <p className="mt-2 text-sm text-white/60">
                    {school.subscription
                      ? `${school.subscription.tierName || "Unassigned"} • ${school.subscription.status}`
                      : "No subscription assigned"}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium text-white">
                    {formatMoney(school.subscription?.effectivePriceMinor || 0)}
                  </p>
                  <p className="text-xs text-white/50">current subscription</p>
                  <p className="mt-2 text-white/60">
                    Cost {formatMoney(school.usage.totalEstimatedCostMinor)}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm" className="bg-cyan-600 text-white hover:bg-cyan-700">
                  <Link href={`/platform/schools/${school.id}`}>Overview</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
                  <Link href={`/platform/schools/${school.id}/subscription`}>Subscription</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
                  <Link href={`/platform/schools/${school.id}/usage`}>Usage</Link>
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
