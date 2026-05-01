"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  ExternalLink,
  Library,
  Presentation,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeacherLessonBank } from "@/hooks/teacher/useTeacherLessonBank";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { cn } from "@/lib/utils";
import { LESSON_STATUS_LABELS, type LessonDeliveryStatus } from "@/types/lessons";

export default function TeacherLessonBankPage() {
  const { data: ctx } = useTeacherContext();
  const myTeacherId = ctx?.success ? ctx.data.teacher._id : null;
  const [q, setQ] = React.useState("");
  const [submitted, setSubmitted] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | LessonDeliveryStatus>("all");
  const { data: entries, isLoading, isError, refetch, isFetching } = useTeacherLessonBank({
    q: submitted,
    limit: 50,
  });

  const rows = entries ?? [];
  const filteredRows =
    statusFilter === "all" ? rows : rows.filter((row) => row.status === statusFilter);

  const publishedCount = rows.filter((row) => row.status === "published").length;
  const archivedCount = rows.filter((row) => row.status === "archived").length;
  const mineCount = myTeacherId
    ? rows.filter((row) => row.ownerTeacherId === myTeacherId).length
    : 0;

  return (
    <div className="space-y-6 p-6 text-white md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-200">
              <Library className="h-5 w-5 text-violet-200" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Lesson bank</h1>
              <p className="text-sm text-white/55">
                Discover school-wide published and archived lessons to reuse faster.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="border-white/15 bg-white/5 text-white/85 hover:bg-white/10"
            asChild
          >
            <Link href="/teacher/lessons">
              <Presentation className="mr-2 h-4 w-4" />
              My lessons
            </Link>
          </Button>
          <Button
            variant="outline"
            className="border-white/15 bg-white/5 text-white/85 hover:bg-white/10"
            asChild
          >
            <Link href="/teacher/lessons/analytics">
              <BookOpen className="mr-2 h-4 w-4" />
              Analytics
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-white/15 bg-white/5 text-white/85 hover:bg-white/10"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-white/45">Shown</p>
            <p className="mt-1 text-2xl font-semibold text-white">{filteredRows.length}</p>
            <p className="mt-1 text-xs text-white/50">After current filters</p>
          </CardContent>
        </Card>
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-white/45">Published</p>
            <p className="mt-1 text-2xl font-semibold text-white">{publishedCount}</p>
            <p className="mt-1 text-xs text-white/50">School-wide in loaded window</p>
          </CardContent>
        </Card>
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-white/45">Archived</p>
            <p className="mt-1 text-2xl font-semibold text-white">{archivedCount}</p>
            <p className="mt-1 text-xs text-white/50">Still reusable references</p>
          </CardContent>
        </Card>
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-white/45">By me</p>
            <p className="mt-1 text-2xl font-semibold text-white">{mineCount}</p>
            <p className="mt-1 text-xs text-white/50">Your lessons in this bank</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-white">Search & filter</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setSubmitted(q.trim());
              }}
              placeholder="Search by title…"
              className="border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/35"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={statusFilter === "all" ? "secondary" : "outline"}
              size="sm"
              className={cn(
                "h-9",
                statusFilter === "all"
                  ? "bg-white/15 text-white hover:bg-white/20"
                  : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
              )}
              onClick={() => setStatusFilter("all")}
            >
              All
            </Button>
            <Button
              type="button"
              variant={statusFilter === "published" ? "secondary" : "outline"}
              size="sm"
              className={cn(
                "h-9",
                statusFilter === "published"
                  ? "bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
                  : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
              )}
              onClick={() => setStatusFilter("published")}
            >
              Published
            </Button>
            <Button
              type="button"
              variant={statusFilter === "archived" ? "secondary" : "outline"}
              size="sm"
              className={cn(
                "h-9",
                statusFilter === "archived"
                  ? "bg-white/15 text-white hover:bg-white/20"
                  : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
              )}
              onClick={() => setStatusFilter("archived")}
            >
              Archived
            </Button>
          </div>
          <Button
            type="button"
            className="bg-violet-500/30 text-violet-100 hover:bg-violet-500/40"
            disabled={isFetching}
            onClick={() => setSubmitted(q.trim())}
          >
            Search
          </Button>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-44 rounded-2xl bg-white/10" />
          ))}
        </div>
      )}

      {isError && (
        <Card className="border border-rose-500/30 bg-rose-500/10">
          <CardContent className="p-4 text-sm text-rose-100">
            Could not load the lesson bank.{" "}
            <button type="button" className="underline" onClick={() => void refetch()}>
              Retry
            </button>
          </CardContent>
        </Card>
      )}

      {!isLoading && rows.length === 0 && (
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Library className="mb-4 h-10 w-10 text-white/35" />
            <h3 className="text-lg font-medium text-white">No lessons in the bank yet</h3>
            <p className="mt-2 max-w-md text-sm text-white/55">
              Published and archived lessons from your school will appear here for reuse.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && rows.length > 0 && filteredRows.length === 0 && (
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardContent className="p-10 text-center text-sm text-white/55">
            No lessons match your current search/filter.
          </CardContent>
        </Card>
      )}

      {filteredRows.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRows.map((row) => (
            <Card
              key={row.id}
              className="group border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur transition-all hover:border-violet-500/30"
            >
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="line-clamp-2 font-semibold text-white">{row.title}</h2>
                    <Badge className="border-white/15 bg-white/10 text-white/75">
                      {LESSON_STATUS_LABELS[row.status as LessonDeliveryStatus] ?? row.status}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-white/50">
                  {[row.classDisplayLabel, row.subjectName, row.ownerDisplayName].filter(Boolean).join(" · ")}
                </p>
                {row.lessonNoteTopic ? (
                  <p className="line-clamp-1 text-xs text-white/40">Note: {row.lessonNoteTopic}</p>
                ) : null}
                <div className="flex flex-wrap items-center gap-3 text-xs text-white/45">
                  {row.publishedAt ? (
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {new Date(row.publishedAt).toLocaleDateString()}
                    </span>
                  ) : null}
                  {row.ownerTeacherId === myTeacherId ? (
                    <span className="inline-flex items-center gap-1 text-violet-200/85">
                      <Users className="h-3.5 w-3.5" />
                      Yours
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/15 bg-white/5 text-white/85 hover:bg-white/10"
                    asChild
                  >
                    <Link href={`/teacher/lesson-notes/${row.lessonNoteId}`}>Source note</Link>
                  </Button>
                  {myTeacherId && row.ownerTeacherId === myTeacherId ? (
                    <Button
                      size="sm"
                      className="bg-violet-500/25 text-violet-100 hover:bg-violet-500/35"
                      asChild
                    >
                      <Link href={`/teacher/lessons/${row.id}`}>
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        Open lesson
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
