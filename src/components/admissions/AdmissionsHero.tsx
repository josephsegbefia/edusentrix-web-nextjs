"use client";

import * as React from "react";
import {
  ClipboardSignature,
  Eye,
  Plus,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeoIcon } from "@/components/icons/LeoIcon";
import type { AdmissionCycleDTO } from "@/hooks/admissions/useAdmissionCycles";
import type { AdmissionDelegateDTO } from "@/hooks/admissions/useAdmissionDelegate";

type AdmissionsHeroProps = {
  cycles: AdmissionCycleDTO[];
  delegate: AdmissionDelegateDTO;
  isAdmin: boolean;
  onCreateCycle: () => void;
  onManageDelegation: () => void;
};

function formatStatus(value?: string) {
  if (!value) return "Not started";
  return value
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

export function AdmissionsHero({
  cycles,
  delegate,
  isAdmin,
  onCreateCycle,
  onManageDelegation,
}: AdmissionsHeroProps) {
  const liveCycles = cycles.filter(
    (cycle) => cycle.status === "published" || cycle.status === "paused"
  );
  const draftCycles = cycles.filter((cycle) => cycle.status === "draft");
  const latestCycle = cycles[0];

  const totalSubmissions = cycles.reduce(
    (acc, cycle) => acc + (cycle.analytics?.totalSubmissions ?? 0),
    0
  );

  const nextAction = !latestCycle
    ? "Create the first admission cycle"
    : draftCycles.length > 0 && liveCycles.length === 0
      ? "Publish the draft cycle"
      : liveCycles.length > 0
        ? "Review incoming applications"
        : "Open a new cycle";

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
      <section className="relative overflow-hidden rounded-[1.8rem] border border-cyan-500/20 bg-linear-to-br from-cyan-950/40 via-slate-950 to-slate-950 p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_45%)]" />
        <div className="relative space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/3 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">
            <ClipboardSignature className="h-3.5 w-3.5" />
            School Admissions
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-[2.4rem]">
              Make admissions feel effortless for families and your team.
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-white/65 sm:text-base">
              Open intake cycles, share your application link anywhere, review
              applicants in one place, and provision new students automatically
              once you accept. Leo can help you craft questions, draft replies,
              and spot risks along the way.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/3 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                Live cycles
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {liveCycles.length}
              </p>
              <p className="mt-1 text-sm text-white/50">
                {liveCycles.length > 0
                  ? "Accepting applications"
                  : "No published cycle yet"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/3 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                Latest cycle
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {latestCycle?.name ?? "No cycle yet"}
              </p>
              <p className="mt-1 text-sm text-white/50">
                {latestCycle ? formatStatus(latestCycle.status) : "Open one to begin"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/3 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                Applications received
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {totalSubmissions}
              </p>
              <p className="mt-1 text-sm text-white/50">Across all cycles</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {isAdmin ? (
              <Button onClick={onCreateCycle} className="gap-2">
                <Plus className="h-4 w-4" />
                Open a new cycle
              </Button>
            ) : null}
            {isAdmin ? (
              <Button
                variant="outline"
                className="gap-2 border-white/10 bg-white/3 text-white hover:bg-white/8"
                onClick={onManageDelegation}
              >
                <UserPlus className="h-4 w-4" />
                {delegate ? "Manage delegate" : "Delegate to a teacher"}
              </Button>
            ) : null}
            {!isAdmin ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">
                <ShieldCheck className="h-3.5 w-3.5" />
                Delegated by school admin
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-[1.8rem] border border-white/10 bg-slate-950/80 p-6 sm:p-7">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
            <LeoIcon className="h-5 w-5 text-cyan-100" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/35">
              Leo admissions guide
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              {!latestCycle
                ? "Start with one cycle this term"
                : nextAction}
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/70">
              {!latestCycle
                ? "Open a cycle for the upcoming intake. Leo will seed the standard form with everything the platform needs to create students and parents automatically when you accept an application."
                : "Leo will keep an eye on capacity, missing documents, and slow-moving applications. You can ask Leo to draft acceptance letters or check what is left to decide."}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3 rounded-[1.4rem] border border-white/10 bg-black/10 p-4">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Eye className="h-4 w-4 text-cyan-100" />
            <span>Public link, QR code, embed, WhatsApp, and direct invites.</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Users className="h-4 w-4 text-cyan-100" />
            <span>
              {delegate
                ? `${delegate.firstName} ${delegate.lastName} can manage on your behalf.`
                : "Delegate day-to-day admissions to a trusted teacher."}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/70">
            <ClipboardSignature className="h-4 w-4 text-cyan-100" />
            <span>
              Required questions stay locked so student records stay clean.
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
