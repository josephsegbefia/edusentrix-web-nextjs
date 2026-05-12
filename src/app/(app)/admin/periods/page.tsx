"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  Calendar,
  Check,
  FileText,
  Loader2,
  Plus,
  Sparkles,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useAcademicPeriods,
  useCreatePeriod,
  useSetCurrentPeriod,
} from "@/hooks/admin/useAcademicPeriods";
import { useBusyToast } from "@/hooks/useBusyToast";
import CreateAcademicPeriodModal from "@/components/modals/CreateAcademicPeriodModal";
import { cn } from "@/lib/utils";

const glassPanel =
  "relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/35 backdrop-blur-xl";

function formatDateRange(start?: string | Date, end?: string | Date) {
  if (!start || !end) return "—";
  const s = typeof start === "string" ? new Date(start) : start;
  const e = typeof end === "string" ? new Date(end) : end;
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "—";
  return `${format(s, "dd MMM yyyy")} – ${format(e, "dd MMM yyyy")}`;
}

function getStatusBadge(
  period: { startDate?: string | Date; endDate?: string | Date; isCurrent?: boolean }
) {
  const now = new Date();
  const start = period.startDate ? new Date(period.startDate) : null;
  const end = period.endDate ? new Date(period.endDate) : null;

  if (period.isCurrent) {
    return (
      <Badge className="border-emerald-500/40 bg-emerald-500/20 text-emerald-300">
        <Star className="mr-1 h-3 w-3" />
        Current
      </Badge>
    );
  }

  if (end && now > end) {
    return (
      <Badge variant="outline" className="border-white/20 text-white/60">
        Expired
      </Badge>
    );
  }

  if (start && now < start) {
    return (
      <Badge variant="outline" className="border-amber-500/40 text-amber-300">
        Upcoming
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-white/20 text-white/70">
      Active
    </Badge>
  );
}

export default function PeriodsPage() {
  const busy = useBusyToast();
  const [createOpen, setCreateOpen] = React.useState(false);

  const periodsQuery = useAcademicPeriods();
  const createMutation = useCreatePeriod();
  const setCurrentMutation = useSetCurrentPeriod();

  const periods = periodsQuery.data?.periods ?? [];
  const isLoading = periodsQuery.isLoading;
  const currentCount = periods.filter((p) => p.isCurrent).length;

  const handleCreate = async (payload: {
    yearLabel: string;
    term: string;
    startDate: string;
    endDate: string;
    isYearEndTerminal?: boolean;
  }) => {
    await busy.promise(
      createMutation.mutateAsync(payload),
      {
        loading: "Creating period...",
        success: "Period created and set as current",
        error: (e) => (e instanceof Error ? e.message : "Failed to create period"),
      }
    );
    setCreateOpen(false);
  };

  const handleSetCurrent = async (periodId: string) => {
    await busy.promise(
      setCurrentMutation.mutateAsync(periodId),
      {
        loading: "Setting current period...",
        success: "Current period updated",
        error: (e) =>
          e instanceof Error ? e.message : "Failed to set current period",
      }
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-4 md:p-6">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-slate-900/95 via-slate-950 to-black p-5 shadow-2xl shadow-black/40 sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70 backdrop-blur-sm">
              <Calendar className="h-3.5 w-3.5 text-sky-200" />
              Terms & academic years
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Academic Periods
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
              Manage terms, set the current period for your school, and open each period&apos;s
              dashboard for reports and configuration.
            </p>
          </div>
          <div className="grid w-full gap-2 sm:grid-cols-3 lg:max-w-xl">
            {[
              { icon: Plus, label: "Create", text: "Add year · term" },
              { icon: Star, label: "Current", text: "One active period" },
              { icon: FileText, label: "Dashboard", text: "Per-period tools" },
            ].map((step) => (
              <div
                key={step.label}
                className="rounded-xl border border-white/10 bg-white/4 p-3 backdrop-blur-sm"
              >
                <step.icon className="h-4 w-4 text-sky-200" />
                <p className="mt-2 text-sm font-medium text-white">{step.label}</p>
                <p className="mt-0.5 text-xs text-white/45">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10 mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Button
            onClick={() => setCreateOpen(true)}
            className="w-full gap-2 bg-brand text-black hover:bg-brand/90 sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Create Period
          </Button>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-white/10 bg-white/4 p-4 backdrop-blur-md">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-sky-300/20 bg-sky-500/10 p-2">
              <Sparkles className="h-5 w-5 text-sky-100" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">What admins do here</h2>
              <p className="mt-1 text-sm leading-6 text-white/55">
                Periods anchor timetables, calendars, and reporting. Mark exactly one as current so
                the rest of the product knows which term you are in.
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/4 p-4 backdrop-blur-md">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-white/15 bg-white/5 text-white/65">
              {periods.length} period{periods.length === 1 ? "" : "s"}
            </Badge>
            {currentCount > 0 ? (
              <Badge variant="outline" className="border-emerald-300/25 bg-emerald-500/10 text-emerald-100">
                Current term set
              </Badge>
            ) : !isLoading ? (
              <Badge variant="outline" className="border-amber-300/30 bg-amber-500/10 text-amber-100">
                No current period
              </Badge>
            ) : null}
          </div>
          <p className="mt-3 text-xs leading-5 text-white/45">
            Year-end terminal periods can be flagged when creating a term for rollover workflows.
          </p>
        </div>
      </section>

      {isLoading ? (
        <Card className={glassPanel}>
          <CardContent className="flex items-center justify-center gap-2 py-12">
            <Loader2 className="h-5 w-5 animate-spin text-sky-200" />
            <span className="text-sm text-white/60">Loading periods...</span>
          </CardContent>
        </Card>
      ) : periods.length === 0 ? (
        <Card className={glassPanel}>
          <CardContent className="py-12 text-center">
            <div
              className={cn(
                "mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10",
                "bg-white/6 backdrop-blur-sm"
              )}
            >
              <Calendar className="h-8 w-8 text-sky-200/70" />
            </div>
            <p className="mt-4 font-medium text-white">No academic periods yet</p>
            <p className="mt-1 text-sm text-white/55">
              Create your first period to start using the system
            </p>
            <Button
              onClick={() => setCreateOpen(true)}
              className="mt-4 gap-2 bg-brand text-black hover:bg-brand/90"
            >
              <Plus className="h-4 w-4" />
              Create Period
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className={glassPanel}>
            <CardHeader className="border-b border-white/10 pb-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-lg font-semibold text-white">All periods</CardTitle>
                <Badge variant="outline" className="w-fit border-white/15 bg-white/5 text-white/60">
                  {periods.length} total
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      <th className="px-1 pb-3 pt-1 text-left text-xs font-medium uppercase tracking-wider text-white/55 first:rounded-tl-lg">
                        Year · Term
                      </th>
                      <th className="px-1 pb-3 pt-1 text-left text-xs font-medium uppercase tracking-wider text-white/55">
                        Dates
                      </th>
                      <th className="px-1 pb-3 pt-1 text-left text-xs font-medium uppercase tracking-wider text-white/55">
                        Status
                      </th>
                      <th className="px-1 pb-3 pt-1 text-right text-xs font-medium uppercase tracking-wider text-white/55 last:rounded-tr-lg">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map((period) => (
                      <tr
                        key={period._id}
                        className="border-b border-white/5 transition-colors last:border-0 hover:bg-white/4"
                      >
                        <td className="py-4">
                          <span className="font-medium text-white">
                            {period.yearLabel} · {period.term}
                          </span>
                        </td>
                        <td className="py-4 text-sm text-white/70">
                          {formatDateRange(period.startDate, period.endDate)}
                        </td>
                        <td className="py-4">{getStatusBadge(period)}</td>
                        <td className="py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {period.isYearEndTerminal ? (
                              <Badge
                                variant="outline"
                                className="border-cyan-500/40 text-cyan-300"
                              >
                                Year End
                              </Badge>
                            ) : null}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-white/80 hover:bg-white/10 hover:text-white"
                              asChild
                            >
                              <Link href={`/admin/periods/${period._id}`}>
                                <FileText className="mr-1.5 h-3.5 w-3.5" />
                                View Dashboard
                              </Link>
                            </Button>
                            {!period.isCurrent && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-white/20 text-white/80 hover:bg-white/10 hover:text-white"
                                onClick={() => handleSetCurrent(period._id)}
                                disabled={setCurrentMutation.isPending}
                              >
                                {setCurrentMutation.isPending ? (
                                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="mr-1.5 h-3.5 w-3.5" />
                                )}
                                Set Current
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <CreateAcademicPeriodModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        isLoading={createMutation.isPending}
        periods={periods}
      />
    </div>
  );
}
