"use client";

import * as React from "react";
import { use } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAdmissionCycle } from "@/hooks/admissions/useAdmissionCycles";
import { CycleWorkspace } from "@/components/admissions/cycle/CycleWorkspace";

const STATUS_STYLES: Record<string, string> = {
  draft: "border-white/10 bg-white/5 text-white/70",
  published: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  paused: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  closed: "border-rose-500/30 bg-rose-500/10 text-rose-100",
  archived: "border-white/10 bg-white/5 text-white/50",
};

type Params = Promise<{ cycleId: string }>;

export default function AdminAdmissionCyclePage({
  params,
}: {
  params: Params;
}) {
  const { cycleId } = use(params);
  const { data, isLoading, error } = useAdmissionCycle(cycleId);
  const cycle = data?.data;

  return (
    <div className="space-y-6 pb-10">
      <div>
        <Link
          href="/admin/admissions"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/55 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to admissions
        </Link>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-8 text-sm text-white/55">
          Loading cycle…
        </div>
      ) : error || !cycle ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-100">
          {error instanceof Error ? error.message : "Cycle not found"}
        </div>
      ) : (
        <>
          <section className="rounded-[1.6rem] border border-white/10 bg-slate-950/80 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-semibold text-white">
                    {cycle.name}
                  </h1>
                  <Badge
                    variant="outline"
                    className={
                      STATUS_STYLES[cycle.status] ??
                      "border-white/10 bg-white/5 text-white/70"
                    }
                  >
                    {cycle.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-white/55">
                  Cycle slug{" "}
                  <code className="rounded bg-black/30 px-1.5 py-0.5 text-[11px] text-white/85">
                    {cycle.slug}
                  </code>
                </p>
              </div>
              {cycle.status === "published" ? (
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`/apply/${cycle.schoolId}/${cycle.slug}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open public form
                    <ExternalLink className="ml-2 h-3.5 w-3.5" />
                  </a>
                </Button>
              ) : null}
            </div>
          </section>

          <CycleWorkspace cycle={cycle} />
        </>
      )}
    </div>
  );
}
