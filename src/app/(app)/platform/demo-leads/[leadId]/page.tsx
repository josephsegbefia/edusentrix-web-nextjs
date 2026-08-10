"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  Clock3,
  Database,
  Eye,
  Loader2,
  MousePointerClick,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  PlatformMetricCard,
  PlatformMetricGrid,
  PlatformPageHeader,
  PlatformPill,
  PlatformSection,
  formatTimestamp,
} from "@/components/platform/platform-page-primitives";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";

type DemoLead = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  schoolName: string;
  schoolAddress: string;
  city: string;
  region: string;
  source: string;
  status: string;
  notes: string;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
};

type DemoSession = {
  id: string;
  status: string;
  activePersonaRole: string;
  startedAt: string | null;
  expiresAt: string | null;
  lastInteractionAt: string | null;
  endedAt: string | null;
  ipAddress: string;
  userAgent: string;
};

type DemoEvent = {
  id: string;
  sessionId: string | null;
  actorRole: string;
  eventType: string;
  eventCode: string;
  metadata: Record<string, unknown> | null;
  createdAt: string | null;
};

type PageVisit = {
  path: string;
  title: string;
  views: number;
  clicks: number;
  durationMs: number;
  lastSeenAt: string | null;
};

type Interest = {
  score: number;
  classification: "high_intent" | "warm" | "exploratory" | "cold";
  signals: {
    sessions: number;
    pageViews: number;
    uniquePages: number;
    clicks: number;
    personaSwitches: number;
    exploredFeatures: number;
    totalDurationMs: number;
  };
  recommendations: string[];
};

type PageData = {
  lead: DemoLead;
  sessions: DemoSession[];
  events: DemoEvent[];
  pageVisits: PageVisit[];
  interest: Interest;
  dataSource: "external_demo_database" | "platform_database";
  dataSourceInfo: {
    databaseName: string | null;
    configuredDatabaseName: string | null;
    databaseNameSource: string;
  };
};

const INTEREST_TONES: Record<Interest["classification"], "slate" | "cyan" | "emerald" | "amber" | "rose" | "violet"> = {
  high_intent: "emerald",
  warm: "cyan",
  exploratory: "amber",
  cold: "slate",
};

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ""))
    .join(" ");
}

function formatDuration(ms: number) {
  if (!ms || ms < 1000) return "0s";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (!minutes) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function eventPath(event: DemoEvent) {
  const value = event.metadata?.path;
  return typeof value === "string" && value ? value : "";
}

function eventLabel(event: DemoEvent) {
  if (event.eventCode === "ui.clicked") {
    const label = event.metadata?.label;
    return typeof label === "string" && label ? `Clicked ${label}` : "Clicked UI element";
  }
  return formatLabel(event.eventCode.replaceAll(".", "_"));
}

export default function PlatformDemoLeadDetailPage() {
  const params = useParams<{ leadId: string }>();
  const router = useRouter();
  const leadId = params.leadId;
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { confirm, confirmationDialog } = useConfirmationDialog();

  const fetchData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch(`/api/platform/demo-leads/${leadId}`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load demo lead.");
      }
      setData(json.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load demo lead.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [leadId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const latestSession = data?.sessions[0] ?? null;
  const topPages = useMemo(() => data?.pageVisits.slice(0, 8) ?? [], [data?.pageVisits]);

  async function deleteLead() {
    const ok = await confirm({
      title: "Delete demo lead?",
      description:
        "This permanently deletes the demo lead, its sessions, and tracked activity. This cannot be undone.",
      confirmLabel: "Delete demo",
      cancelLabel: "Keep demo",
      intent: "destructive",
    });
    if (ok !== "confirm") return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/platform/demo-leads/${leadId}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to delete demo lead.");
      }
      toast.success("Demo lead deleted.");
      router.push("/platform/demo-leads");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete demo lead.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-white/60">
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading demo intelligence...
        </span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4 p-2 md:p-4">
        <Button asChild variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
          <Link href="/platform/demo-leads">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to demo leads
          </Link>
        </Button>
        <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-6 text-rose-100">
          Demo lead could not be loaded.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-2 md:p-4">
      <PlatformPageHeader
        eyebrow="Demo intelligence"
        title={data.lead.schoolName || data.lead.fullName}
        description="Session-level activity, pages visited, engagement signals, and recommended next actions for this demo lead."
        actions={
          <>
            <Button asChild variant="outline" size="sm" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
              <Link href="/platform/demo-leads">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={refreshing}
              onClick={() => void fetchData(true)}
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={deleting}
              onClick={deleteLead}
              className="border-rose-400/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete
            </Button>
          </>
        }
      />

      <PlatformMetricGrid>
        <PlatformMetricCard
          icon={Sparkles}
          label="Interest score"
          value={`${data.interest.score}/100`}
          note={formatLabel(data.interest.classification)}
          tone={data.interest.classification === "high_intent" ? "emerald" : data.interest.classification === "warm" ? "cyan" : "amber"}
        />
        <PlatformMetricCard
          icon={Eye}
          label="Page views"
          value={data.interest.signals.pageViews.toLocaleString()}
          note={`${data.interest.signals.uniquePages.toLocaleString()} unique pages explored.`}
          tone="cyan"
        />
        <PlatformMetricCard
          icon={MousePointerClick}
          label="Clicks"
          value={data.interest.signals.clicks.toLocaleString()}
          note="Button and link clicks captured after the latest telemetry update."
          tone="violet"
        />
        <PlatformMetricCard
          icon={Clock3}
          label="Time spent"
          value={formatDuration(data.interest.signals.totalDurationMs)}
          note={`${data.sessions.length.toLocaleString()} demo session(s).`}
          tone="amber"
        />
      </PlatformMetricGrid>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <PlatformSection
          title="Lead profile"
          description="Captured contact details and current demo status."
        >
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <PlatformPill tone={INTEREST_TONES[data.interest.classification]}>
                {formatLabel(data.interest.classification)}
              </PlatformPill>
              <PlatformPill tone="slate">{formatLabel(data.lead.status)}</PlatformPill>
              <PlatformPill tone={data.dataSource === "external_demo_database" ? "cyan" : "amber"}>
                {data.dataSource === "external_demo_database" ? "Demo DB" : "Platform DB"}
              </PlatformPill>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Contact", data.lead.fullName],
                ["Email", data.lead.email],
                ["Phone", data.lead.phone],
                ["School", data.lead.schoolName],
                ["Location", [data.lead.city, data.lead.region].filter(Boolean).join(", ") || data.lead.schoolAddress],
                ["Last seen", formatTimestamp(data.lead.lastSeenAt)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-white/35">{label}</p>
                  <p className="mt-1 break-words text-white/75">{value || "—"}</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-white/35">Data source</p>
              <p className="mt-1 text-white/75">
                {data.dataSourceInfo.databaseName || "not resolved"} · DB name source {data.dataSourceInfo.databaseNameSource}
              </p>
            </div>
          </div>
        </PlatformSection>

        <PlatformSection
          title="Leo-ready recommendation"
          description="Deterministic scoring for now. Leo can later turn this into a richer written sales brief."
        >
          <div className="space-y-3">
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
              <div className="flex items-center gap-3">
                <span className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-100">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-white">{formatLabel(data.interest.classification)}</p>
                  <p className="text-sm text-white/55">Interest score {data.interest.score}/100</p>
                </div>
              </div>
            </div>
            {data.interest.recommendations.length ? (
              data.interest.recommendations.map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
                  {item}
                </div>
              ))
            ) : (
              <p className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/50">
                Not enough activity yet to recommend a specific next action.
              </p>
            )}
          </div>
        </PlatformSection>
      </div>

      <PlatformSection
        title="Pages visited"
        description="Aggregated page views, click counts, and estimated time spent per page."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-white/45">
                <th className="pb-3 font-medium">Page</th>
                <th className="pb-3 font-medium">Views</th>
                <th className="pb-3 font-medium">Clicks</th>
                <th className="pb-3 font-medium">Time spent</th>
                <th className="pb-3 font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {!topPages.length ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-white/45">
                    No page activity captured yet.
                  </td>
                </tr>
              ) : (
                topPages.map((page) => (
                  <tr key={page.path} className="border-b border-white/5">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-white">{page.title || page.path}</p>
                      <p className="text-xs text-white/40">{page.path}</p>
                    </td>
                    <td className="py-3 pr-4 text-white/65">{page.views.toLocaleString()}</td>
                    <td className="py-3 pr-4 text-white/65">{page.clicks.toLocaleString()}</td>
                    <td className="py-3 pr-4 text-white/65">{formatDuration(page.durationMs)}</td>
                    <td className="py-3 pr-4 text-white/50">{formatTimestamp(page.lastSeenAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </PlatformSection>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <PlatformSection title="Sessions" description="Each demo access period for this lead.">
          <div className="space-y-3">
            {!data.sessions.length ? (
              <p className="py-8 text-center text-sm text-white/45">No sessions captured.</p>
            ) : (
              data.sessions.map((session) => (
                <div key={session.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="rounded-xl bg-emerald-400/10 p-2 text-emerald-100">
                        <UserRound className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-medium text-white">{formatLabel(session.activePersonaRole || "demo visitor")}</p>
                        <p className="text-xs text-white/45">{session.id}</p>
                      </div>
                    </div>
                    <PlatformPill tone={session.status === "active" ? "emerald" : "slate"}>
                      {formatLabel(session.status)}
                    </PlatformPill>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-white/50 sm:grid-cols-2">
                    <span>Started {formatTimestamp(session.startedAt)}</span>
                    <span>Last interaction {formatTimestamp(session.lastInteractionAt)}</span>
                    <span>Ended {formatTimestamp(session.endedAt)}</span>
                    <span>IP {session.ipAddress || "—"}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </PlatformSection>

        <PlatformSection title="Activity timeline" description="Latest tracked page, click, persona, and lifecycle events.">
          <div className="space-y-3">
            {!data.events.length ? (
              <p className="py-8 text-center text-sm text-white/45">No tracked events yet.</p>
            ) : (
              data.events.slice(0, 80).map((event) => (
                <div key={event.id} className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-100">
                    {event.eventCode === "ui.clicked" ? <MousePointerClick className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-medium text-white">{eventLabel(event)}</p>
                      <p className="text-xs text-white/40">{formatTimestamp(event.createdAt)}</p>
                    </div>
                    <p className="mt-1 text-sm text-white/55">
                      {event.actorRole ? formatLabel(event.actorRole) : "Demo visitor"}
                      {eventPath(event) ? ` · ${eventPath(event)}` : ""}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </PlatformSection>
      </div>

      {latestSession?.userAgent ? (
        <PlatformSection title="Device context" description="Raw browser context from the latest session.">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/60">
            <div className="flex items-center gap-2 text-white/75">
              <Database className="h-4 w-4" />
              Latest user agent
            </div>
            <p className="mt-2 break-words text-xs text-white/45">{latestSession.userAgent}</p>
          </div>
        </PlatformSection>
      ) : null}

      {confirmationDialog}
    </div>
  );
}
