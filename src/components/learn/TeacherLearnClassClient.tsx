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
import { LearnJourneyOversightPanel } from "@/components/learn/LearnJourneyOversightPanel";
import type { LearnClassJourneyOversight } from "@/lib/learn/journey-oversight";

type ClassDetail = {
  classGroup: { id: string; name: string };
  students: Array<{
    id: string;
    name: string;
    admissionNo: string | null;
    accountStatus: string | null;
    activityCount: number;
  }>;
  events: Array<{ eventType: string; label: string; count: number }>;
  journeyOversight: LearnClassJourneyOversight;
};

type ApiResponse =
  | { success: true; data: ClassDetail }
  | { success: false; error: string };

export function TeacherLearnClassClient({ classGroupId }: { classGroupId: string }) {
  const [data, setData] = React.useState<ClassDetail | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/teacher/learn/classes/${classGroupId}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as ApiResponse;
        if (!response.ok || !payload.success) {
          throw new Error(payload.success ? "Failed to load class." : payload.error);
        }
        if (!cancelled) setData(payload.data);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load class.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [classGroupId]);

  return (
    <div className="p-6 text-white md:p-8">
      <WorkspacePageShell>
        <WorkspacePageHeader
          title={data?.classGroup.name || "Learn class"}
          subtitle="Student Learn activity in this class for the last 30 days."
          icon={BookOpenCheck}
          backHref="/teacher/learn"
          backLabel="Back to Learn"
        />

        {loading ? (
          <GlassPanel className="p-8 text-center" glow="cyan">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-teal-200" />
            <p className="mt-3 text-sm text-white/55">Loading class activity...</p>
          </GlassPanel>
        ) : data ? (
          <>
            <LearnJourneyOversightPanel mode="aggregate" oversight={data.journeyOversight} />

            <div className="grid gap-5 lg:grid-cols-[1fr_0.75fr]">
            <GlassPanel className="p-6" glow="both">
              <h2 className="text-lg font-semibold text-white">Students</h2>
              <div className="mt-4 space-y-3">
                {data.students.length ? (
                  data.students.map((student) => (
                    <div key={student.id} className={cn(glassInsetClass, "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between")}>
                      <div>
                        <p className="font-semibold text-white">{student.name}</p>
                        <p className="mt-1 text-sm text-white/50">
                          {student.admissionNo || "No admission number"} - {student.accountStatus?.replace(/_/g, " ") || "No Learn account"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-teal-100">{student.activityCount} events</span>
                        <Button asChild size="sm" className="rounded-xl bg-teal-400 text-slate-950 hover:bg-teal-300">
                          <Link href={`/teacher/learn/student/${student.id}`}>Open</Link>
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/55">
                    No active students found in this class.
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
                      <span className="text-sm font-semibold text-teal-100">{event.count}</span>
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/55">
                    No Learn activity has been recorded for this class.
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
