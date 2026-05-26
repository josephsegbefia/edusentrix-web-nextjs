"use client";

import * as React from "react";
import { Activity, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { glassInsetClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";

type ActivityPayload = {
  rangeDays: number;
  metrics: {
    activeAccounts: number;
    inactiveAccounts: number;
    pendingFirstLogin: number;
    totalActivity: number;
  };
  events: Array<{ eventType: string; label: string; count: number }>;
  classBreakdown: Array<{ classGroupId: string; classGroupName: string; count: number }>;
  gradeBreakdown: Array<{ gradeId: string; gradeName: string; count: number }>;
};

type ApiResponse =
  | { success: true; data: ActivityPayload }
  | { success: false; error: string };

export function AdminLearnActivityClient() {
  const [data, setData] = React.useState<ActivityPayload | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/admin/learn/activity", { cache: "no-store" });
        const payload = (await response.json()) as ApiResponse;
        if (!response.ok || !payload.success) {
          throw new Error(payload.success ? "Failed to load activity." : payload.error);
        }
        if (!cancelled) setData(payload.data);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load activity.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-6 text-white md:p-8">
      <WorkspacePageShell>
        <WorkspacePageHeader
          title="Learn activity"
          subtitle="School-wide EduSentrix Learn adoption and activity for the last 30 days."
          icon={Activity}
          backHref="/admin/learn"
          backLabel="Back to Learn"
        />

        {loading ? (
          <GlassPanel className="p-8 text-center" glow="cyan">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-teal-200" />
            <p className="mt-3 text-sm text-white/55">Loading activity...</p>
          </GlassPanel>
        ) : data ? (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Metric label="Active accounts" value={data.metrics.activeAccounts} />
              <Metric label="Inactive accounts" value={data.metrics.inactiveAccounts} />
              <Metric label="First login pending" value={data.metrics.pendingFirstLogin} />
              <Metric label="Total activity" value={data.metrics.totalActivity} />
            </div>

            <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
              <GlassPanel className="p-6" glow="both">
                <h2 className="text-lg font-semibold text-white">Activity by type</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {data.events.length ? (
                    data.events.map((event) => (
                      <div key={event.eventType} className={cn(glassInsetClass, "p-4")}>
                        <p className="text-2xl font-semibold text-white">
                          {event.count.toLocaleString()}
                        </p>
                        <p className="mt-1 text-sm text-white/50">{event.label}</p>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/55">
                      No Learn activity has been recorded in the last {data.rangeDays} days.
                    </p>
                  )}
                </div>
              </GlassPanel>

              <BreakdownPanel title="Class group breakdown" rows={data.classBreakdown.map((row) => ({ id: row.classGroupId, name: row.classGroupName, count: row.count }))} />
            </div>

            <BreakdownPanel title="Grade breakdown" rows={data.gradeBreakdown.map((row) => ({ id: row.gradeId, name: row.gradeName, count: row.count }))} />
          </>
        ) : null}
      </WorkspacePageShell>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <GlassPanel className="p-4" glow="cyan">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value.toLocaleString()}</p>
    </GlassPanel>
  );
}

function BreakdownPanel({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ id: string; name: string; count: number }>;
}) {
  return (
    <GlassPanel className="p-6" glow="teal">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.length ? (
          rows.map((row) => (
            <div key={row.id} className={cn(glassInsetClass, "flex items-center justify-between gap-3 p-4")}>
              <span className="font-medium text-white">{row.name}</span>
              <span className="text-sm font-semibold text-teal-100">{row.count.toLocaleString()}</span>
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/55">
            No data in this breakdown yet.
          </p>
        )}
      </div>
    </GlassPanel>
  );
}
