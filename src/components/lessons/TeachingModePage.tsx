"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ClipboardList,
  MonitorPlay,
  Plus,
  Presentation,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { LessonNoteReadonlyView } from "@/components/lesson-notes/LessonNoteReadonlyView";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useTeacherLesson } from "@/hooks/teacher/useTeacherLesson";
import { useTeacherLessonUpdate } from "@/hooks/teacher/useTeacherLessonUpdate";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
import type { LessonTeachingSegmentDto } from "@/types/lessons";
import { cn } from "@/lib/utils";

function emptySegment(title: string, duration: number | null): LessonTeachingSegmentDto {
  return {
    title,
    durationMinutes: duration,
    teacherPrompt: null,
    learnerActivity: null,
    notes: null,
  };
}

export function TeachingModePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const lessonId = typeof params?.id === "string" ? params.id : null;
  const busyToast = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const { data: ctx } = useTeacherContext();
  const permissions = ctx?.data.permissions as Permission[] | undefined;
  const canView = can(permissions, PERMISSIONS.lessonsRead);
  const canWrite = can(permissions, PERMISSIONS.lessonsUpdate);

  const { data, isLoading, error, refetch } = useTeacherLesson(lessonId, canView, {
    includeDisplayNote: true,
  });
  const lesson = data?.data;
  const updateMutation = useTeacherLessonUpdate();

  const [draftSegments, setDraftSegments] = React.useState<LessonTeachingSegmentDto[]>([]);
  const [activeIdx, setActiveIdx] = React.useState(0);

  React.useEffect(() => {
    if (!lesson) return;
    const segs = lesson.teachingMode?.segments;
    if (segs && segs.length > 0) {
      setDraftSegments(segs);
    } else {
      const snap = lesson.publishedSnapshot as { durationMinutes?: number | null } | null;
      const dur =
        snap && typeof snap.durationMinutes === "number" ? snap.durationMinutes : null;
      setDraftSegments([emptySegment("Whole lesson", dur)]);
    }
    setActiveIdx(0);
  }, [lesson?.id, lesson?.updatedAt, lesson?.teachingMode]);

  const canRunTeachingMode =
    lesson &&
    lesson.publishedSnapshot != null &&
    (lesson.status === "published" || lesson.status === "archived");

  const active = draftSegments[activeIdx] ?? null;

  const updateActive = (patch: Partial<LessonTeachingSegmentDto>) => {
    setDraftSegments((rows) =>
      rows.map((r, i) => (i === activeIdx ? { ...r, ...patch } : r))
    );
  };

  const addSegment = () => {
    setDraftSegments((rows) => [
      ...rows,
      emptySegment(`Section ${rows.length + 1}`, null),
    ]);
    setActiveIdx((i) => i + 1);
  };

  const removeSegment = async (idx: number) => {
    if (draftSegments.length <= 1) return;
    const r2 = await confirm({
      title: "Remove this section?",
      description: "This segment will be removed from your teaching plan.",
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
      intent: "destructive",
    });
    if (r2 !== "confirm") return;
    setDraftSegments((rows) => rows.filter((_, i) => i !== idx));
    setActiveIdx((i) => {
      if (idx === i) return Math.max(0, i - 1);
      if (idx < i) return i - 1;
      return i;
    });
  };

  const savePlan = async () => {
    if (!lessonId || !lesson) return;
    await busyToast.promise(
      updateMutation.mutateAsync({
        id: lessonId,
        teachingMode: {
          segments: draftSegments.map((s) => ({
            title: s.title.trim(),
            durationMinutes: s.durationMinutes,
            teacherPrompt: s.teacherPrompt,
            learnerActivity: s.learnerActivity,
            notes: s.notes,
          })),
        },
      }),
      {
        loading: "Saving plan…",
        success: "Teaching plan saved",
        error: (e) => (e instanceof Error ? e.message : "Failed"),
      }
    );
    void refetch();
  };

  if (!canView) {
    return (
      <Card className="border border-white/10 bg-white/5">
        <CardContent className="p-6 text-sm text-white/60">No access.</CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border border-rose-500/20 bg-rose-500/10">
        <CardContent className="p-5 text-sm text-rose-100">
          {error.message || "Failed to load lesson."}
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !lesson) {
    return (
      <div className="min-h-screen space-y-4 bg-slate-950 p-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/5"
          />
        ))}
      </div>
    );
  }

  if (!canRunTeachingMode) {
    return (
      <div className="min-h-screen space-y-6 bg-slate-950 p-6 text-white">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => router.push(`/teacher/lessons/${lesson.id}`)}
          className="border-white/15 text-white"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to lesson
        </Button>
        <Card className="border border-amber-500/25 bg-amber-500/10">
          <CardContent className="space-y-3 p-6 text-sm text-amber-100/95">
            <div className="flex items-center gap-2 font-medium text-amber-50">
              <Presentation className="h-5 w-5" />
              Teaching Mode needs published content
            </div>
            <p className="text-amber-100/80">
              Publish this lesson first. Teaching Mode uses the same frozen lesson note your students
              see, plus your delivery segments and prompts.
            </p>
            <Button
              asChild
              size="sm"
              className="bg-amber-500/20 text-amber-50 hover:bg-amber-500/30"
            >
              <Link href={`/teacher/lessons/${lesson.id}`}>Open lesson</Link>
            </Button>
          </CardContent>
        </Card>
        {confirmationDialog}
      </div>
    );
  }

  const displayNote = lesson.displayNote;

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-white">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            asChild
            className="border-white/15 bg-white/5 text-white hover:bg-white/10"
          >
            <Link href={`/teacher/lessons/${lesson.id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Exit
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/20 text-violet-200">
              <MonitorPlay className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight md:text-xl">{lesson.title}</h1>
              <p className="text-xs text-white/50">
                {[lesson.classDisplayLabel, lesson.subjectName].filter(Boolean).join(" · ") ||
                  "Teaching Mode"}
              </p>
            </div>
          </div>
        </div>
        <Badge
          variant="outline"
          className="border-violet-400/40 bg-violet-500/15 text-violet-200"
        >
          Teaching Mode
        </Badge>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="flex w-full shrink-0 flex-col border-white/10 lg:w-[340px] lg:border-r">
          <div className="max-h-[40vh] overflow-y-auto border-b border-white/10 p-4 lg:max-h-none lg:flex-1 lg:border-b-0">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
                Segments
              </p>
              {canWrite && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 text-violet-200 hover:bg-white/10"
                  onClick={addSegment}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add
                </Button>
              )}
            </div>
            <ul className="space-y-2">
              {draftSegments.map((seg, idx) => (
                <li key={idx} className="flex items-stretch gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveIdx(idx)}
                    className={cn(
                      "min-w-0 flex-1 rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                      idx === activeIdx
                        ? "border-violet-500/50 bg-violet-500/15 text-white"
                        : "border-white/10 bg-white/5 text-white/80 hover:border-white/20"
                    )}
                  >
                    <span className="block truncate font-medium">{seg.title || `Section ${idx + 1}`}</span>
                    {seg.durationMinutes != null && (
                      <span className="text-[10px] text-white/45">{seg.durationMinutes} min</span>
                    )}
                  </button>
                  {canWrite && draftSegments.length > 1 && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-auto shrink-0 text-white/40 hover:text-rose-300"
                      onClick={() => void removeSegment(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {active && !canWrite && (
            <div className="space-y-3 border-t border-white/10 p-4 text-sm text-white/65">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
                View only
              </p>
              <p>You can follow this plan in the classroom but cannot edit it for this school.</p>
            </div>
          )}

          {canWrite && active && (
            <div className="space-y-4 overflow-y-auto border-t border-white/10 p-4 lg:max-h-[45vh]">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
                Active segment
              </p>
              <div className="space-y-2">
                <Label className="text-white/70">Title</Label>
                <Input
                  value={active.title}
                  onChange={(e) => updateActive({ title: e.target.value })}
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Minutes (optional)</Label>
                <Input
                  type="number"
                  min={0}
                  max={600}
                  value={active.durationMinutes ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    updateActive({
                      durationMinutes: v === "" ? null : Math.min(600, Math.max(0, Number(v))),
                    });
                  }}
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Teacher prompt</Label>
                <Textarea
                  value={active.teacherPrompt ?? ""}
                  onChange={(e) =>
                    updateActive({
                      teacherPrompt: e.target.value.trim() ? e.target.value : null,
                    })
                  }
                  className="min-h-[72px] border-white/10 bg-white/5 text-white"
                  placeholder="What to say, key questions…"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Learner activity</Label>
                <Textarea
                  value={active.learnerActivity ?? ""}
                  onChange={(e) =>
                    updateActive({
                      learnerActivity: e.target.value.trim() ? e.target.value : null,
                    })
                  }
                  className="min-h-[72px] border-white/10 bg-white/5 text-white"
                  placeholder="Pair work, practice, movement…"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Private notes</Label>
                <Textarea
                  value={active.notes ?? ""}
                  onChange={(e) =>
                    updateActive({ notes: e.target.value.trim() ? e.target.value : null })
                  }
                  className="min-h-[64px] border-white/10 bg-white/5 text-white"
                  placeholder="Only visible to you on this screen"
                />
              </div>
              <Button
                type="button"
                className="w-full bg-violet-500/25 text-violet-100 hover:bg-violet-500/35"
                disabled={updateMutation.isPending}
                onClick={() => void savePlan()}
              >
                <Save className="mr-2 h-4 w-4" />
                Save teaching plan
              </Button>
            </div>
          )}
        </aside>

        <main className="min-h-0 flex-1 overflow-y-auto bg-black/20 p-4 md:p-8">
          {active && (
            <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-5 md:p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-violet-200/90">
                Now · {active.title}
              </h2>
              {active.teacherPrompt && (
                <div className="mt-4">
                  <p className="text-[10px] font-semibold uppercase text-white/40">Prompt</p>
                  <p className="mt-1 whitespace-pre-wrap text-base text-white/90">
                    {active.teacherPrompt}
                  </p>
                </div>
              )}
              {active.learnerActivity && (
                <div className="mt-4">
                  <p className="text-[10px] font-semibold uppercase text-white/40">Activity</p>
                  <p className="mt-1 whitespace-pre-wrap text-base text-emerald-100/90">
                    {active.learnerActivity}
                  </p>
                </div>
              )}
              {active.notes && (
                <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase text-amber-200/80">Your notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-amber-100/90">{active.notes}</p>
                </div>
              )}
            </div>
          )}

          {displayNote ? (
            <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4 md:p-6">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-white/45">
                Published lesson content
              </p>
              <LessonNoteReadonlyView note={displayNote} />
            </div>
          ) : (
            <p className="text-sm text-white/50">Lesson content could not be loaded.</p>
          )}

          <div className="mt-10 flex flex-wrap justify-end gap-2 border-t border-white/10 pt-6">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-white/15 text-white hover:bg-white/10"
            >
              <Link href={`/teacher/lessons/${lesson.id}#lesson-reflection`}>
                <ClipboardList className="mr-2 h-4 w-4" />
                Post-lesson reflection
              </Link>
            </Button>
          </div>
        </main>
      </div>

      {confirmationDialog}
    </div>
  );
}
