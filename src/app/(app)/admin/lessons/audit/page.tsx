"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns/format";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, ScrollText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAdminLessonAuditLog } from "@/hooks/admin/useAdminLessonAuditLog";
import { cn } from "@/lib/utils";
import { WorkspaceScope } from "@/components/theme/workspace-scope";

const PAGE_SIZE = 40;

export default function AdminLessonAuditLogPage() {
  const [page, setPage] = React.useState(0);
  const [lessonFilter, setLessonFilter] = React.useState("");
  const [appliedFilter, setAppliedFilter] = React.useState("");

  const { data, isLoading, isFetching, error, refetch } = useAdminLessonAuditLog(
    page,
    appliedFilter,
    PAGE_SIZE,
    true
  );

  const applyFilter = () => {
    setPage(0);
    setAppliedFilter(lessonFilter.trim());
  };

  return (
    <WorkspaceScope>
    <div className="space-y-8 p-6 text-(--ws-fg) md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/20 text-(--ws-cyan)">
            <ScrollText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Lesson audit log</h1>
            <p className="text-sm text-(--ws-fg-50)">
              Publish, resources, and related delivery events (school-scoped).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            asChild
            className="border-(--ws-line-strong) bg-(--ws-fill) text-(--ws-fg) hover:bg-(--ws-fill-strong)"
          >
            <Link href="/admin/lessons/analytics">Lesson analytics</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="border-(--ws-line-strong) bg-(--ws-fill) text-(--ws-fg) hover:bg-(--ws-fill-strong)"
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <Card className="border border-(--ws-line) bg-linear-to-br from-white/5 to-transparent shadow-[var(--ws-shadow)] backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg text-(--ws-fg)">Filter</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label className="text-(--ws-fg-70)">Lesson ID (optional)</Label>
            <Input
              value={lessonFilter}
              onChange={(e) => setLessonFilter(e.target.value)}
              placeholder="Mongo ObjectId…"
              className="border-(--ws-line) bg-(--ws-fill) text-(--ws-fg)"
            />
          </div>
          <Button
            type="button"
            onClick={() => applyFilter()}
            className="bg-sky-500/25 text-(--ws-cyan) hover:bg-sky-500/35"
          >
            Apply
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card className="border border-rose-500/30 bg-rose-500/10">
          <CardContent className="p-4 text-sm text-(--ws-rose)">{error.message}</CardContent>
        </Card>
      )}

      <Card className="border border-(--ws-line) bg-linear-to-br from-white/5 to-transparent shadow-[var(--ws-shadow)] backdrop-blur">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg text-(--ws-fg)">Events</CardTitle>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 0 || isLoading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="border-(--ws-line-strong) bg-(--ws-fill) text-(--ws-fg)"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!data?.hasMore || isLoading}
              onClick={() => setPage((p) => p + 1)}
              className="border-(--ws-line-strong) bg-(--ws-fill) text-(--ws-fg)"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-(--ws-fg-40)" />
            </div>
          ) : !data?.entries.length ? (
            <p className="py-10 text-center text-sm text-(--ws-fg-50)">No audit entries found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-(--ws-line) text-xs uppercase tracking-wide text-(--ws-fg-40)">
                    <th className="pb-3 pr-4 font-medium">When</th>
                    <th className="pb-3 pr-4 font-medium">Action</th>
                    <th className="pb-3 pr-4 font-medium">Lesson</th>
                    <th className="pb-3 pr-4 font-medium">Actor</th>
                    <th className="pb-3 font-medium">Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((row) => (
                    <tr key={row.id} className="border-b border-(--ws-line) text-(--ws-fg)/85">
                      <td className="py-3 pr-4 align-top whitespace-nowrap text-(--ws-fg-70)">
                        {row.createdAt
                          ? format(new Date(row.createdAt), "yyyy-MM-dd HH:mm")
                          : "—"}
                      </td>
                      <td className="py-3 pr-4 align-top">
                        <Badge
                          variant="outline"
                          className="border-(--ws-line-strong) font-mono text-[11px] text-(--ws-fg-80)"
                        >
                          {row.action}
                        </Badge>
                      </td>
                      <td className="max-w-[140px] py-3 pr-4 align-top font-mono text-xs break-all text-(--ws-violet)">
                        {row.lessonId}
                      </td>
                      <td className="max-w-[200px] py-3 pr-4 align-top text-sm text-(--ws-fg-80)">
                        {row.actorLabel ? (
                          <span>
                            {row.actorLabel}
                            <span className="mt-0.5 block font-mono text-[10px] text-(--ws-fg-40)">
                              {row.actorId}
                            </span>
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-(--ws-fg-60)">{row.actorId}</span>
                        )}
                      </td>
                      <td className="max-w-md py-3 align-top font-mono text-[11px] text-(--ws-fg-50) break-all">
                        {Object.keys(row.metadata).length
                          ? JSON.stringify(row.metadata)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data && data.entries.length > 0 && (
            <p className="mt-4 text-xs text-(--ws-fg-40)">
              Page {page + 1}
              {data.hasMore ? " · more available" : ""}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
    </WorkspaceScope>
  );
}
