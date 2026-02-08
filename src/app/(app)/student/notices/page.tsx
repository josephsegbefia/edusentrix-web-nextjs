"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  AlertCircle,
  Bell,
  Paperclip,
  RefreshCw,
  Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface StudentNotice {
  id: string;
  title: string;
  message: string;
  status: "draft" | "published" | "scheduled" | "archived";
  audience: "class" | "subject" | "school" | "custom";
  attachments: Array<{
    name: string;
    url: string;
    type: string;
    size?: number;
  }>;
  counts: {
    classGroups: number;
    subjects: number;
    students: number;
  };
  scheduledFor: string | null;
  publishedAt: string | null;
  createdAt: string | null;
}

function formatNoticeDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "MMM d, yyyy • h:mm a");
}

export default function StudentNoticesPage() {
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notices, setNotices] = React.useState<StudentNotice[]>([]);
  const [search, setSearch] = React.useState("");
  const [searchDraft, setSearchDraft] = React.useState("");

  const loadNotices = React.useCallback(async (searchTerm?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);

      const response = await fetch(`/api/student/notices?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to load notices");
      }

      setNotices((payload.data?.notices || []) as StudentNotice[]);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error ? fetchError.message : "Failed to load notices"
      );
      setNotices([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchDraft.trim());
    }, 350);
    return () => clearTimeout(timeout);
  }, [searchDraft]);

  React.useEffect(() => {
    void loadNotices(search || undefined);
  }, [loadNotices, search]);

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card className="rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-brand/15 text-brand">
                <Bell className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl text-white">Notices</CardTitle>
              <p className="mt-1 text-sm text-white/65">
                School announcements and updates targeted to your class.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => void loadNotices(search || undefined)}
              disabled={isLoading}
              className="border-white/10 bg-white/5 hover:bg-white/10"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </CardHeader>
        </Card>

        <Card className="rounded-2xl border border-white/10 bg-white/5">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
              <Input
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Search notices"
                className="border-white/10 bg-black/20 pl-9 text-white"
              />
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <Card className="rounded-2xl border border-red-500/25 bg-red-500/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-red-200">
                <AlertCircle className="h-5 w-5" />
                <p>{error}</p>
              </div>
            </CardContent>
          </Card>
        ) : notices.length === 0 ? (
          <Card className="rounded-2xl border border-white/10 bg-white/5">
            <CardContent className="p-8 text-center text-sm text-white/60">
              No notices available right now.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {notices.map((notice) => (
              <Card
                key={notice.id}
                className="rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60"
              >
                <CardHeader className="space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <CardTitle className="text-lg text-white">{notice.title}</CardTitle>
                    <Badge
                      variant="outline"
                      className="border-brand/30 bg-brand/10 text-brand capitalize"
                    >
                      {notice.audience}
                    </Badge>
                  </div>
                  <p className="text-xs text-white/45">
                    Published {formatNoticeDate(notice.publishedAt)} • Created{" "}
                    {formatNoticeDate(notice.createdAt)}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-white/75">
                  <p className="whitespace-pre-wrap">{notice.message}</p>

                  {(notice.counts.classGroups > 0 ||
                    notice.counts.subjects > 0 ||
                    notice.counts.students > 0) && (
                    <div className="flex flex-wrap gap-2 text-xs text-white/55">
                      {notice.counts.classGroups > 0 && (
                        <span>{notice.counts.classGroups} class group(s)</span>
                      )}
                      {notice.counts.subjects > 0 && (
                        <span>{notice.counts.subjects} subject(s)</span>
                      )}
                      {notice.counts.students > 0 && (
                        <span>{notice.counts.students} student(s)</span>
                      )}
                    </div>
                  )}

                  {notice.attachments.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-white/40">
                        Attachments
                      </p>
                      {notice.attachments.map((attachment, index) => (
                        <a
                          key={`${attachment.url}-${index}`}
                          href={attachment.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="flex items-center gap-2 text-sm text-brand hover:text-brand/80"
                        >
                          <Paperclip className="h-4 w-4" />
                          {attachment.name || `Attachment ${index + 1}`}
                        </a>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
