"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ClipboardCheck,
  Filter,
  MessageSquare,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  LessonNoteDeleteDialog,
  type LessonNoteDeleteTarget,
} from "@/components/teacher/lesson-notes/LessonNoteDeleteDialog";
import type { LessonNoteStatus } from "@/types/lesson-notes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { useAdminLessonNotes } from "@/hooks/admin/useAdminLessonNotes";

const STATUS_OPTIONS: Array<{ value: LessonNoteStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const glassPanel =
  "relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/35 backdrop-blur-xl";

type AdminLessonNotesInboxProps = {
  initialStatus?: LessonNoteStatus | "all";
  title?: string;
  description?: string;
  emptyMessage?: string;
};

export function AdminLessonNotesInbox({
  initialStatus = "all",
  title = "Lesson Notes Review",
  description = "Track every teacher lesson note across the school and review sections with comments.",
  emptyMessage = "Adjust the filters or wait for teachers to submit notes.",
}: AdminLessonNotesInboxProps = {}) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<LessonNoteDeleteTarget | null>(null);
  const [teacherId, setTeacherId] = React.useState("all");
  const [classGroupId, setClassGroupId] = React.useState("all");
  const [subjectId, setSubjectId] = React.useState("all");
  const [status, setStatus] = React.useState<LessonNoteStatus | "all">(initialStatus);

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
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-4 md:p-6">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-slate-900/95 via-slate-950 to-black p-5 shadow-2xl shadow-black/40 sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70 backdrop-blur-sm">
              <ClipboardCheck className="h-3.5 w-3.5 text-sky-200" />
              Instructional review
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">{description}</p>
          </div>
          <div className="grid w-full gap-2 sm:grid-cols-3 lg:max-w-xl">
            {[
              { icon: Filter, label: "Filter", text: "Teacher, class, subject, status" },
              { icon: MessageSquare, label: "Comment", text: "Section feedback in context" },
              { icon: BookOpen, label: "Approve", text: "Publish when ready" },
            ].map((step) => (
              <div
                key={step.label}
                className="rounded-xl border border-white/10 bg-white/4 p-3 backdrop-blur-sm"
              >
                <step.icon className="h-4 w-4 text-sky-200" />
                <p className="mt-2 text-sm font-medium text-white">{step.label}</p>
                <p className="mt-0.5 text-xs text-white/45">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-white/10 bg-white/4 p-4 backdrop-blur-md">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-sky-300/20 bg-sky-500/10 p-2">
              <Sparkles className="h-5 w-5 text-sky-100" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">What admins do here</h2>
              <p className="mt-1 text-sm leading-6 text-white/55">
                Scan the inbox, open a note to read every section, leave precise comments for teachers,
                and move work through submitted → approved → published when it meets school standards.
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/4 p-4 backdrop-blur-md">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-white/15 bg-white/5 text-white/65">
              {summary?.total ?? 0} notes in view
            </Badge>
            {(summary?.openComments ?? 0) > 0 ? (
              <Badge variant="outline" className="border-amber-300/30 bg-amber-500/10 text-amber-100">
                {summary?.openComments} open comments
              </Badge>
            ) : (
              <Badge variant="outline" className="border-emerald-300/25 bg-emerald-500/10 text-emerald-100">
                No open comments
              </Badge>
            )}
          </div>
          <p className="mt-3 text-xs leading-5 text-white/45">
            Filters apply to this list only. Teacher picklists grow as notes appear in the current
            result set.
          </p>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className={glassPanel}>
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-sky-200/80">Visible notes</div>
            <div className="mt-3 text-3xl font-semibold text-white">{summary?.total || 0}</div>
          </CardContent>
        </Card>
        <Card className={glassPanel}>
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-sky-200/80">Open comments</div>
            <div className="mt-3 text-3xl font-semibold text-white">{summary?.openComments || 0}</div>
          </CardContent>
        </Card>
        <Card className={glassPanel}>
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-sky-200/80">Submitted</div>
            <div className="mt-3 text-3xl font-semibold text-white">
              {summary?.byStatus?.submitted || 0}
            </div>
          </CardContent>
        </Card>
        <Card className={glassPanel}>
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-sky-200/80">Published</div>
            <div className="mt-3 text-3xl font-semibold text-white">
              {summary?.byStatus?.published || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className={glassPanel}>
        <CardHeader className="border-b border-white/10 pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <Filter className="h-5 w-5 text-sky-200" />
              Filters
            </CardTitle>
            <Badge variant="outline" className="w-fit border-white/15 bg-white/5 text-white/60">
              {!isLoading && !error ? `${entries.length} listed` : "—"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-2 xl:col-span-2">
              <Label className="text-xs uppercase tracking-wide text-white/45">Search</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Topic or tag"
                  className="border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/35"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-white/45">Teacher</Label>
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
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-white/45">Class</Label>
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
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-white/45">Subject</Label>
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
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-white/45">Status</Label>
              <PremiumSelect
                value={status}
                onValueChange={(value) => setStatus(value as LessonNoteStatus | "all")}
              >
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
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card className="relative overflow-hidden rounded-2xl border border-rose-400/25 bg-linear-to-br from-rose-950/80 to-slate-950/90 shadow-2xl shadow-rose-950/20 backdrop-blur-xl">
          <CardContent className="p-5 text-sm text-rose-100">
            {error.message || "Failed to load lesson notes."}
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-44 animate-pulse rounded-2xl border border-white/10 bg-white/6 shadow-lg shadow-black/20 backdrop-blur-xl"
            />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <Card className={glassPanel}>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/6 backdrop-blur-sm">
              <BookOpen className="h-8 w-8 text-sky-200/70" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-white">No lesson notes found</h2>
              <p className="mt-2 text-sm text-white/55">{emptyMessage}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {entries.map((note) => (
            <Card
              key={note.id}
              className={cn(
                glassPanel,
                "group h-full cursor-pointer transition-all duration-200 hover:border-sky-400/25 hover:shadow-sky-950/20",
              )}
              onClick={() => router.push(`/admin/lesson-notes/${note.id}`)}
            >
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
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        router.push(`/admin/lesson-notes/${note.id}`);
                      }}
                      className="h-8 w-8 rounded-full border border-white/10 bg-white/5 p-0 text-sky-200 hover:bg-sky-500/15"
                      aria-label={`Review ${note.topic}`}
                    >
                      <BookOpen className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeleteTarget({
                          id: note.id,
                          topic: note.topic,
                          className: note.className,
                          subjectName: note.subjectName,
                          teacherName: note.teacherName,
                          weekLabel: note.weekOf
                            ? `Week of ${new Date(note.weekOf).toLocaleDateString("en-GB")}`
                            : null,
                          status: note.status as LessonNoteStatus,
                        });
                      }}
                      className="h-8 w-8 rounded-full border border-rose-500/30 bg-rose-500/10 p-0 text-rose-200 hover:bg-rose-500/20"
                      aria-label={`Remove ${note.topic}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge className="border border-white/10 bg-white/10 text-white/75">
                      {note.status}
                    </Badge>
                    <Badge className="border border-sky-400/20 bg-sky-500/15 text-sky-100">
                      <MessageSquare className="mr-1 h-3 w-3" />
                      {note.openCommentCount} open
                    </Badge>
                    <Badge className="border border-white/10 bg-white/10 text-white/75">
                      {note.totalCommentCount} total comment
                      {note.totalCommentCount === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  <div className="text-sm text-white/45">
                    Week of {note.weekOf ? new Date(note.weekOf).toLocaleDateString("en-GB") : "—"}
                  </div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/35">
                    <Filter className="h-3 w-3 text-sky-300/50" />
                    Review note
                  </div>
                </CardContent>
            </Card>
          ))}
        </div>
      )}

      <LessonNoteDeleteDialog
        mode="admin"
        target={deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
