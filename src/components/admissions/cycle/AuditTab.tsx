"use client";

import * as React from "react";
import {
  Archive,
  CheckCircle2,
  ClipboardList,
  FileText,
  Inbox,
  Loader2,
  Mail,
  PlayCircle,
  PauseCircle,
  RotateCcw,
  Settings2,
  StickyNote,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  XCircle,
} from "lucide-react";
import { format } from "date-fns/format";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { Badge } from "@/components/ui/badge";
import {
  useAdmissionEvents,
  type AdmissionEventDTO,
} from "@/hooks/admissions/useAdmissionEvents";
import { cn } from "@/lib/utils";

type AuditTabProps = {
  cycleId: string;
};

type EventVisual = {
  Icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  title: string;
  detail?: (e: AdmissionEventDTO) => string | null;
};

const EVENT_VISUALS: Record<string, EventVisual> = {
  "cycle.created": {
    Icon: PlayCircle,
    iconClass: "text-cyan-300",
    title: "Cycle created",
    detail: (e) => {
      const tpl = (e.metadata?.templateId as string) ?? "";
      return tpl && tpl !== "blank" ? `Seeded from "${tpl}" template` : null;
    },
  },
  "cycle.updated": {
    Icon: Settings2,
    iconClass: "text-white/70",
    title: "Cycle settings updated",
  },
  "cycle.published": {
    Icon: PlayCircle,
    iconClass: "text-emerald-300",
    title: "Cycle published",
  },
  "cycle.paused": {
    Icon: PauseCircle,
    iconClass: "text-amber-300",
    title: "Cycle paused",
  },
  "cycle.closed": {
    Icon: XCircle,
    iconClass: "text-rose-300",
    title: "Cycle closed",
  },
  "cycle.archived": {
    Icon: Archive,
    iconClass: "text-white/60",
    title: "Cycle archived",
    detail: (e) => {
      const n = (e.metadata?.applicationCount as number | undefined) ?? 0;
      return n > 0 ? `${n} application${n === 1 ? "" : "s"} on file` : null;
    },
  },
  "cycle.deleted": {
    Icon: Trash2,
    iconClass: "text-rose-300/90",
    title: "Cycle draft deleted",
    detail: (e) => {
      const slug = (e.metadata?.slug as string | undefined) ?? "";
      return slug ? `Slug: ${slug}` : null;
    },
  },
  "cycle.delegate_assigned": {
    Icon: UserCheck,
    iconClass: "text-cyan-300",
    title: "Delegate assigned",
    detail: (e) => (e.metadata?.label as string) ?? null,
  },
  "cycle.delegate_revoked": {
    Icon: UserX,
    iconClass: "text-rose-300",
    title: "Delegate revoked",
  },
  "form.updated": {
    Icon: FileText,
    iconClass: "text-cyan-300",
    title: "Application form updated",
    detail: (e) =>
      e.metadata?.version ? `Saved as version ${e.metadata.version}` : null,
  },
  "form.reset_to_defaults": {
    Icon: RotateCcw,
    iconClass: "text-amber-300",
    title: "Form reset to defaults",
  },
  "application.submitted": {
    Icon: Inbox,
    iconClass: "text-cyan-300",
    title: "Application submitted",
    detail: (e) => (e.metadata?.referenceCode as string) ?? null,
  },
  "application.viewed_by_admin": {
    Icon: ClipboardList,
    iconClass: "text-white/55",
    title: "Application viewed",
  },
  "application.note_added": {
    Icon: StickyNote,
    iconClass: "text-amber-300",
    title: "Internal note added",
  },
  "application.status_changed": {
    Icon: ClipboardList,
    iconClass: "text-white/70",
    title: "Status updated",
    detail: (e) => {
      const from = (e.metadata?.from as string) ?? null;
      const to = (e.metadata?.to as string) ?? null;
      const bulk = e.metadata?.bulk ? " (bulk)" : "";
      if (from && to) return `${from.replace("_", " ")} → ${to.replace("_", " ")}${bulk}`;
      return null;
    },
  },
  "application.decision_recorded": {
    Icon: CheckCircle2,
    iconClass: "text-emerald-300",
    title: "Decision recorded",
    detail: (e) => {
      const outcome = (e.metadata?.outcome as string) ?? null;
      return outcome ? outcome.charAt(0).toUpperCase() + outcome.slice(1) : null;
    },
  },
  "application.email_sent": {
    Icon: Mail,
    iconClass: "text-cyan-300",
    title: "Email sent",
    detail: (e) => (e.metadata?.kind as string) ?? null,
  },
  "application.provisioned": {
    Icon: UserPlus,
    iconClass: "text-emerald-300",
    title: "Student provisioned",
  },
  "application.withdrawn": {
    Icon: UserX,
    iconClass: "text-rose-300",
    title: "Application withdrawn",
  },
  "application.expired": {
    Icon: XCircle,
    iconClass: "text-white/55",
    title: "Application expired",
  },
};

const FILTERS: Array<{
  id: "all" | "applications" | "cycle" | "form";
  label: string;
  match: (kind: string) => boolean;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "all",
    label: "All activity",
    match: () => true,
    Icon: ClipboardList,
  },
  {
    id: "applications",
    label: "Applications",
    match: (k) => k.startsWith("application."),
    Icon: Users,
  },
  {
    id: "cycle",
    label: "Cycle",
    match: (k) => k.startsWith("cycle."),
    Icon: Settings2,
  },
  {
    id: "form",
    label: "Form",
    match: (k) => k.startsWith("form."),
    Icon: FileText,
  },
];

function visualFor(kind: string): EventVisual {
  return (
    EVENT_VISUALS[kind] ?? {
      Icon: ClipboardList,
      iconClass: "text-white/55",
      title: kind.replace(/[._]/g, " "),
    }
  );
}

export function AuditTab({ cycleId }: AuditTabProps) {
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]["id"]>("all");
  const { data, isLoading, isError, error } = useAdmissionEvents({
    cycleId,
    limit: 200,
  });

  const items = data?.data.items ?? [];
  const matcher = FILTERS.find((f) => f.id === filter)?.match ?? (() => true);
  const filtered = items.filter((e) => matcher(e.kind));

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Audit timeline</p>
            <p className="text-xs text-white/55">
              Every meaningful change in this cycle is recorded here. Read-only.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const isActive = f.id === filter;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    isActive
                      ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
                      : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <f.Icon className="h-3 w-3" />
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
        {isLoading ? (
          <div className="flex items-center justify-center text-sm text-white/55">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading timeline…
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">
            {error instanceof Error ? error.message : "Failed to load events"}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <ClipboardList className="h-8 w-8 text-white/25" />
            <p className="text-sm font-medium text-white">No events yet</p>
            <p className="max-w-xs text-xs text-white/55">
              Activity from delegates, applicants, and decisions will appear
              here as the cycle progresses.
            </p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-4 top-2 bottom-2 w-px bg-white/10" />
            <ul className="space-y-4">
              {filtered.map((e) => {
                const v = visualFor(e.kind);
                const detail = v.detail?.(e);
                return (
                  <li key={e.id} className="relative flex items-start gap-3">
                    <div className="relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-950">
                      <v.Icon className={cn("h-4 w-4", v.iconClass)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white">
                          {v.title}
                        </p>
                        {detail ? (
                          <Badge
                            variant="outline"
                            className="border-white/10 bg-white/5 text-[10px] font-medium text-white/70"
                          >
                            {detail}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-white/55">
                        <span title={format(new Date(e.at), "PPpp")}>
                          {formatDistanceToNow(new Date(e.at), {
                            addSuffix: true,
                          })}
                        </span>
                        <span className="mx-2 text-white/20">·</span>
                        <span>{e.actor.label}</span>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
