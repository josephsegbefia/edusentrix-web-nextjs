"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Megaphone,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { useTeacherCommunications, type TeacherCommunicationSummary } from "@/hooks/teacher/useTeacherCommunications";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useBusyToast } from "@/hooks/useBusyToast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuItem,
  PremiumDropdownMenuTrigger,
} from "@/components/ui/premium-dropdown-menu";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { cn } from "@/lib/utils";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { GlassPanel } from "@/components/ui/glass-panel";
import {
  glassInsetClass,
  glassPanelClass,
  glassPrimaryButtonClass,
  glassSecondaryButtonClass,
} from "@/lib/ui/glass-surfaces";

const statusOptions = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "queued", label: "Queued" },
  { value: "sending", label: "Sending" },
  { value: "sent", label: "Sent" },
  { value: "partially_sent", label: "Partially sent" },
  { value: "failed", label: "Failed" },
  { value: "archived", label: "Archived" },
];

const statusStyles: Record<TeacherCommunicationSummary["status"], string> = {
  draft: "bg-amber-500/20 text-amber-200",
  scheduled: "bg-sky-500/20 text-sky-200",
  queued: "bg-teal-500/20 text-teal-200",
  sending: "bg-cyan-500/20 text-cyan-200",
  sent: "bg-emerald-500/20 text-emerald-200",
  partially_sent: "bg-orange-500/20 text-orange-200",
  failed: "bg-rose-500/20 text-rose-200",
  cancelled: "bg-white/10 text-white/50",
  archived: "bg-white/10 text-white/50",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function timelineLabel(notice: TeacherCommunicationSummary) {
  if (notice.status === "scheduled") return `Scheduled for ${formatDateTime(notice.scheduledFor)}`;
  if (notice.status === "sent" || notice.status === "partially_sent") return `Sent ${formatDate(notice.sentAt)}`;
  if (notice.status === "queued" || notice.status === "sending") return "Delivery in progress";
  if (notice.status === "failed") return "Delivery failed";
  if (notice.status === "archived") return "Archived";
  return "Draft";
}

export default function TeacherNoticesPage() {
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const busyToast = useBusyToast();

  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canPublish = can(permissions, PERMISSIONS.noticesPublish);
  const canView = can(permissions, PERMISSIONS.noticesView);

  const { data, isLoading, refetch } = useTeacherCommunications({
    status: statusFilter === "all" ? undefined : statusFilter,
    search: search || undefined,
    page,
    limit: 12,
  });

  const notices = React.useMemo(() => data?.data.items ?? [], [data]);
  const pagination = data?.data.pagination;

  const stats = React.useMemo(() => {
    const total = notices.length;
    const drafts = notices.filter((notice) => notice.status === "draft").length;
    const scheduled = notices.filter((notice) => notice.status === "scheduled").length;
    const sent = notices.filter((notice) => notice.status === "sent" || notice.status === "partially_sent").length;
    const archived = notices.filter((notice) => notice.status === "archived").length;
    return { total, drafts, scheduled, sent, archived };
  }, [notices]);

  const handleSend = async (id: string) => {
    await busyToast.promise(
      fetch(`/api/teacher/communications/${id}/send`, { method: "POST" }).then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(payload?.error || "Failed to send notice");
        }
        return payload;
      }),
      {
        loading: "Sending notice...",
        success: "Notice sent",
        error: "Failed to send notice",
      }
    );
    await refetch();
  };

  const handleArchive = async (id: string) => {
    await busyToast.promise(
      fetch(`/api/teacher/communications/${id}`, { method: "DELETE" }).then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(payload?.error || "Failed to archive notice");
        }
        return payload;
      }),
      {
        loading: "Archiving notice...",
        success: "Notice archived",
        error: "Failed to archive notice",
      }
    );
    await refetch();
  };

  if (!canView) {
    return (
      <WorkspacePageShell>
        <WorkspacePageHeader
          icon={Megaphone}
          title="Notices"
          subtitle="Send class updates through app inbox and email."
        />
        <GlassPanel className="p-8 text-center">
          <p className="text-sm text-white/70">You don&apos;t have access to notices yet.</p>
          <p className="mt-2 text-xs text-white/50">
            Ask your admin to enable notice permissions for your account.
          </p>
        </GlassPanel>
      </WorkspacePageShell>
    );
  }

  const newNoticeAction = canPublish ? (
    <Button asChild className={glassPrimaryButtonClass}>
      <Link href="/teacher/communication/notices/new">
        <Plus className="h-4 w-4" />
        New notice
      </Link>
    </Button>
  ) : null;

  return (
    <WorkspacePageShell>
      <WorkspacePageHeader
        icon={Megaphone}
        title="Notices"
        subtitle="Send class updates through the communications engine with app inbox and email delivery."
        badge={
          !isLoading ? (
            <span className="rounded-full border border-teal-400/30 bg-teal-500/15 px-3 py-1 text-xs font-medium text-teal-200">
              {stats.total} notice{stats.total === 1 ? "" : "s"}
            </span>
          ) : undefined
        }
        actions={newNoticeAction}
      />

      <div className="flex flex-wrap gap-2">
        <Badge className="border border-amber-400/20 bg-amber-500/15 text-amber-200">
          {stats.drafts} drafts
        </Badge>
        <Badge className="border border-sky-400/20 bg-sky-500/15 text-sky-200">
          {stats.scheduled} scheduled
        </Badge>
        <Badge className="border border-emerald-400/20 bg-emerald-500/15 text-emerald-200">
          {stats.sent} sent
        </Badge>
        <Badge className="border border-white/10 bg-white/5 text-white/70">
          {stats.archived} archived
        </Badge>
      </div>

      {!canPublish && (
        <div className={cn(glassInsetClass, "rounded-xl px-3 py-2 text-xs text-white/60")}>
          Drafting available. Publishing is restricted for your role.
        </div>
      )}

      <Card className={glassPanelClass}>
        <CardHeader>
          <CardTitle className="text-lg">Filter notices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[280px_1fr]">
            <PremiumSelect value={statusFilter} onValueChange={setStatusFilter}>
              <PremiumSelectTrigger>
                <PremiumSelectValue placeholder="Filter status" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {statusOptions.map((option) => (
                  <PremiumSelectItem key={option.value} value={option.value}>
                    {option.label}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <Input
                placeholder="Search notices"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className={cn(glassInsetClass, "pl-9 text-white placeholder:text-white/35")}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStatusFilter("all");
                setSearch("");
                setPage(1);
              }}
              className={glassSecondaryButtonClass}
            >
              Reset filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className={cn(glassInsetClass, "h-36 animate-pulse rounded-2xl")} />
          ))}
        </div>
      ) : notices.length === 0 ? (
        <GlassPanel className="p-8 text-center">
          <p className="text-sm text-white/60">
            No notices yet. Create your first class notice to reach parents through app and email.
          </p>
          {canPublish && (
            <Button asChild className={cn("mt-4", glassPrimaryButtonClass)}>
              <Link href="/teacher/communication/notices/new">
                <Plus className="h-4 w-4" />
                New notice
              </Link>
            </Button>
          )}
        </GlassPanel>
      ) : (
        <div className="space-y-4">
          {notices.map((notice) => (
            <Card
              key={notice.id}
              className={cn(glassPanelClass, "transition hover:border-white/20 hover:-translate-y-0.5")}
            >
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-lg text-white">{notice.title}</CardTitle>
                    <Badge className={cn("rounded-full px-2.5 py-0.5", statusStyles[notice.status])}>
                      {notice.status.replace("_", " ").toUpperCase()}
                    </Badge>
                    <Badge className="rounded-full border border-teal-400/20 bg-teal-500/15 px-2.5 py-0.5 text-teal-200">
                      CLASS GROUPS
                    </Badge>
                  </div>
                  <p className="line-clamp-2 text-sm text-white/70">{notice.bodyText}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-white/50">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Created {formatDate(notice.createdAt)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="h-3.5 w-3.5" />
                      {timelineLabel(notice)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {canPublish && (
                    <PremiumDropdownMenu>
                      <PremiumDropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-white/60 hover:bg-white/10 hover:text-white"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </PremiumDropdownMenuTrigger>
                      <PremiumDropdownMenuContent align="end">
                        {["draft", "scheduled", "failed"].includes(notice.status) && (
                          <PremiumDropdownMenuItem
                            onClick={() => handleSend(notice.id)}
                            icon={<Send className="h-4 w-4" />}
                          >
                            Send now
                          </PremiumDropdownMenuItem>
                        )}
                        {notice.status !== "archived" && (
                          <PremiumDropdownMenuItem
                            variant="destructive"
                            onClick={() => handleArchive(notice.id)}
                            icon={<Trash2 className="h-4 w-4" />}
                          >
                            Archive
                          </PremiumDropdownMenuItem>
                        )}
                      </PremiumDropdownMenuContent>
                    </PremiumDropdownMenu>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <div
                  className={cn(
                    glassInsetClass,
                    "grid gap-2 rounded-xl p-3 text-xs text-white/55 sm:grid-cols-4"
                  )}
                >
                  <div className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {notice.audience.classGroupIds?.length || 0} class groups
                  </div>
                  <div className="inline-flex items-center gap-1.5">
                    <Megaphone className="h-3.5 w-3.5" />
                    {notice.stats?.audienceCount ?? 0} recipients
                  </div>
                  <div className="inline-flex items-center gap-1.5">
                    <Send className="h-3.5 w-3.5" />
                    {notice.stats?.sentCount ?? 0} sent
                  </div>
                  <div className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Failed: {notice.stats?.failedCount ?? 0}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {pagination && pagination.totalPages > 1 && (
            <div
              className={cn(
                glassInsetClass,
                "flex items-center justify-between rounded-2xl p-3 text-sm text-white/60"
              )}
            >
              <span>
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  className={glassSecondaryButtonClass}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((value) => value + 1)}
                  className={glassSecondaryButtonClass}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </WorkspacePageShell>
  );
}
