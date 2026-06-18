"use client";

/**
 * SubscriptionEventLog
 *
 * Paginated event timeline for subscription history.
 * Used on both the platform school subscription page and the school admin subscription page.
 *
 * Props:
 *   apiPath — the endpoint to fetch events from
 *   maxVisible — max events shown without "Load more" (default 10)
 *   platformMode — if true, shows all event types and actor details
 */

import * as React from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  BadgeCheck,
  Ban,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { glassInsetClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";

export type EventRow = {
  _id: string;
  eventType: string;
  summary: string;
  actorEmail?: string | null;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
};

type Props = {
  apiPath: string;
  title?: string;
  platformMode?: boolean;
  maxVisible?: number;
};

const EVENT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  subscription_assigned: CreditCard,
  subscription_updated: ArrowRightLeft,
  subscription_renewed: CheckCircle2,
  subscription_suspended: Ban,
  subscription_reactivated: BadgeCheck,
  subscription_cancelled: XCircle,
  subscription_expired: AlertTriangle,
  subscription_upgraded: Sparkles,
  subscription_downgraded: ChevronDown,
  grace_period_started: AlertTriangle,
  grace_period_ended: CheckCircle2,
  pilot_ended: ShieldAlert,
  access_mode_override: ShieldAlert,
  addon_purchased: Sparkles,
  addon_removed: Trash2,
  addon_credited: Sparkles,
  usage_event: Zap,
  renewal_requested: RefreshCw,
  renewal_confirmed: CheckCircle2,
  renewal_failed: XCircle,
  payment_recorded: CreditCard,
  entitlement_audit: Activity,
};

const EVENT_TONE: Record<string, string> = {
  subscription_suspended: "text-rose-300",
  subscription_cancelled: "text-rose-300",
  subscription_expired: "text-amber-300",
  grace_period_started: "text-amber-300",
  pilot_ended: "text-amber-300",
  renewal_failed: "text-rose-300",
  access_mode_override: "text-violet-300",
  subscription_assigned: "text-teal-300",
  subscription_renewed: "text-emerald-300",
  subscription_reactivated: "text-emerald-300",
  renewal_confirmed: "text-emerald-300",
  payment_recorded: "text-cyan-300",
  addon_purchased: "text-violet-300",
  addon_removed: "text-rose-300",
  addon_credited: "text-violet-300",
  subscription_upgraded: "text-teal-300",
};

const EVENT_FILTER_OPTIONS = [
  { value: "all", label: "All events" },
  { value: "subscription_assigned", label: "Assigned" },
  { value: "subscription_updated", label: "Updated" },
  { value: "subscription_renewed", label: "Renewed" },
  { value: "subscription_suspended", label: "Suspended" },
  { value: "grace_period_started", label: "Grace period" },
  { value: "addon_purchased", label: "Add-on purchased" },
  { value: "addon_removed", label: "Add-on removed" },
  { value: "payment_recorded", label: "Payment recorded" },
  { value: "access_mode_override", label: "Access override" },
] as const;

function EventRow({ event, platformMode }: { event: EventRow; platformMode?: boolean }) {
  const Icon = EVENT_ICON[event.eventType] ?? Activity;
  const tone = EVENT_TONE[event.eventType] ?? "text-white/40";

  const date = new Date(event.createdAt).toLocaleDateString("en-GH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const time = new Date(event.createdAt).toLocaleTimeString("en-GH", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className={cn("mt-0.5 shrink-0", tone)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs leading-relaxed text-white/70">{event.summary}</p>
        <p className="mt-0.5 text-[10px] text-white/30">
          {date} · {time}
          {platformMode && event.actorEmail ? (
            <span className="ml-1 text-white/25">· {event.actorEmail}</span>
          ) : null}
        </p>
      </div>
      <span className={cn(
        "shrink-0 rounded-full border px-1.5 py-0.5 font-mono text-[9px]",
        "border-white/10 bg-white/5 text-white/25"
      )}>
        {event.eventType.replace(/_/g, " ")}
      </span>
    </div>
  );
}

export function SubscriptionEventLog({
  apiPath,
  title = "Event history",
  platformMode = false,
  maxVisible = 10,
}: Props) {
  const [events, setEvents] = React.useState<EventRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [filter, setFilter] = React.useState<string>("");

  const load = React.useCallback(
    async (p = 1, append = false) => {
      if (p === 1) setLoading(true);
      else setLoadingMore(true);
      try {
        const url = new URL(apiPath, window.location.origin);
        url.searchParams.set("page", String(p));
        url.searchParams.set("limit", String(maxVisible));
        if (filter) url.searchParams.set("eventType", filter);

        const res = await fetch(url.toString());
        const json = await res.json();
        if (json.success) {
          const rows: EventRow[] = json.data;
          setEvents((prev) => (append ? [...prev, ...rows] : rows));
          setHasMore(json.pagination.page < json.pagination.pages);
          setPage(p);
        }
      } catch {
        // Non-blocking
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [apiPath, maxVisible, filter]
  );

  React.useEffect(() => {
    load(1);
  }, [load]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-white/50">{title}</p>
        <div className="flex items-center gap-2">
          {platformMode && (
            <PremiumSelect
              value={filter || "all"}
              onValueChange={(value) => setFilter(value === "all" ? "" : value)}
            >
              <PremiumSelectTrigger className="h-8 min-w-[9.5rem] border-white/15 bg-white/5 px-2.5 text-[11px] text-white">
                <PremiumSelectValue placeholder="All events" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {EVENT_FILTER_OPTIONS.map((option) => (
                  <PremiumSelectItem key={option.value} value={option.value}>
                    {option.label}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          )}
          <button
            type="button"
            onClick={() => load(1)}
            className="text-white/30 transition hover:text-white/70"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-white/30" />
        </div>
      ) : events.length === 0 ? (
        <div className={cn(glassInsetClass, "py-6 text-center")}>
          <Activity className="mx-auto mb-2 h-5 w-5 text-white/20" />
          <p className="text-xs text-white/30">No events recorded yet.</p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-white/5">
            {events.map((ev) => (
              <EventRow key={ev._id} event={ev} platformMode={platformMode} />
            ))}
          </div>

          {hasMore && (
            <button
              type="button"
              onClick={() => load(page + 1, true)}
              disabled={loadingMore}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2 text-xs text-white/40 transition hover:text-white disabled:opacity-50"
            >
              {loadingMore ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              Load more
            </button>
          )}
        </>
      )}
    </div>
  );
}
