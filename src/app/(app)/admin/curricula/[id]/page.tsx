"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, Loader2, Workflow } from "lucide-react";
import { useAdminCurriculumDetail } from "@/hooks/admin/useAdminCurriculumFramework";
import { CurriculumFrameworkWizard } from "@/components/admin/curricula/CurriculumFrameworkWizard";
import { Button } from "@/components/ui/button";

export default function AdminCurriculumBuilderPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";

  const { data: curriculum, isLoading, error } = useAdminCurriculumDetail(id);

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          asChild
          className="border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
        >
          <Link href="/admin/curricula" className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Curriculum frameworks
          </Link>
        </Button>
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-slate-900/95 via-slate-950 to-black p-5 shadow-2xl shadow-black/40 sm:p-8">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 shadow-lg shadow-cyan-500/10">
              <Workflow className="h-6 w-6 text-cyan-200" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-white/55">Build framework</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {isLoading ? "Loading…" : curriculum?.title ?? "Framework"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
                Define subjects, then map strands and topics the same way teachers experience lesson
                notes — step by step, with a clear review at the end.
              </p>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-100">
          {error.message}
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] text-white/55">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-200" />
          <p className="text-sm">Opening framework…</p>
        </div>
      ) : curriculum ? (
        <CurriculumFrameworkWizard curriculumId={id} curriculum={curriculum} />
      ) : !error ? (
        <p className="text-sm text-white/55">Framework not found.</p>
      ) : null}
    </div>
  );
}
