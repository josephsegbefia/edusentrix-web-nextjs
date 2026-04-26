"use client";

import * as React from "react";
import {
  BarChart3,
  ClipboardList,
  FormInput,
  History,
  Inbox,
  Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdmissionCycleDTO } from "@/hooks/admissions/useAdmissionCycles";
import { ApplicationsInboxTab } from "./ApplicationsInboxTab";
import { FormBuilderTab } from "./FormBuilderTab";
import { DistributionTab } from "./DistributionTab";
import { CycleOverviewTab } from "./CycleOverviewTab";
import { AuditTab } from "./AuditTab";
import { AnalyticsTab } from "./AnalyticsTab";
import { AdmissionsOnboardingTour } from "./AdmissionsOnboardingTour";

type WorkspaceTab =
  | "overview"
  | "applications"
  | "analytics"
  | "form"
  | "distribution"
  | "audit";

const TABS: Array<{
  id: WorkspaceTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "overview", label: "Overview", icon: ClipboardList },
  { id: "applications", label: "Applications", icon: Inbox },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "form", label: "Form builder", icon: FormInput },
  { id: "distribution", label: "Distribution", icon: Share2 },
  { id: "audit", label: "Audit", icon: History },
];

type CycleWorkspaceProps = {
  cycle: AdmissionCycleDTO;
};

export function CycleWorkspace({ cycle }: CycleWorkspaceProps) {
  const [tab, setTab] = React.useState<WorkspaceTab>(() => {
    if (typeof window === "undefined") return "overview";
    const hash = window.location.hash.replace("#", "");
    if (
      hash === "applications" ||
      hash === "form" ||
      hash === "distribution" ||
      hash === "overview" ||
      hash === "audit" ||
      hash === "analytics"
    ) {
      return hash;
    }
    return "overview";
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (tab === "overview") {
      history.replaceState(null, "", window.location.pathname);
    } else {
      history.replaceState(null, "", `${window.location.pathname}#${tab}`);
    }
  }, [tab]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-2">
        <div className="flex flex-wrap gap-1">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = id === tab;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition",
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/55 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "overview" ? <CycleOverviewTab cycle={cycle} /> : null}
      {tab === "applications" ? (
        <ApplicationsInboxTab cycleId={cycle.id} />
      ) : null}
      {tab === "analytics" ? <AnalyticsTab cycleId={cycle.id} /> : null}
      {tab === "form" ? <FormBuilderTab cycleId={cycle.id} /> : null}
      {tab === "distribution" ? <DistributionTab cycle={cycle} /> : null}
      {tab === "audit" ? <AuditTab cycleId={cycle.id} /> : null}

      <AdmissionsOnboardingTour />
    </div>
  );
}
