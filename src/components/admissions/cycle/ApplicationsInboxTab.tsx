"use client";

import * as React from "react";
import {
  CheckCircle2,
  Clock,
  Columns3,
  Download,
  ExternalLink,
  Inbox,
  Loader2,
  Rows3,
  Search,
  XCircle,
} from "lucide-react";
import { format } from "date-fns/format";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { admissionsAdminFieldClass } from "@/components/admissions/admissions-admin-ui";
import { cn } from "@/lib/utils";
import {
  exportApplicationsToCsv,
  useAdmissionApplications,
  type AdmissionApplicationListItem,
} from "@/hooks/admissions/useAdmissionApplications";
import { ApplicationDetailDrawer } from "./ApplicationDetailDrawer";
import { ApplicationsBulkBar } from "./ApplicationsBulkBar";
import { ApplicationsKanban } from "./ApplicationsKanban";

const STATUS_FILTERS: Array<{ id: string; label: string; tone: string }> = [
  { id: "", label: "All", tone: "border-white/10 bg-white/5 text-white/70" },
  {
    id: "submitted",
    label: "New",
    tone: "border-blue-500/30 bg-blue-500/10 text-blue-100",
  },
  {
    id: "under_review",
    label: "Under review",
    tone: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  },
  {
    id: "interview_scheduled",
    label: "Interview",
    tone: "border-violet-500/30 bg-violet-500/10 text-violet-100",
  },
  {
    id: "waitlisted",
    label: "Waitlisted",
    tone: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  },
  {
    id: "accepted",
    label: "Accepted",
    tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  },
  {
    id: "rejected",
    label: "Not offered",
    tone: "border-rose-500/30 bg-rose-500/10 text-rose-100",
  },
  {
    id: "withdrawn",
    label: "Withdrawn",
    tone: "border-white/10 bg-white/5 text-white/55",
  },
];

const STATUS_BADGES: Record<AdmissionApplicationListItem["status"], string> = {
  submitted: "border-blue-500/30 bg-blue-500/10 text-blue-100",
  under_review: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  interview_scheduled:
    "border-violet-500/30 bg-violet-500/10 text-violet-100",
  accepted: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  rejected: "border-rose-500/30 bg-rose-500/10 text-rose-100",
  waitlisted: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  withdrawn: "border-white/10 bg-white/5 text-white/55",
  expired: "border-white/10 bg-white/5 text-white/55",
};

type ApplicationsInboxTabProps = {
  cycleId: string;
};

export function ApplicationsInboxTab({ cycleId }: ApplicationsInboxTabProps) {
  const [status, setStatus] = React.useState<string>("");
  const [q, setQ] = React.useState("");
  const [debouncedQ, setDebouncedQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [view, setView] = React.useState<"list" | "kanban">(() => {
    if (typeof window === "undefined") return "list";
    return (localStorage.getItem("admissions:view") as "list" | "kanban") || "list";
  });
  const [exportingAll, setExportingAll] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("admissions:view", view);
  }, [view]);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(timer);
  }, [q]);

  React.useEffect(() => {
    setSelected(new Set());
  }, [status, debouncedQ, page, view]);

  const { data, isLoading, isError, error } = useAdmissionApplications({
    cycleId,
    status: status || undefined,
    q: debouncedQ || undefined,
    page,
    pageSize: view === "kanban" ? 200 : 25,
  });

  const items = data?.data.items ?? [];
  const total = data?.data.total ?? 0;
  const counts = data?.data.statusCounts ?? {};
  const totalPages = Math.max(1, Math.ceil(total / 25));

  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));
  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleExportAll() {
    setExportingAll(true);
    try {
      const rows = await exportApplicationsToCsv({
        cycleId,
        status: status || undefined,
      });
      toast.success(`Exported ${rows} application${rows === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportingAll(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((filter) => {
            const isActive = filter.id === status;
            const count =
              filter.id === ""
                ? Object.values(counts).reduce((a, b) => a + b, 0)
                : counts[filter.id] ?? 0;
            return (
              <button
                key={filter.id || "all"}
                type="button"
                onClick={() => {
                  setStatus(filter.id);
                  setPage(1);
                }}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  isActive
                    ? filter.tone
                    : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10 hover:text-white"
                )}
              >
                {filter.label}
                <span className="rounded-full bg-black/30 px-1.5 text-[10px]">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-white/10 bg-black/30 p-0.5">
            <button
              type="button"
              onClick={() => setView("list")}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition",
                view === "list"
                  ? "bg-cyan-500/20 text-cyan-100"
                  : "text-white/55 hover:text-white"
              )}
              title="List view"
            >
              <Rows3 className="h-3 w-3" />
              List
            </button>
            <button
              type="button"
              onClick={() => setView("kanban")}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition",
                view === "kanban"
                  ? "bg-cyan-500/20 text-cyan-100"
                  : "text-white/55 hover:text-white"
              )}
              title="Kanban board"
            >
              <Columns3 className="h-3 w-3" />
              Kanban
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search ref / name / email"
              className={cn(admissionsAdminFieldClass, "h-9 w-64 pl-8")}
            />
          </div>
          {view === "list" ? (
            <PremiumSelect
              value={String(page)}
              onValueChange={(v) => setPage(Number(v))}
            >
              <PremiumSelectTrigger className="h-9 w-28">
                <PremiumSelectValue placeholder="Page" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {Array.from({ length: totalPages }, (_, i) => (
                  <PremiumSelectItem key={i + 1} value={String(i + 1)}>
                    Page {i + 1}/{totalPages}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportAll}
            disabled={exportingAll}
            className="h-9 border-white/10 bg-white/5 text-white"
          >
            {exportingAll ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-3.5 w-3.5" />
            )}
            Export
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-slate-950/60 p-10 text-sm text-white/55">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading applications…
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-100">
          {error instanceof Error ? error.message : "Failed to load applications."}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/15 bg-slate-950/60 p-10 text-center">
          <Inbox className="h-8 w-8 text-white/25" />
          <p className="text-sm font-medium text-white">No applications yet</p>
          <p className="max-w-sm text-xs text-white/55">
            Once applicants submit, they will appear here. Share the application
            link from the Distribution tab to start receiving applications.
          </p>
        </div>
      ) : view === "kanban" ? (
        <ApplicationsKanban items={items} onOpen={setOpenId} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
              <tr>
                <th className="px-3 py-2.5 text-left">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={() => toggleAll()}
                    aria-label="Select all on this page"
                  />
                </th>
                <th className="px-4 py-2.5 text-left">Reference</th>
                <th className="px-4 py-2.5 text-left">Applicant</th>
                <th className="px-4 py-2.5 text-left">Grade</th>
                <th className="px-4 py-2.5 text-left">Guardian</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-left">Submitted</th>
                <th className="px-4 py-2.5 text-right">Documents</th>
              </tr>
            </thead>
            <tbody>
              {items.map((app) => (
                <tr
                  key={app.id}
                  onClick={() => setOpenId(app.id)}
                  className={cn(
                    "cursor-pointer border-t border-white/5 hover:bg-white/5",
                    selected.has(app.id) && "bg-cyan-500/5"
                  )}
                >
                  <td
                    className="px-3 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={selected.has(app.id)}
                      onCheckedChange={() => toggleOne(app.id)}
                      aria-label={`Select ${app.referenceCode}`}
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-white/70">
                    {app.referenceCode}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">
                      {app.applicant.firstName} {app.applicant.lastName}
                    </p>
                    <p className="text-[11px] text-white/40">
                      {app.applicant.sex ?? ""}
                      {app.applicant.dateOfBirth
                        ? ` · ${format(
                            new Date(app.applicant.dateOfBirth),
                            "MMM d, yyyy"
                          )}`
                        : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-white/70">
                    {app.applicant.intendedGradeName ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-white/85">
                      {app.guardian.firstName} {app.guardian.lastName}
                    </p>
                    <p className="text-[11px] text-white/40">{app.guardian.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        "border px-2 py-0.5 text-[11px] font-medium",
                        STATUS_BADGES[app.status]
                      )}
                    >
                      {app.status.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/55">
                    {app.submittedAt
                      ? format(new Date(app.submittedAt), "MMM d, p")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-white/70">
                      {app.documentsCount > 0 ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <XCircle className="h-3 w-3 text-white/40" />
                      )}
                      {app.documentsCount}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex items-center justify-between border-t border-white/5 px-4 py-2.5">
            <p className="text-[11px] text-white/40">
              <Clock className="mr-1 inline h-3 w-3" />
              Showing {items.length} of {total} application{total === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
              {items[0]?.trackerToken ? (
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="ml-2 text-white/55"
                >
                  <a
                    href={`/apply/track/${items[0].trackerToken}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Sample tracker
                    <ExternalLink className="ml-1.5 h-3 w-3" />
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <ApplicationDetailDrawer
        applicationId={openId}
        onClose={() => setOpenId(null)}
      />

      <ApplicationsBulkBar
        selectedIds={Array.from(selected)}
        onClearSelection={() => setSelected(new Set())}
      />
    </div>
  );
}
