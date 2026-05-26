"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpenCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { glassInsetClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";

type Overview = {
  rangeDays: number;
  classes: Array<{
    classGroupId: string;
    classGroupName: string;
    gradeName: string | null;
    studentCount: number;
    studentsWithAccounts: number;
    activityCount: number;
  }>;
  totals: {
    assignedClasses: number;
    students: number;
    studentsWithAccounts: number;
    activity: number;
  };
  events: Array<{ eventType: string; label: string; count: number }>;
};

type ApiResponse =
  | { success: true; data: Overview }
  | { success: false; error: string };

export function TeacherLearnOverviewClient() {
  const [data, setData] = React.useState<Overview | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/teacher/learn/overview", { cache: "no-store" });
        const payload = (await response.json()) as ApiResponse;
        if (!response.ok || !payload.success) {
          throw new Error(payload.success ? "Failed to load Learn." : payload.error);
        }
        if (!cancelled) setData(payload.data);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load Learn.");
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
          subtitle="Learn activity from classes and students in your teaching scope."
          icon={BookOpenCheck}
          actions={
            <>
              <Button
                asChild
                variant="outline"
                className="rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                <Link href="/teacher/learn/activity">Activity</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                <Link href="/teacher/learn/explore-content">Explore QA</Link>
              </Button>
            </>
          }
        />

        {loading ? (
          <GlassPanel className="p-8 text-center" glow="cyan">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-teal-200" />
            <p className="mt-3 text-sm text-white/55">Loading Learn activity...</p>
          </GlassPanel>
        ) : data ? (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Metric label="Classes" value={data.totals.assignedClasses} />
              <Metric label="Students" value={data.totals.students} />
              <Metric label="With accounts" value={data.totals.studentsWithAccounts} />
              <Metric label="Activity" value={data.totals.activity} />
            </div>

            <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
              <GlassPanel className="p-6" glow="both">
                <h2 className="text-lg font-semibold text-white">Your classes</h2>
                <div className="mt-4 space-y-3">
                  {data.classes.length ? (
                    data.classes.map((row) => (
                      <div key={row.classGroupId} className={cn(glassInsetClass, "p-4")}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-semibold text-white">
                              {[row.gradeName, row.classGroupName].filter(Boolean).join(" ")}
                            </p>
                            <p className="mt-1 text-sm text-white/50">
                              {row.studentsWithAccounts} of {row.studentCount} students have Learn accounts
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-teal-100">
                              {row.activityCount.toLocaleString()} events
                            </span>
                            <Button
                              asChild
                              size="sm"
                              className="rounded-xl bg-teal-400 text-slate-950 hover:bg-teal-300"
                            >
                              <Link href={`/teacher/learn/class/${row.classGroupId}`}>Open</Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/55">
                      No assigned classes found for the current academic period.
                    </p>
                  )}
                </div>
              </GlassPanel>

              <GlassPanel className="p-6" glow="teal">
                <h2 className="text-lg font-semibold text-white">Activity mix</h2>
                <div className="mt-4 space-y-3">
                  {data.events.length ? (
                    data.events.map((event) => (
                      <div key={event.eventType} className={cn(glassInsetClass, "flex items-center justify-between gap-3 p-3")}>
                        <span className="text-sm text-white/75">{event.label}</span>
                        <span className="text-sm font-semibold text-teal-100">{event.count.toLocaleString()}</span>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/55">
                      No Learn activity has been recorded in your classes in the last {data.rangeDays} days.
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
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value.toLocaleString()}</p>
    </GlassPanel>
  );
}
