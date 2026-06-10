"use client";

import * as React from "react";
import { CalendarDays, School, ShieldCheck, UserCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { Badge } from "@/components/ui/badge";
import { CurrentSchemeWeekBadge } from "@/components/schemes/CurrentSchemeWeekBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function TeacherHeader() {
  const { data, isLoading } = useTeacherContext();
  const context = data?.data;
  const teacher = context?.teacher;
  const school = context?.school;
  const period = context?.currentPeriod;

  const initials = teacher?.displayName
    ? teacher.displayName
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "TR";

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-white/5 via-white/5 to-transparent p-6 shadow-2xl shadow-black/30 backdrop-blur">
      <div
        className="pointer-events-none absolute inset-0 bg-linear-to-br from-indigo-500/15 via-indigo-500/5 to-transparent"
        aria-hidden="true"
      />
      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-inner">
            {teacher?.photoUrl ? (
              <Avatar className="h-12 w-12">
                <AvatarImage src={teacher.photoUrl} alt={teacher.displayName} />
                <AvatarFallback className="bg-white/10 text-white/70">
                  {initials}
                </AvatarFallback>
              </Avatar>
            ) : (
              <UserCircle2 className="h-7 w-7 text-white/60" />
            )}
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/50">
              Teacher Portal
            </p>
            <div className="text-2xl font-semibold text-white sm:text-3xl">
              {isLoading ? (
                <span className="inline-block h-8 w-56 animate-pulse rounded-xl bg-white/10" />
              ) : (
                <>Welcome back, {teacher?.firstName || teacher?.displayName || "Teacher"}</>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-white/60">
              <span className="inline-flex items-center gap-2">
                <School className="h-4 w-4 text-white/40" />
                {school?.name || "School"}
              </span>
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-white/40" />
                {period?.name || "No active term"}
              </span>
              <CurrentSchemeWeekBadge />
              {teacher?.homeroomClassName && (
                <Badge
                  className={cn(
                    "border border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                  )}
                >
                  Homeroom - {teacher.homeroomClassName}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-white/40">
              Permissions
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm text-white/80">
              <ShieldCheck className="h-4 w-4 text-indigo-300" />
              {context?.permissions?.length ?? 0} enabled
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
