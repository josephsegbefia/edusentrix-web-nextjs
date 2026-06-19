"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpenCheck, Compass, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { glassInsetClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import { LearnJourneyOversightPanel } from "@/components/learn/LearnJourneyOversightPanel";
import type { LearnStudentJourneyOversight } from "@/lib/learn/journey-oversight";
import { LearnJourneyOversightPanel } from "@/components/learn/LearnJourneyOversightPanel";
import type { LearnStudentJourneyOversight } from "@/lib/learn/journey-oversight";

type StudentDetail = {
  student: {
    name: string;
    admissionNo: string | null;
    accountStatus: string | null;
    mustChangePassword: boolean;
    lastLoginAt: string | null;
  };
  events: Array<{ eventType: string; label: string; count: number }>;
  recentEvents: Array<{
    eventType: string;
    label: string;
    occurredAt: string;
    topic: string | null;
    score: number | null;
  journeyOversight: LearnStudentJourneyOversight;
    durationSeconds: number | null;
  }>;
};

type ApiResponse =
  | { success: true; data: StudentDetail }
  | { success: false; error: string };

function shortDate(value: string | null) {
  if (!value) return "No login yet";
  return new Intl.DateTimeFormat("en-GH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function TeacherLearnStudentClient({ studentId }: { studentId: string }) {
  const [data, setData] = React.useState<StudentDetail | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/teacher/learn/students/${studentId}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as ApiResponse;
        if (!response.ok || !payload.success) {
          throw new Error(payload.success ? "Failed to load student." : payload.error);
        }
        if (!cancelled) setData(payload.data);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load student.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  return (
    <div className="p-6 text-white md:p-8">
      <WorkspacePageShell>
        <WorkspacePageHeader
          title={data?.student.name || "Student Learn activity"}
          subtitle="Learning activity visible within your teaching scope."
          icon={BookOpenCheck}
          backHref="/teacher/learn"
          backLabel="Back to Learn"
        />

        {loading ? (
          <GlassPanel className="p-8 text-center" glow="cyan">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-teal-200" />
            <p className="mt-3 text-sm text-white/55">Loading student activity...</p>
          </GlassPanel>
        ) : data ? (
          <>
            <GlassPanel className="p-5" glow="teal">
              <div className="grid gap-4 md:grid-cols-4">
                <Info label="Admission" value={data.student.admissionNo || "Not set"} />
                <Info label="Account" value={data.student.accountStatus?.replace(/_/g, " ") || "No account"} />
                <Info label="First login" value={data.student.mustChangePassword ? "Pending" : "Complete"} />
                <Info label="Last login" value={shortDate(data.student.lastLoginAt)} />
              </div>
            <LearnJourneyOversightPanel mode="student" oversight={data.journeyOversight} />

            </GlassPanel>

            <GlassPanel className="p-5" glow="cyan">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">Explore AI content</h2>
                  <p className="mt-1 text-sm text-white/55">
                    Review readings, fun facts, and quizzes Leo showed this student.
                  </p>
                </div>
                <Button
                  asChild
                  variant="outline"
                  className="rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  <Link href={`/teacher/learn/student/${studentId}/explore`}>
                    <Compass className="mr-2 h-4 w-4" />
                    Open Explore QA
                  </Link>
                </Button>
              </div>
            </GlassPanel>

            <div className="grid gap-5 lg:grid-cols-[0.8fr_1fr]">
              <GlassPanel className="p-6" glow="cyan">
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
                      No Learn activity has been recorded for this student.
                    </p>
                  )}
                </div>
              </GlassPanel>

              <GlassPanel className="p-6" glow="both">
                <h2 className="text-lg font-semibold text-white">Recent events</h2>
                <div className="mt-4 space-y-3">
                  {data.recentEvents.length ? (
                    data.recentEvents.map((event, index) => (
                      <div key={`${event.eventType}-${event.occurredAt}-${index}`} className={cn(glassInsetClass, "p-4")}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-white">{event.label}</p>
                          <p className="text-xs text-white/45">{shortDate(event.occurredAt)}</p>
                        </div>
                        <p className="mt-2 text-sm text-white/55">{event.topic || "No topic recorded"}</p>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/55">
                      No recent events found.
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">{label}</p>
      <p className="mt-1 capitalize text-white">{value}</p>
    </div>
  );
}
