"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Layers,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PlatformMetricCard,
  PlatformMetricGrid,
  PlatformPageHeader,
  PlatformPill,
  PlatformSection,
  formatTimestamp,
} from "@/components/platform/platform-page-primitives";

type DemoLeadRow = {
  _id: string;
  fullName: string;
  email: string;
  phone: string;
  schoolName: string;
  status: string;
  firstSeenAt: string;
  lastSeenAt: string;
};

type SandboxPool = Record<string, number>;

type PageData = {
  leads: DemoLeadRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  stats: { activeSessions: number; sandboxPool: SandboxPool };
};

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "new", label: "New" },
  { value: "active_demo", label: "Active demo" },
  { value: "completed_demo", label: "Completed demo" },
  { value: "follow_up_due", label: "Follow-up due" },
  { value: "converted", label: "Converted" },
  { value: "closed_lost", label: "Closed lost" },
];

const STATUS_PILL_TONE: Record<string, "cyan" | "emerald" | "slate" | "amber" | "violet" | "rose"> =
  {
    new: "cyan",
    active_demo: "emerald",
    completed_demo: "slate",
    follow_up_due: "amber",
    converted: "violet",
    closed_lost: "rose",
  };

function formatStatusLabel(status: string) {
  return status
    .split("_")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ""))
    .join(" ");
}

export default function PlatformDemoLeadsPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/platform/demo-leads?${params}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleRefresh = () => void fetchData({ silent: true });

  const totalPages = data?.pagination.totalPages ?? 0;
  const totalLeads = data?.pagination.total ?? 0;
  const activeSessions = data?.stats.activeSessions;
  const sandboxesAvailable = data?.stats.sandboxPool?.available;
  const sandboxesAllocated = data?.stats.sandboxPool?.allocated;

  return (
    <div className="space-y-6 p-2 md:p-4">
      <PlatformPageHeader
        eyebrow="Demo funnel"
        title="Demo leads and sandbox pool"
        description="Track prospects who have tried the demo, session activity, and sandbox capacity so platform ops can prioritize follow-ups."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || refreshing}
            onClick={handleRefresh}
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            {refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        }
      />

      <PlatformMetricGrid>
        <PlatformMetricCard
          icon={Activity}
          label="Active sessions"
          value={
            activeSessions !== undefined ? activeSessions.toLocaleString() : "—"
          }
          note={
            loading && !data
              ? "Loading session telemetry…"
              : "Demo environments currently in use."
          }
          tone="cyan"
        />
        <PlatformMetricCard
          icon={Boxes}
          label="Sandboxes available"
          value={
            sandboxesAvailable !== undefined
              ? sandboxesAvailable.toLocaleString()
              : "—"
          }
          note={
            loading && !data
              ? "Loading pool status…"
              : "Idle demo tenants ready for allocation."
          }
          tone="emerald"
        />
        <PlatformMetricCard
          icon={Layers}
          label="Sandboxes allocated"
          value={
            sandboxesAllocated !== undefined
              ? sandboxesAllocated.toLocaleString()
              : "—"
          }
          note={
            loading && !data
              ? "Loading pool status…"
              : "Demo tenants currently assigned to leads."
          }
          tone="amber"
        />
        <PlatformMetricCard
          icon={Users}
          label="Total leads"
          value={totalLeads > 0 || data ? totalLeads.toLocaleString() : "—"}
          note={
            loading && !data
              ? "Loading lead index…"
              : "All demo lead records matching filters."
          }
          tone="violet"
        />
      </PlatformMetricGrid>

      <PlatformSection
        title="Lead queue"
        description="Searchable list of demo prospects with funnel status and last activity. Use filters to focus a cohort."
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[220px]">
            <Label className="text-xs uppercase tracking-[0.14em] text-white/45">
              Status
            </Label>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="border-white/10 bg-white/5 text-white">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-slate-950 text-white">
                {STATUS_FILTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-white/45">
                <th className="pb-3 font-medium">Name</th>
                <th className="pb-3 font-medium">Email</th>
                <th className="pb-3 font-medium">Phone</th>
                <th className="pb-3 font-medium">School</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">First seen</th>
                <th className="pb-3 font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-white/50">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading leads…
                    </span>
                  </td>
                </tr>
              ) : !data?.leads.length ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-white/45">
                    No leads match this view yet.
                  </td>
                </tr>
              ) : (
                data.leads.map((lead) => (
                  <tr
                    key={lead._id}
                    className="border-b border-white/5 align-top transition-colors hover:bg-white/2"
                  >
                    <td className="py-3 pr-4 font-medium text-white">
                      {lead.fullName}
                    </td>
                    <td className="py-3 pr-4 text-white/60">{lead.email}</td>
                    <td className="py-3 pr-4 text-white/60">{lead.phone}</td>
                    <td className="py-3 pr-4 text-white/80">{lead.schoolName}</td>
                    <td className="py-3 pr-4">
                      <PlatformPill tone={STATUS_PILL_TONE[lead.status] ?? "slate"}>
                        {formatStatusLabel(lead.status)}
                      </PlatformPill>
                    </td>
                    <td className="py-3 pr-4 text-white/55">
                      {formatTimestamp(lead.firstSeenAt)}
                    </td>
                    <td className="py-3 text-white/55">
                      {formatTimestamp(lead.lastSeenAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data && totalPages > 1 ? (
          <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-white/45">
              Page{" "}
              <span className="text-white/80">{data.pagination.page}</span> of{" "}
              <span className="text-white/80">{totalPages}</span>
              <span className="text-white/35">
                {" "}
                · {data.pagination.total.toLocaleString()} leads
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </PlatformSection>
    </div>
  );
}
