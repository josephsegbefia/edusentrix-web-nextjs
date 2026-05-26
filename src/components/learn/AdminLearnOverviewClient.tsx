"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  BookOpenCheck,
  Compass,
  KeyRound,
  Loader2,
  Settings,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { glassInsetClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";

type OverviewPayload = {
  eligibility: {
    eligible: boolean;
    reason?: string;
    planCode?: string | null;
    planName?: string | null;
    hasLessonFeatures: boolean;
  };
  metrics: {
    eligibleStudents: number;
    activeAccounts: number;
    studentsWithoutAccounts: number;
    pendingFirstLogin: number;
    activeAccess: number;
    pendingPayments: number;
    activityThisWeek: number;
  };
  topClasses: Array<{
    classGroupId: string;
    classGroupName: string;
    activityCount: number;
  }>;
};

type ApiResponse =
  | { success: true; data: OverviewPayload }
  | { success: false; error: string };

export function AdminLearnOverviewClient() {
  const [data, setData] = React.useState<OverviewPayload | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const response = await fetch("/api/admin/learn/overview");
        const payload = (await response.json()) as ApiResponse;
        if (!response.ok || !payload.success) {
          throw new Error(payload.success ? "Failed to load Learn overview." : payload.error);
        }
        if (!cancelled) {
          setData(payload.data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load Learn overview.");
        }
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
          title="EduSentrix Learn"
          subtitle="School-level Learn access management, account readiness, and adoption visibility."
          icon={BookOpenCheck}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button
                asChild
                className="rounded-xl bg-teal-400 text-slate-950 hover:bg-teal-300"
              >
                <Link href="/admin/learn/eligible-students">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create accounts
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                <Link href="/admin/learn/accounts">
                  <KeyRound className="mr-2 h-4 w-4" />
                  Accounts
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                <Link href="/admin/learn/activity">
                  <Activity className="mr-2 h-4 w-4" />
                  Activity
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                <Link href="/admin/learn/explore-content">
                  <Compass className="mr-2 h-4 w-4" />
                  Explore QA
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                <Link href="/admin/learn/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </Button>
            </div>
          }
        />

        {loading ? (
          <GlassPanel className="p-8 text-center" glow="cyan">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-teal-200" />
            <p className="mt-3 text-sm text-white/55">Loading Learn overview...</p>
          </GlassPanel>
        ) : error ? (
          <GlassPanel className="p-8 text-center" glow="cyan">
            <p className="font-medium text-white">Could not load Learn overview.</p>
            <p className="mt-2 text-sm text-white/55">{error}</p>
          </GlassPanel>
        ) : data ? (
          <>
            {!data.eligibility.eligible ? (
              <GlassPanel className="p-6" glow="cyan">
                <h2 className="text-lg font-semibold text-white">Learn unavailable</h2>
                <p className="mt-2 text-sm text-white/60">
                  {data.eligibility.reason || "This school is not eligible for EduSentrix Learn."}
                </p>
              </GlassPanel>
            ) : null}

            <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
              <Metric label="Eligible students" value={data.metrics.eligibleStudents} />
              <Metric label="Active accounts" value={data.metrics.activeAccounts} />
              <Metric label="Without accounts" value={data.metrics.studentsWithoutAccounts} />
              <Metric label="First login pending" value={data.metrics.pendingFirstLogin} />
              <Metric label="Active access" value={data.metrics.activeAccess} />
              <Metric label="Activities this week" value={data.metrics.activityThisWeek} />
            </div>

            <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
              <GlassPanel className="p-6" glow="both">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Account readiness</h2>
                    <p className="mt-1 text-sm text-white/55">
                      Create accounts for students who are eligible but not yet provisioned.
                    </p>
                  </div>
                  <Users className="h-5 w-5 text-teal-200" />
                </div>
                <div className="mt-5 space-y-3">
                  <ProgressRow
                    label="Students with Learn accounts"
                    value={data.metrics.activeAccounts}
                    total={Math.max(1, data.metrics.eligibleStudents)}
                  />
                  <ProgressRow
                    label="Students with active access"
                    value={data.metrics.activeAccess}
                    total={Math.max(1, data.metrics.activeAccounts)}
                  />
                </div>
              </GlassPanel>

              <GlassPanel className="p-6" glow="teal">
                <h2 className="text-lg font-semibold text-white">Top active classes</h2>
                <div className="mt-4 space-y-3">
                  {data.topClasses.length ? (
                    data.topClasses.map((row) => (
                      <div
                        key={row.classGroupId}
                        className={cn(glassInsetClass, "flex items-center justify-between gap-3 p-3")}
                      >
                        <span className="text-sm font-medium text-white">
                          {row.classGroupName}
                        </span>
                        <span className="text-sm text-teal-100">
                          {row.activityCount}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/55">
                      No Learn activity has been recorded this week.
                    </p>
                  )}
                </div>
              </GlassPanel>
            </div>
          </>
        ) : null}
      </WorkspacePageShell>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <GlassPanel className="p-4" glow="cyan">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-white">{value.toLocaleString()}</p>
    </GlassPanel>
  );
}

function ProgressRow({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const percent = Math.min(100, Math.round((value / total) * 100));
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-white/65">{label}</span>
        <span className="font-medium text-white">{percent}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-teal-300" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
