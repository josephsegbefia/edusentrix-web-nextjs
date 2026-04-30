"use client";

import Link from "next/link";
import type React from "react";
import type { LucideIcon } from "lucide-react";
import { BookOpenCheck, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const libraryGlassPanel =
  "relative overflow-hidden rounded-xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl sm:rounded-2xl";

export function LibraryPageShell({ children }: { children: React.ReactNode }) {
  return <div className="space-y-6 sm:space-y-8">{children}</div>;
}

export function LibraryBackLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Button asChild variant="ghost" size="sm" className="text-white/65 hover:bg-white/5 hover:text-white">
      <Link href={href}>
        <ChevronLeft className="mr-1 h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}

export function LibraryPageHeader({
  icon: Icon = BookOpenCheck,
  title,
  description,
  actions,
  eyebrow = "Library",
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/90 via-slate-950/95 to-black p-5 shadow-2xl shadow-black/40 sm:rounded-3xl sm:p-8">
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-linear-to-br from-teal-500/20 via-cyan-500/10 to-transparent blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-linear-to-tr from-sky-500/10 via-blue-500/5 to-transparent blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col gap-4 sm:gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-linear-to-br from-teal-500/20 to-cyan-500/20 shadow-lg shadow-teal-500/10 sm:h-12 sm:w-12 sm:rounded-2xl">
            <Icon className="h-5 w-5 text-teal-300 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-white/60 sm:text-sm">{eyebrow}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
            <p className="mt-2 hidden max-w-2xl text-sm leading-relaxed text-white/50 sm:block">{description}</p>
          </div>
        </div>
        {actions ? <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 md:justify-end">{actions}</div> : null}
      </div>
    </div>
  );
}

export function LibraryStatCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "cyan",
}: {
  label: string;
  value: React.ReactNode;
  helper: string;
  icon: LucideIcon;
  tone?: "cyan" | "emerald" | "amber" | "violet";
}) {
  const tones = {
    cyan: "border-cyan-300/20 bg-cyan-400/10 text-cyan-200",
    emerald: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200",
    amber: "border-amber-300/20 bg-amber-400/10 text-amber-200",
    violet: "border-violet-300/20 bg-violet-400/10 text-violet-200",
  };

  return (
    <Card className="relative overflow-hidden rounded-xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl sm:rounded-2xl">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-teal-500/5 via-transparent to-transparent"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
        aria-hidden="true"
      />
      <CardContent className="relative z-10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-white/45">{label}</p>
            <div className="mt-2 text-3xl font-semibold text-white">{value}</div>
          </div>
          <div className={cn("rounded-xl border p-2", tones[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-3 text-sm leading-5 text-white/50">{helper}</p>
      </CardContent>
    </Card>
  );
}

export function LibraryEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-white/15 bg-linear-to-br from-white/10 to-white/5 p-8 text-center">
      <BookOpenCheck className="mx-auto h-9 w-9 text-white/30" />
      <h3 className="mt-3 text-base font-semibold text-white">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-white/52">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
