"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  Eye,
  Loader2,
  MousePointerClick,
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
  firstSessionId: string | null;
  lastSessionId: string | null;
  sessionCount: number;
  lastSessionStatus: string | null;
  lastSessionAt: string | null;
  eventCount: number;
  lastEventAt: string | null;
};

type SandboxPool = Record<string, number>;
type DemoEventRow = {
  id: string;
  leadId: string | null;
  sessionId: string | null;
  actorRole: string;
  eventType: string;
  eventCode: string;
  metadata: Record<string, unknown> | null;
  createdAt: string | null;
};

type PageData = {
  leads: DemoLeadRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  stats: {
    activeSessions: number;
    sandboxPool: SandboxPool;
    leadsByStatus: Record<string, number>;
    sessionsByStatus: Record<string, number>;
    eventsByCode: Record<string, number>;
  };
  recentEvents: DemoEventRow[];
  selectedLeadEvents: DemoEventRow[];
  dataSource: "external_demo_database" | "platform_database";
  dataSourceInfo?: {
    databaseName: string | null;
    configuredDatabaseName: string | null;
    databaseNameSource: string;
    hasExternalDemoDataConfig: boolean;
    collectionCounts: Record<string, number | null>;
  };
  warnings: string[];
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

function formatEventCode(code: string) {
  return formatStatusLabel(code.replaceAll(".", "_"));
}

function eventPath(event: DemoEventRow) {
  const value = event.metadata?.path;
  return typeof value === "string" && value ? value : "";
}

export default function PlatformDemoLeadsPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (selectedLeadId) params.set("leadId", selectedLeadId);
      const res = await fetch(`/api/platform/demo-leads?${params}`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Could not load demo leads.");
      }
      setData(json.data);
      if (selectedLeadId && !json.data.leads.some((lead: DemoLeadRow) => lead._id === selectedLeadId)) {
        setSelectedLeadId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load demo leads.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, selectedLeadId, statusFilter]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleRefresh = () => void fetchData({ silent: true });

  const totalPages = data?.pagination.totalPages ?? 0;
  const totalLeads = data?.pagination.total ?? 0;
  const activeSessions = data?.stats.activeSessions;
  const sandboxesAvailable = data?.stats.sandboxPool?.available;
  const sandboxesAllocated = data?.stats.sandboxPool?.allocated;
  const completedSessions = data?.stats.sessionsByStatus?.ended ?? 0;
  const abandonedSessions = data?.stats.sessionsByStatus?.abandoned ?? 0;
  const totalEvents = Object.values(data?.stats.eventsByCode ?? {}).reduce((sum, value) => sum + value, 0);
  const collectionCounts = data?.dataSourceInfo?.collectionCounts ?? {};
  const selectedLead = selectedLeadId
    ? data?.leads.find((lead) => lead._id === selectedLeadId) ?? null
    : null;
  const activityFeed =
    selectedLeadId && data?.selectedLeadEvents.length
      ? data.selectedLeadEvents
      : data?.recentEvents ?? [];

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
          icon={Clock3}
          label="Completed sessions"
          value={
            data ? completedSessions.toLocaleString() : "—"
          }
          note={
            loading && !data
              ? "Loading completion data…"
              : `${abandonedSessions.toLocaleString()} abandoned or expired sessions.`
          }
          tone="amber"
        />
        <PlatformMetricCard
          icon={MousePointerClick}
          label="Tracked events"
          value={data ? totalEvents.toLocaleString() : "—"}
          note={
            loading && !data
              ? "Loading activity stream…"
              : "Lifecycle, persona, and page activity captured."
          }
          tone="violet"
        />
      </PlatformMetricGrid>

      {data?.warnings.length ? (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              {data.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-white">
          <div className="flex items-start gap-3">
            <span className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-100">
              <Database className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.16em] text-white/45">Data source</p>
              <p className="mt-1 font-medium">
                {data?.dataSource === "external_demo_database" ? "Demo database" : "Platform database"}
              </p>
              <p className="mt-1 truncate text-xs text-white/45">
                DB: {data?.dataSourceInfo?.databaseName || "not resolved"}
              </p>
              <p className="mt-1 text-xs text-white/35">
                External env: {data?.dataSourceInfo?.hasExternalDemoDataConfig ? "configured" : "missing"}
                {" · "}DB name source: {data?.dataSourceInfo?.databaseNameSource || "unknown"}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-white">
          <p className="text-xs uppercase tracking-[0.16em] text-white/45">Sandbox pool</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <PlatformPill tone="emerald">Available {sandboxesAvailable ?? 0}</PlatformPill>
            <PlatformPill tone="amber">Allocated {sandboxesAllocated ?? 0}</PlatformPill>
            <PlatformPill tone="rose">Tainted {data?.stats.sandboxPool?.tainted ?? 0}</PlatformPill>
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-white">
          <p className="text-xs uppercase tracking-[0.16em] text-white/45">Lead funnel</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(data?.stats.leadsByStatus ?? {}).map(([status, count]) => (
              <PlatformPill key={status} tone={STATUS_PILL_TONE[status] ?? "slate"}>
                {formatStatusLabel(status)} {count}
              </PlatformPill>
            ))}
          </div>
        </div>
      </div>

      {data ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-white">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-white/45">
                Demo collection diagnostics
              </p>
              <p className="mt-1 text-sm text-white/55">
                These counts prove which database the platform page is reading.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {["demoleads", "demosessions", "demosandboxes", "demoevents"].map((name) => (
                <PlatformPill key={name} tone={collectionCounts[name] ? "cyan" : "slate"}>
                  {name} {collectionCounts[name] ?? "?"}
                </PlatformPill>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <PlatformSection
        title="Lead queue"
        description="Demo prospects with session counts, activity counts, and latest activity. Select a row to inspect its timeline."
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
          <table className="w-full min-w-[1040px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-white/45">
                <th className="pb-3 font-medium">Name</th>
                <th className="pb-3 font-medium">Email</th>
                <th className="pb-3 font-medium">Phone</th>
                <th className="pb-3 font-medium">School</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Sessions</th>
                <th className="pb-3 font-medium">Events</th>
                <th className="pb-3 font-medium">Last activity</th>
                <th className="pb-3 font-medium">Open</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-white/50">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading leads…
                    </span>
                  </td>
                </tr>
              ) : !data?.leads.length ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-white/45">
                    No leads match this view yet.
                  </td>
                </tr>
              ) : (
                data.leads.map((lead) => (
                  <tr
                    key={lead._id}
                    onClick={() => setSelectedLeadId(lead._id)}
                    className={`cursor-pointer border-b border-white/5 align-top transition-colors hover:bg-white/2 ${
                      selectedLeadId === lead._id ? "bg-cyan-500/10" : ""
                    }`}
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
                    <td className="py-3 pr-4 text-white/60">
                      {lead.sessionCount.toLocaleString()}
                    </td>
                    <td className="py-3 pr-4 text-white/60">
                      {lead.eventCount.toLocaleString()}
                    </td>
                    <td className="py-3 pr-4 text-white/55">
                      {formatTimestamp(lead.lastEventAt || lead.lastSeenAt)}
                    </td>
                    <td className="py-3 pr-4">
                      <Button
                        asChild
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Link href={`/platform/demo-leads/${lead._id}`}>
                          <Eye className="mr-1 h-4 w-4" />
                          Open
                        </Link>
                      </Button>
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <PlatformSection
          title={selectedLead ? "Selected lead" : "Selected lead"}
          description="The latest known contact and session profile for the selected demo prospect."
        >
          {selectedLead ? (
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-lg font-semibold text-white">{selectedLead.fullName}</p>
                <p className="text-white/55">{selectedLead.schoolName}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-white/35">Email</p>
                  <p className="mt-1 text-white/75">{selectedLead.email}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-white/35">Phone</p>
                  <p className="mt-1 text-white/75">{selectedLead.phone}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-white/35">Sessions</p>
                  <p className="mt-1 text-white/75">
                    {selectedLead.sessionCount.toLocaleString()} total
                    {selectedLead.lastSessionStatus ? ` · ${formatStatusLabel(selectedLead.lastSessionStatus)}` : ""}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-white/35">Activity</p>
                  <p className="mt-1 text-white/75">{selectedLead.eventCount.toLocaleString()} tracked events</p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-white/35">Last activity</p>
                <p className="mt-1 text-white/75">
                  {formatTimestamp(selectedLead.lastEventAt || selectedLead.lastSessionAt || selectedLead.lastSeenAt)}
                </p>
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-white/45">Select a lead to inspect its activity.</p>
          )}
        </PlatformSection>

        <PlatformSection
          title={selectedLeadId ? "Lead activity" : "Recent activity"}
          description="Lifecycle, persona, and page-view events captured from demo sessions."
        >
          <div className="space-y-3">
            {!activityFeed.length ? (
              <p className="py-8 text-center text-sm text-white/45">No tracked activity yet.</p>
            ) : (
              activityFeed.map((event) => (
                <div key={event.id} className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-100">
                    {event.eventCode === "page.viewed" ? <Eye className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-medium text-white">{formatEventCode(event.eventCode)}</p>
                      <p className="text-xs text-white/40">{formatTimestamp(event.createdAt)}</p>
                    </div>
                    <p className="mt-1 text-sm text-white/55">
                      {event.actorRole ? formatStatusLabel(event.actorRole) : "Demo visitor"}
                      {eventPath(event) ? ` · ${eventPath(event)}` : ""}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </PlatformSection>
      </div>
    </div>
  );
}
