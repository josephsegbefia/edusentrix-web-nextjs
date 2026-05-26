"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  glassPanelClass,
  glassPanelTopShineClass,
  glassInsetClass,
} from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";

type SessionRow = {
  id: string;
  title: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  dayOfWeek: number;
  teacherName: string;
  teacherId: string;
  classGroupName: string;
  classGroupId: string;
  subjectName: string;
  subjectOfferingId: string;
  deliveryStatus: "completed" | "in_progress" | "not_started";
  completedAt: string | null;
  contentBlockCount: number;
  assessmentItemCount: number;
  status: string;
};

type Stats = {
  total: number;
  delivered: number;
  inProgress: number;
  pending: number;
};

type ApiResponse = {
  success: boolean;
  data: {
    sessions: SessionRow[];
    stats: Stats;
    pagination: { page: number; limit: number; total: number; pages: number };
  };
  error?: string;
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DELIVERY_STATUS_LABELS: Record<SessionRow["deliveryStatus"], string> = {
  completed: "Delivered",
  in_progress: "In progress",
  not_started: "Not started",
};

const DELIVERY_STATUS_STYLES: Record<SessionRow["deliveryStatus"], string> = {
  completed: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  in_progress: "border-teal-400/30 bg-teal-500/10 text-teal-200",
  not_started: "border-amber-400/30 bg-amber-500/10 text-amber-200",
};

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | null;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className={cn(glassPanelClass, "p-5")}>
      <div className={glassPanelTopShineClass} />
      <div className="flex items-center gap-3">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", color)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-semibold text-white">
            {value === null ? <span className="inline-block h-7 w-8 animate-pulse rounded bg-white/10" /> : value}
          </p>
          <p className="text-xs text-white/50">{label}</p>
        </div>
      </div>
    </div>
  );
}

export function AdminLessonSessionsOverview() {
  const [classGroupId, setClassGroupId] = React.useState("");
  const [deliveryStatus, setDeliveryStatus] = React.useState("all");
  const [weekStart, setWeekStart] = React.useState<Date | null>(null);
  const [weekEnd, setWeekEnd] = React.useState<Date | null>(null);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when filters change
  React.useEffect(() => {
    setPage(1);
  }, [classGroupId, deliveryStatus, weekStart, weekEnd, debouncedSearch]);

  const buildUrl = React.useCallback(() => {
    const params = new URLSearchParams();
    if (classGroupId) params.set("classGroupId", classGroupId);
    if (deliveryStatus && deliveryStatus !== "all") params.set("status", deliveryStatus);
    if (weekStart) params.set("weekStart", weekStart.toISOString().split("T")[0]);
    if (weekEnd) params.set("weekEnd", weekEnd.toISOString().split("T")[0]);
    params.set("page", String(page));
    params.set("limit", "25");
    return `/api/admin/lesson-sessions?${params.toString()}`;
  }, [classGroupId, deliveryStatus, weekStart, weekEnd, page]);

  const { data, isLoading, error, refetch, isFetching } = useQuery<ApiResponse>({
    queryKey: ["admin-lesson-sessions", classGroupId, deliveryStatus, weekStart, weekEnd, page],
    queryFn: async () => {
      const res = await fetch(buildUrl(), { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ApiResponse | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load sessions");
      }
      return json;
    },
    staleTime: 30_000,
  });

  const sessions = data?.data.sessions ?? [];
  const stats = data?.data.stats ?? null;
  const pagination = data?.data.pagination ?? null;

  const filteredSessions = debouncedSearch
    ? sessions.filter(
        (s) =>
          s.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          s.teacherName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          s.classGroupName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          s.subjectName.toLowerCase().includes(debouncedSearch.toLowerCase()),
      )
    : sessions;

  const clearFilters = () => {
    setClassGroupId("");
    setDeliveryStatus("all");
    setWeekStart(null);
    setWeekEnd(null);
    setSearch("");
    setPage(1);
  };

  const hasActiveFilters =
    Boolean(classGroupId) ||
    deliveryStatus !== "all" ||
    Boolean(weekStart) ||
    Boolean(weekEnd) ||
    Boolean(debouncedSearch);

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total sessions"
          value={stats?.total ?? null}
          icon={BookOpen}
          color="bg-teal-500/15 text-teal-200"
        />
        <StatCard
          label="Delivered"
          value={stats?.delivered ?? null}
          icon={CheckCircle2}
          color="bg-emerald-500/15 text-emerald-200"
        />
        <StatCard
          label="In progress"
          value={stats?.inProgress ?? null}
          icon={Clock}
          color="bg-blue-500/15 text-blue-200"
        />
        <StatCard
          label="Not started"
          value={stats?.pending ?? null}
          icon={XCircle}
          color="bg-amber-500/15 text-amber-200"
        />
      </div>

      {/* Filter bar */}
      <div className={cn(glassPanelClass, "p-4")}>
        <div className={glassPanelTopShineClass} />
        <div className="flex flex-wrap items-end gap-3">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sessions, teacher, class…"
              className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-white/30"
            />
          </div>

          {/* Delivery status */}
          <PremiumSelect value={deliveryStatus} onValueChange={setDeliveryStatus}>
            <PremiumSelectTrigger className="w-[160px]">
              <PremiumSelectValue placeholder="All statuses" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              <PremiumSelectItem value="all">All statuses</PremiumSelectItem>
              <PremiumSelectItem value="completed">Delivered</PremiumSelectItem>
              <PremiumSelectItem value="in_progress">In progress</PremiumSelectItem>
              <PremiumSelectItem value="not_started">Not started</PremiumSelectItem>
            </PremiumSelectContent>
          </PremiumSelect>

          {/* Week start / end */}
          <div className="flex items-center gap-2">
            <CustomDatePicker
              value={weekStart}
              onChange={setWeekStart}
              placeholder="From date"
              className="w-[150px]"
            />
            <span className="text-xs text-white/30">–</span>
            <CustomDatePicker
              value={weekEnd}
              onChange={setWeekEnd}
              placeholder="To date"
              className="w-[150px]"
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="border-white/10 bg-white/5 text-white/60"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            </Button>
            {hasActiveFilters ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={clearFilters}
                className="text-white/40 hover:text-white/70"
              >
                Clear
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className={cn(glassPanelClass, "overflow-hidden")}>
        <div className={glassPanelTopShineClass} />

        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl bg-white/5" />
            ))}
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <p className="text-sm text-rose-300">
              {error instanceof Error ? error.message : "Failed to load sessions"}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void refetch()}
              className="mt-3 border-white/10 bg-white/5 text-white/60"
            >
              Retry
            </Button>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="p-10 text-center">
            <BookOpen className="mx-auto mb-3 h-8 w-8 text-white/20" />
            <p className="text-sm font-medium text-white/50">No sessions found</p>
            {hasActiveFilters ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={clearFilters}
                className="mt-2 text-white/35"
              >
                Clear filters
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-white/8">
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-white/40">
                    Session
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-white/40">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-white/40">
                    Class
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-white/40">
                    Subject
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-white/40">
                    Teacher
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-white/40">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wide text-white/40">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map((session) => (
                  <tr
                    key={session.id}
                    className="border-b border-white/5 transition hover:bg-white/3"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-white/90">{session.title}</p>
                      <p className="text-xs text-white/35">
                        {session.contentBlockCount} block{session.contentBlockCount === 1 ? "" : "s"}
                        {session.assessmentItemCount > 0
                          ? ` · ${session.assessmentItemCount} assessment item${session.assessmentItemCount === 1 ? "" : "s"}`
                          : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-white/70">
                      <p>{session.scheduledDate}</p>
                      <p className="text-xs text-white/40">
                        {DAY_LABELS[session.dayOfWeek] ?? ""} · {session.startTime}–{session.endTime}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-white/70">{session.classGroupName}</td>
                    <td className="px-4 py-3 text-white/70">{session.subjectName}</td>
                    <td className="px-4 py-3 text-white/70">{session.teacherName}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                          DELIVERY_STATUS_STYLES[session.deliveryStatus],
                        )}
                      >
                        {DELIVERY_STATUS_LABELS[session.deliveryStatus]}
                      </span>
                      {session.completedAt ? (
                        <p className="mt-0.5 text-[10px] text-white/30">
                          {new Date(session.completedAt).toLocaleDateString()}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        asChild
                        size="sm"
                        variant="ghost"
                        className="h-8 border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/90"
                      >
                        <Link href={`/teacher/lessons/${session.id}`}>
                          View
                          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.pages > 1 ? (
          <div className="flex items-center justify-between border-t border-white/8 px-4 py-3">
            <p className="text-xs text-white/40">
              Page {pagination.page} of {pagination.pages} · {pagination.total} result
              {pagination.total === 1 ? "" : "s"}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page <= 1 || isFetching}
                onClick={() => setPage((p) => p - 1)}
                className="border-white/10 bg-white/5 text-white/60"
              >
                Previous
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page >= pagination.pages || isFetching}
                onClick={() => setPage((p) => p + 1)}
                className="border-white/10 bg-white/5 text-white/60"
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {isFetching && !isLoading ? (
        <p className="flex items-center gap-1.5 text-xs text-white/35">
          <Loader2 className="h-3 w-3 animate-spin" />
          Refreshing…
        </p>
      ) : null}
    </div>
  );
}
