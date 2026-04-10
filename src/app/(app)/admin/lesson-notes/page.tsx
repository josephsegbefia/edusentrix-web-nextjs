"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpen, ChevronRight, Filter, MessageSquare, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { useAdminLessonNotes } from "@/hooks/admin/useAdminLessonNotes";
import type { LessonNoteStatus } from "@/types/lesson-notes";

const STATUS_OPTIONS: Array<{ value: LessonNoteStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "published", label: "Published" },
];

export default function AdminLessonNotesPage() {
  const [search, setSearch] = React.useState("");
  const [teacherId, setTeacherId] = React.useState("all");
  const [classGroupId, setClassGroupId] = React.useState("all");
  const [subjectId, setSubjectId] = React.useState("all");
  const [status, setStatus] = React.useState<LessonNoteStatus | "all">("all");

  const { data, isLoading, error } = useAdminLessonNotes({
    teacherId: teacherId === "all" ? undefined : teacherId,
    classGroupId: classGroupId === "all" ? undefined : classGroupId,
    subjectId: subjectId === "all" ? undefined : subjectId,
    status: status === "all" ? undefined : status,
    search: search || undefined,
    limit: 100,
  });

  const entries = data?.data.entries || [];
  const summary = data?.data.summary;

  const teacherOptions = React.useMemo(
    () =>
      Array.from(
        new Map(
          entries
            .filter((entry) => entry.teacherId && entry.teacherName)
            .map((entry) => [entry.teacherId, entry.teacherName || "Unknown teacher"])
        ).entries()
      )
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [entries]
  );

  const classOptions = React.useMemo(
    () =>
      Array.from(
        new Map(
          entries
            .filter((entry) => entry.classGroupId && entry.className)
            .map((entry) => [entry.classGroupId, entry.className || "Unknown class"])
        ).entries()
      )
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [entries]
  );

  const subjectOptions = React.useMemo(
    () =>
      Array.from(
        new Map(
          entries
            .filter((entry) => entry.subjectId && entry.subjectName)
            .map((entry) => [entry.subjectId as string, entry.subjectName || "Unknown subject"])
        ).entries()
      )
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [entries]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Lesson Notes Review</h1>
          <p className="text-sm text-white/60">
            Track every teacher lesson note across the school and review sections with comments.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent">
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-white/40">Visible Notes</div>
            <div className="mt-3 text-3xl font-semibold text-white">{summary?.total || 0}</div>
          </CardContent>
        </Card>
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent">
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-white/40">Open Comments</div>
            <div className="mt-3 text-3xl font-semibold text-white">
              {summary?.openComments || 0}
            </div>
          </CardContent>
        </Card>
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent">
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-white/40">Submitted</div>
            <div className="mt-3 text-3xl font-semibold text-white">
              {summary?.byStatus?.submitted || 0}
            </div>
          </CardContent>
        </Card>
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent">
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-white/40">Published</div>
            <div className="mt-3 text-3xl font-semibold text-white">
              {summary?.byStatus?.published || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent">
        <CardContent className="p-4">
          <div className="grid gap-3 lg:grid-cols-[1.5fr_repeat(4,minmax(0,1fr))]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by topic or tag"
                className="border-white/10 bg-white/5 pl-10 text-white"
              />
            </div>
            <PremiumSelect value={teacherId} onValueChange={setTeacherId}>
              <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white">
                <PremiumSelectValue placeholder="Teacher" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="all">All teachers</PremiumSelectItem>
                {teacherOptions.map((option) => (
                  <PremiumSelectItem key={option.value} value={option.value}>
                    {option.label}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
            <PremiumSelect value={classGroupId} onValueChange={setClassGroupId}>
              <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white">
                <PremiumSelectValue placeholder="Class" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="all">All classes</PremiumSelectItem>
                {classOptions.map((option) => (
                  <PremiumSelectItem key={option.value} value={option.value}>
                    {option.label}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
            <PremiumSelect value={subjectId} onValueChange={setSubjectId}>
              <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white">
                <PremiumSelectValue placeholder="Subject" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="all">All subjects</PremiumSelectItem>
                {subjectOptions.map((option) => (
                  <PremiumSelectItem key={option.value} value={option.value}>
                    {option.label}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
            <PremiumSelect value={status} onValueChange={(value) => setStatus(value as LessonNoteStatus | "all")}>
              <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white">
                <PremiumSelectValue placeholder="Status" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <PremiumSelectItem key={option.value} value={option.value}>
                    {option.label}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card className="border border-rose-500/20 bg-rose-500/10">
          <CardContent className="p-5 text-sm text-rose-100">
            {error.message || "Failed to load lesson notes."}
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-44 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <BookOpen className="h-8 w-8 text-white/40" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-white">No lesson notes found</h2>
              <p className="mt-2 text-sm text-white/55">
                Adjust the filters or wait for teachers to start publishing notes.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {entries.map((note) => (
            <Link key={note.id} href={`/admin/lesson-notes/${note.id}`} className="block">
              <Card className="group h-full border border-white/10 bg-linear-to-br from-white/5 to-transparent transition-all hover:border-white/20">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <CardTitle className="text-base text-white transition-colors group-hover:text-sky-100">
                        {note.topic}
                      </CardTitle>
                      <div className="text-sm text-white/55">
                        {note.teacherName || "Unknown teacher"} • {note.className}
                        {note.subjectName ? ` • ${note.subjectName}` : ""}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-white/30 transition-transform group-hover:translate-x-1" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-white/10 text-white/65">{note.status}</Badge>
                    <Badge className="bg-sky-500/15 text-sky-100">
                      <MessageSquare className="mr-1 h-3 w-3" />
                      {note.openCommentCount} open
                    </Badge>
                    <Badge className="bg-white/10 text-white/65">
                      {note.totalCommentCount} total comment
                      {note.totalCommentCount === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  <div className="text-sm text-white/45">
                    Week of {note.weekOf ? new Date(note.weekOf).toLocaleDateString("en-GB") : "—"}
                  </div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/35">
                    <Filter className="h-3 w-3" />
                    Review note
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
