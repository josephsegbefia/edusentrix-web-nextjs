"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Megaphone,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { useTeacherNotices, type TeacherNoticeSummary } from "@/hooks/teacher/useTeacherNotices";
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

const statusOptions = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

const audienceOptions = [
  { value: "all", label: "All audiences" },
  { value: "class", label: "Class groups" },
  { value: "subject", label: "Subjects" },
  { value: "custom", label: "Custom students" },
  { value: "school", label: "School-wide" },
];

const statusStyles: Record<TeacherNoticeSummary["status"], string> = {
  draft: "bg-amber-500/20 text-amber-200",
  scheduled: "bg-sky-500/20 text-sky-200",
  published: "bg-emerald-500/20 text-emerald-200",
  archived: "bg-white/10 text-white/50",
};

const audienceStyles: Record<TeacherNoticeSummary["audience"], string> = {
  class: "bg-indigo-500/20 text-indigo-200",
  subject: "bg-cyan-500/20 text-cyan-200",
  custom: "bg-purple-500/20 text-purple-200",
  school: "bg-rose-500/20 text-rose-200",
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

function timelineLabel(notice: TeacherNoticeSummary) {
  if (notice.status === "scheduled") return `Scheduled for ${formatDateTime(notice.scheduledFor)}`;
  if (notice.status === "published") return `Published ${formatDate(notice.publishedAt)}`;
  if (notice.status === "archived") return "Archived";
  return "Draft";
}

export default function TeacherNoticesPage() {
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [audienceFilter, setAudienceFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const busyToast = useBusyToast();

  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canPublish = can(permissions, PERMISSIONS.noticesPublish);
  const canView = can(permissions, PERMISSIONS.noticesView);

  const { data, isLoading, refetch } = useTeacherNotices({
    status: statusFilter === "all" ? undefined : statusFilter,
    audience: audienceFilter === "all" ? undefined : audienceFilter,
    search: search || undefined,
  });

  const notices = React.useMemo(() => data?.data.notices ?? [], [data]);

  const stats = React.useMemo(() => {
    const total = notices.length;
    const drafts = notices.filter((notice) => notice.status === "draft").length;
    const scheduled = notices.filter((notice) => notice.status === "scheduled").length;
    const published = notices.filter((notice) => notice.status === "published").length;
    const archived = notices.filter((notice) => notice.status === "archived").length;
    return { total, drafts, scheduled, published, archived };
  }, [notices]);

  const handlePublish = async (id: string) => {
    await busyToast.promise(
      fetch(`/api/teacher/notices/${id}/publish`, { method: "POST" }).then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(payload?.error || "Failed to publish notice");
        }
        return payload;
      }),
      {
        loading: "Publishing notice...",
        success: "Notice published",
        error: "Failed to publish notice",
      }
    );
    await refetch();
  };

  const handleArchive = async (id: string) => {
    await busyToast.promise(
      fetch(`/api/teacher/notices/${id}`, { method: "DELETE" }).then(async (res) => {
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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Notices</h1>
          <p className="text-sm text-white/60">You don&apos;t have access to notices yet.</p>
        </div>
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60">
                <Megaphone className="h-4 w-4" />
              </span>
              Notices locked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
              Ask your admin to enable notice permissions for your account.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border border-white/10 bg-linear-to-br from-emerald-500/15 via-white/5 to-sky-500/10 shadow-2xl shadow-black/35 backdrop-blur">
        <CardContent className="grid gap-5 p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="space-y-3">
            <Badge className="w-fit bg-white/10 text-white/80">
              <Sparkles className="h-3.5 w-3.5" />
              Communication hub
            </Badge>
            <div>
              <h1 className="text-2xl font-semibold text-white">Notices</h1>
              <p className="text-sm text-white/65">
                Broadcast updates to classes, subjects, or selected students with full delivery control.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-emerald-500/20 text-emerald-100">{stats.total} total</Badge>
              <Badge className="bg-amber-500/20 text-amber-100">{stats.drafts} drafts</Badge>
              <Badge className="bg-sky-500/20 text-sky-100">{stats.scheduled} scheduled</Badge>
              <Badge className="bg-indigo-500/20 text-indigo-100">{stats.published} published</Badge>
              <Badge className="bg-white/10 text-white/70">{stats.archived} archived</Badge>
            </div>
          </div>

          <div className="flex flex-col gap-2 lg:items-end">
            {canPublish && (
              <Button
                asChild
                className="bg-emerald-500/30 text-emerald-50 hover:bg-emerald-500/40"
              >
                <Link href="/teacher/communication/notices/new">
                  <Plus className="h-4 w-4" />
                  New notice
                </Link>
              </Button>
            )}
            {!canPublish && (
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
                Drafting available. Publishing is restricted for your role.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg">Filter notices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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

            <PremiumSelect value={audienceFilter} onValueChange={setAudienceFilter}>
              <PremiumSelectTrigger>
                <PremiumSelectValue placeholder="Filter audience" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {audienceOptions.map((option) => (
                  <PremiumSelectItem key={option.value} value={option.value}>
                    {option.label}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>

            <div className="relative xl:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <Input
                placeholder="Search notices"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-white/35"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStatusFilter("all");
                setAudienceFilter("all");
                setSearch("");
              }}
              className="border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
            >
              Reset filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-36 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
          ))}
        </div>
      ) : notices.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
          No notices yet. Create your first announcement to reach students.
        </div>
      ) : (
        <div className="space-y-4">
          {notices.map((notice) => (
            <Card
              key={notice.id}
              className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur transition hover:border-white/20"
            >
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-lg text-white">{notice.title}</CardTitle>
                    <Badge className={cn("rounded-full px-2.5 py-0.5", statusStyles[notice.status])}>
                      {notice.status.replace("_", " ").toUpperCase()}
                    </Badge>
                    <Badge className={cn("rounded-full px-2.5 py-0.5", audienceStyles[notice.audience])}>
                      {notice.audience.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="line-clamp-2 text-sm text-white/70">{notice.message}</p>
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
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-white/60 hover:bg-white/10 hover:text-white">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </PremiumDropdownMenuTrigger>
                      <PremiumDropdownMenuContent align="end">
                        {(notice.status === "draft" || notice.status === "scheduled") && (
                          <PremiumDropdownMenuItem
                            onClick={() => handlePublish(notice.id)}
                            icon={<Send className="h-4 w-4" />}
                          >
                            Publish now
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
                <div className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/55 sm:grid-cols-4">
                  <div className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {notice.counts.classGroups} class groups
                  </div>
                  <div className="inline-flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    {notice.counts.subjects} subjects
                  </div>
                  <div className="inline-flex items-center gap-1.5">
                    <Megaphone className="h-3.5 w-3.5" />
                    {notice.counts.students} students
                  </div>
                  <div className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Scope: {notice.audience}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
