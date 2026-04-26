"use client";

import * as React from "react";
import {
  Briefcase,
  Layers3,
  ShieldCheck,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAdmissionCycles } from "@/hooks/admissions/useAdmissionCycles";
import { useAdmissionDelegate } from "@/hooks/admissions/useAdmissionDelegate";
import { AdmissionsHero } from "./AdmissionsHero";
import { CyclesTab } from "./CyclesTab";
import { DelegationTab } from "./DelegationTab";
import { CreateCycleModal } from "./CreateCycleModal";
import { AssignDelegateModal } from "./AssignDelegateModal";
import type { AdmissionCycleDTO } from "@/hooks/admissions/useAdmissionCycles";

type WorkspaceTab = "cycles" | "delegation";

type AdmissionsWorkspaceProps = {
  isAdmin: boolean;
};

const TABS: Array<{
  id: WorkspaceTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  adminOnly?: boolean;
}> = [
  {
    id: "cycles",
    label: "Cycles",
    icon: Layers3,
    description: "Create, share, and manage admission cycles.",
  },
  {
    id: "delegation",
    label: "Delegation",
    icon: ShieldCheck,
    description: "Choose who manages admissions for the school.",
  },
];

export function AdmissionsWorkspace({ isAdmin }: AdmissionsWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const admissionsBase = pathname.startsWith("/teacher")
    ? "/teacher/admissions"
    : "/admin/admissions";

  const cyclesQuery = useAdmissionCycles();
  const delegateQuery = useAdmissionDelegate();
  const cycles = cyclesQuery.data?.data ?? [];
  const delegate = delegateQuery.data?.data ?? null;

  const [activeTab, setActiveTab] = React.useState<WorkspaceTab>("cycles");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [assignDelegateOpen, setAssignDelegateOpen] = React.useState(false);

  const visibleTabs = TABS.filter((tab) => isAdmin || !tab.adminOnly);

  const handleOpenCycle = React.useCallback(
    (_cycle: AdmissionCycleDTO) => {
      router.push(`${admissionsBase}/${_cycle.id}`);
    },
    [admissionsBase, router]
  );

  return (
    <div className="space-y-8 pb-10">
      <AdmissionsHero
        cycles={cycles}
        delegate={delegate}
        isAdmin={isAdmin}
        onCreateCycle={() => setCreateOpen(true)}
        onManageDelegation={() => setAssignDelegateOpen(true)}
      />

      <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/60 p-2">
        <div className="flex flex-wrap gap-1">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition",
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-white/55 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "cycles" ? (
        <CyclesTab
          cycles={cycles}
          isLoading={cyclesQuery.isLoading}
          isAdmin={isAdmin}
          onCreate={() => setCreateOpen(true)}
          onOpenCycle={handleOpenCycle}
        />
      ) : null}

      {activeTab === "delegation" ? (
        <DelegationTab
          isAdmin={isAdmin}
          onOpenAssignDelegate={() => setAssignDelegateOpen(true)}
        />
      ) : null}

      {!isAdmin && delegate ? (
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-xs text-white/55">
          <Briefcase className="mr-2 inline h-3.5 w-3.5 align-text-bottom" />
          You are managing admissions on behalf of the school. The school admin
          can review every action you take.
        </div>
      ) : null}

      <CreateCycleModal open={createOpen} onOpenChange={setCreateOpen} />
      {isAdmin ? (
        <AssignDelegateModal
          open={assignDelegateOpen}
          onOpenChange={setAssignDelegateOpen}
          currentDelegate={delegate}
        />
      ) : null}
    </div>
  );
}
