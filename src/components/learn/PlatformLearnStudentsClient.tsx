"use client";

import * as React from "react";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { glassInsetClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";

type StudentRow = {
  accountId: string;
  schoolName: string;
  studentName: string;
  username: string;
  status: string;
  mustChangePassword: boolean;
  activeAccess: { source: string; expiresAt: string } | null;
};

type ApiResponse =
  | { success: true; data: { students: StudentRow[] } }
  | { success: false; error: string };

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-GH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function PlatformLearnStudentsClient() {
  const [students, setStudents] = React.useState<StudentRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/platform/learn/students", { cache: "no-store" });
        const payload = (await response.json()) as ApiResponse;
        if (!response.ok || !payload.success) {
          throw new Error(payload.success ? "Failed to load students." : payload.error);
        }
        if (!cancelled) setStudents(payload.data.students);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load students.");
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
          title="Learn students"
          subtitle="Cross-school Learn account and active access status. Passwords are never shown."
          icon={Users}
          backHref="/platform/learn"
          backLabel="Back to Learn"
        />
        <GlassPanel className="p-6" glow="both">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-white/55">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading students...
            </p>
          ) : (
            <div className="space-y-3">
              {students.map((student) => (
                <div key={student.accountId} className={cn(glassInsetClass, "p-4")}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-semibold text-white">{student.studentName}</p>
                      <p className="mt-1 text-sm text-white/50">{student.schoolName}</p>
                    </div>
                    <div className="grid gap-3 text-sm sm:grid-cols-4 lg:min-w-[680px]">
                      <Info label="Username" value={student.username} />
                      <Info label="Status" value={student.status.replace(/_/g, " ")} />
                      <Info
                        label="First login"
                        value={student.mustChangePassword ? "Pending" : "Complete"}
                      />
                      <Info
                        label="Access"
                        value={
                          student.activeAccess
                            ? `${student.activeAccess.source.replace(/_/g, " ")} until ${shortDate(student.activeAccess.expiresAt)}`
                            : "No active access"
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
              {!students.length ? (
                <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/55">
                  No Learn student accounts found.
                </p>
              ) : null}
            </div>
          )}
        </GlassPanel>
      </WorkspacePageShell>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/35">{label}</p>
      <p className="mt-1 capitalize text-white/80">{value}</p>
    </div>
  );
}
