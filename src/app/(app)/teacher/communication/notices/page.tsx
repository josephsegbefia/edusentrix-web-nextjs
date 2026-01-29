"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, Megaphone, MoreHorizontal, Plus, Send, Trash2 } from "lucide-react";
import { useTeacherNotices } from "@/hooks/teacher/useTeacherNotices";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useBusyToast } from "@/hooks/useBusyToast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const statusStyles: Record<string, string> = {
  draft: "bg-amber-500/20 text-amber-200",
  scheduled: "bg-sky-500/20 text-sky-200",
  published: "bg-emerald-500/20 text-emerald-200",
  archived: "bg-white/10 text-white/50",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

export default function TeacherNoticesPage() {
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const busyToast = useBusyToast();

  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canPublish = can(permissions, PERMISSIONS.noticesPublish);
  const canView = can(permissions, PERMISSIONS.noticesView);

  const { data, isLoading, refetch } = useTeacherNotices({
    status: statusFilter === "all" ? undefined : statusFilter,
    search: search || undefined,
  });

  const notices = data?.data.notices || [];

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Notices</h1>
          <p className="text-sm text-white/60">Create announcements for your classes and students.</p>
        </div>
        {canPublish && (
          <Button
            asChild
            className="bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
          >
            <Link href="/teacher/communication/notices/new">
              <Plus className="h-4 w-4" />
              New notice
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center">
        <div className="min-w-[180px]">
          <PremiumSelect value={statusFilter} onValueChange={setStatusFilter}>
            <PremiumSelectTrigger>
              <PremiumSelectValue placeholder="Filter status" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              {statusOptions.map((opt) => (
                <PremiumSelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
        </div>
        <div className="flex-1">
          <Input
            placeholder="Search notices"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="border-white/10 bg-white/5 text-white"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
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
              className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur"
            >
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg text-white">{notice.title}</CardTitle>
                  <div className="text-xs text-white/50">
                    {notice.audience.toUpperCase()} · Created {formatDate(notice.createdAt)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", statusStyles[notice.status])}>
                    {notice.status.replace("_", " ")}
                  </span>
                  {canPublish && (
                    <PremiumDropdownMenu>
                      <PremiumDropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-white/60 hover:text-white">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </PremiumDropdownMenuTrigger>
                      <PremiumDropdownMenuContent align="end">
                        {(notice.status === "draft" || notice.status === "scheduled") && (
                          <PremiumDropdownMenuItem onClick={() => handlePublish(notice.id)} icon={<Send className="h-4 w-4" />}>
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
              <CardContent className="space-y-3 text-sm text-white/60">
                <p className="line-clamp-3">{notice.message}</p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-white/50">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {notice.status === "scheduled"
                      ? `Scheduled for ${formatDate(notice.scheduledFor)}`
                      : notice.status === "published"
                        ? `Published ${formatDate(notice.publishedAt)}`
                        : "Draft"}
                  </span>
                  {notice.counts.classGroups > 0 && <span>{notice.counts.classGroups} class groups</span>}
                  {notice.counts.subjects > 0 && <span>{notice.counts.subjects} subjects</span>}
                  {notice.counts.students > 0 && <span>{notice.counts.students} students</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
