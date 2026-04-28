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
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
            Academic Periods
          </h1>
          <p className="mt-1 text-sm text-white/60">
            Manage terms, set the current period, and view summaries
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="gap-2 bg-brand text-black hover:bg-brand/90"
        >
          <Plus className="h-4 w-4" />
          Create Period
        </Button>
      </div>

      {isLoading ? (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="flex items-center justify-center gap-2 py-12">
            <Loader2 className="h-5 w-5 animate-spin text-white/60" />
            <span className="text-sm text-white/60">Loading periods...</span>
          </CardContent>
        </Card>
      ) : periods.length === 0 ? (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="py-12 text-center">
            <Calendar className="mx-auto h-12 w-12 text-white/30" />
            <p className="mt-3 font-medium text-white">No academic periods yet</p>
            <p className="mt-1 text-sm text-white/60">
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
          <Card className="border-white/10 bg-white/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-white">
                All Periods
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-white/60">
                        Year · Term
                      </th>
                      <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-white/60">
                        Dates
                      </th>
                      <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-white/60">
                        Status
                      </th>
                      <th className="pb-3 text-right text-xs font-medium uppercase tracking-wider text-white/60">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map((period) => (
                      <tr
                        key={period._id}
                        className="border-b border-white/5 last:border-0"
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
