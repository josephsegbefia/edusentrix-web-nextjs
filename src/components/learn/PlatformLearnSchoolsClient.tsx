"use client";

import * as React from "react";
import { Landmark, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { glassInsetClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";

type SchoolRow = {
  schoolId: string;
  schoolName: string;
  status: string;
  eligibility: { eligible: boolean; reason?: string; planName?: string | null };
  accounts: number;
  activeAccess: number;
};

type ApiResponse =
  | { success: true; data: { schools: SchoolRow[] } }
  | { success: false; error: string };

export function PlatformLearnSchoolsClient() {
  const [schools, setSchools] = React.useState<SchoolRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/platform/learn/schools", { cache: "no-store" });
        const payload = (await response.json()) as ApiResponse;
        if (!response.ok || !payload.success) {
          throw new Error(payload.success ? "Failed to load schools." : payload.error);
        }
        if (!cancelled) setSchools(payload.data.schools);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load schools.");
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
          title="Learn schools"
          subtitle="School eligibility, account volume, and active Learn access."
          icon={Landmark}
          backHref="/platform/learn"
          backLabel="Back to Learn"
        />
        <GlassPanel className="p-6" glow="both">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-white/55">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading schools...
            </p>
          ) : (
            <div className="space-y-3">
              {schools.map((school) => (
                <div key={school.schoolId} className={cn(glassInsetClass, "p-4")}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-semibold text-white">{school.schoolName}</p>
                      <p className="mt-1 text-sm text-white/50">
                        {school.eligibility.planName || "No plan"} - {school.status}
                      </p>
                    </div>
                    <div className="grid gap-3 text-sm sm:grid-cols-3 lg:min-w-[520px]">
                      <Info
                        label="Eligibility"
                        value={school.eligibility.eligible ? "Eligible" : school.eligibility.reason || "Not eligible"}
                      />
                      <Info label="Accounts" value={school.accounts.toLocaleString()} />
                      <Info label="Active access" value={school.activeAccess.toLocaleString()} />
                    </div>
                  </div>
                </div>
              ))}
              {!schools.length ? (
                <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/55">
                  No schools found.
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
      <p className="mt-1 line-clamp-2 text-white/80">{value}</p>
    </div>
  );
}
