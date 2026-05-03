"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  Plus,
  Presentation,
  Pencil,
  Trash2,
  BookOpen,
  X,
  ExternalLink,
  BarChart3,
  Library,
} from "lucide-react";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useTeacherLessons } from "@/hooks/teacher/useTeacherLessons";
import { useTeacherLessonNotes } from "@/hooks/teacher/useTeacherLessonNotes";
import { useTeacherLessonCreate } from "@/hooks/teacher/useTeacherLessonCreate";
import { useTeacherLessonDelete } from "@/hooks/teacher/useTeacherLessonDelete";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { ResponsiveModal } from "@/components/modals/ResponsiveModal";
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
import {
  LESSON_STATUS_COLORS,
  LESSON_STATUS_LABELS,
  type LessonDeliveryStatus,
} from "@/types/lessons";

const STATUS_FILTER_OPTIONS: Array<{ value: LessonDeliveryStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: LESSON_STATUS_LABELS.draft },
  { value: "published", label: LESSON_STATUS_LABELS.published },
  { value: "archived", label: LESSON_STATUS_LABELS.archived },
];

function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildClassLabelMap(
  classes: Array<{
    _id?: string;
    name: string;
    gradeName?: string;
  }>
) {
  const map = new Map<string, string>();
  classes.forEach((c) => {
    if (!c._id) return;
    const label = `${c.gradeName ? c.gradeName + " " : ""}${c.name}`.trim();
    map.set(c._id, label || c.name);
  });
  return map;
}

export default function TeacherLessonsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const busyToast = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canView = can(permissions, PERMISSIONS.lessonsRead);
  const canWrite = can(permissions, PERMISSIONS.lessonsUpdate);

  const { data: classesData } = useTeacherClasses();
  const classLabelMap = React.useMemo(
    () => buildClassLabelMap(classesData?.data.classes || []),
    [classesData]
  );

  const [noteFilter, setNoteFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<LessonDeliveryStatus | "all">("all");
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [createNoteId, setCreateNoteId] = React.useState("");
  const [createTitle, setCreateTitle] = React.useState("");
  const [createScheduled, setCreateScheduled] = React.useState<Date | null>(null);

  const createPrefillDone = React.useRef(false);

  const { data: notesData } = useTeacherLessonNotes({ limit: 100 }, canView);
  const noteOptions = notesData?.data.entries || [];

  const { data: lessonsData, isLoading } = useTeacherLessons(
    {
      lessonNoteId: noteFilter === "all" ? undefined : noteFilter,
      limit: 80,
    },
    canView
  );

  const createMutation = useTeacherLessonCreate();
  const deleteMutation = useTeacherLessonDelete();

  let entries = lessonsData?.data.entries || [];
  if (statusFilter !== "all") {
    entries = entries.filter((e) => e.status === statusFilter);
  }

  React.useEffect(() => {
    if (!canView) return;
    const noteParam = searchParams.get("lessonNoteId");
    setNoteFilter(noteParam || "all");
  }, [canView, searchParams]);

  React.useEffect(() => {
    if (!canView) return;
    const createFrom = searchParams.get("createFromNote");
    if (!createFrom) return;
    createPrefillDone.current = false;
    setCreateNoteId(createFrom);
    setCreateScheduled(null);
    setShowCreateModal(true);
    const noteParam = searchParams.get("lessonNoteId");
    router.replace(
      noteParam
        ? `/teacher/lessons?lessonNoteId=${encodeURIComponent(noteParam)}`
        : "/teacher/lessons",
      { scroll: false }
    );
  }, [canView, searchParams, router]);

  React.useEffect(() => {
    if (!showCreateModal || !createNoteId || createPrefillDone.current) return;
    const prefill = noteOptions.find((n) => n.id === createNoteId);
    if (prefill) {
      setCreateTitle(prefill.topic);
      createPrefillDone.current = true;
    }
  }, [showCreateModal, createNoteId, noteOptions]);

  const openCreateModal = () => {
    createPrefillDone.current = true;
    setCreateNoteId(noteFilter !== "all" ? noteFilter : noteOptions[0]?.id || "");
    const prefill = noteOptions.find(
      (n) => n.id === (noteFilter !== "all" ? noteFilter : noteOptions[0]?.id)
    );
    setCreateTitle(prefill?.topic || "");
    setCreateScheduled(null);
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    createPrefillDone.current = false;
  };

  const submitCreate = async () => {
    if (!createNoteId) {
      busyToast.error("Choose a lesson note");
      return;
    }
    await busyToast.promise(
      createMutation.mutateAsync({
        lessonNoteId: createNoteId,
        title: createTitle.trim() || undefined,
        scheduledAt: createScheduled ? toDateKey(createScheduled) : undefined,
      }),
      {
        loading: "Creating lesson…",
        success: "Lesson created",
        error: (e) => (e instanceof Error ? e.message : "Failed to create lesson"),
      }
    );
    closeCreateModal();
  };

  const handleDelete = async (id: string, title: string) => {
    const result = await confirm({
      title: "Delete lesson",
      description: `Remove “${title}”? Draft lessons only; this cannot be undone.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      intent: "destructive",
    });
    if (result !== "confirm") return;
    await busyToast.promise(deleteMutation.mutateAsync(id), {
      loading: "Deleting…",
      success: "Lesson deleted",
      error: (e) => (e instanceof Error ? e.message : "Failed to delete"),
    });
  };

  if (!canView) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Lessons</h1>
          <p className="text-sm text-white/60">Student lessons are currently locked.</p>
        </div>
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardContent className="p-6 text-sm text-white/60">
            Ask an admin to grant journal permissions to create and view lessons.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Lessons</h1>
          <p className="text-sm text-white/60">
            Student-facing lessons built from your lesson notes — publish when ready.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            asChild
            className="border-white/15 bg-white/10 text-white/90 hover:bg-white/15"
          >
            <Link href="/teacher/lessons/bank">
              <Library className="mr-1.5 h-4 w-4" />
              Lesson bank
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            asChild
            className="border-white/15 bg-white/10 text-white/90 hover:bg-white/15"
          >
            <Link href="/teacher/lessons/analytics">
              <BarChart3 className="mr-1.5 h-4 w-4" />
              Analytics
            </Link>
          </Button>
          <Badge className="bg-violet-500/20 text-violet-200">{entries.length} shown</Badge>
          <Button
            type="button"
            onClick={openCreateModal}
            disabled={!canWrite || noteOptions.length === 0}
            className="group bg-violet-500/20 text-violet-100 hover:bg-violet-500/30 disabled:opacity-50"
          >
            <Plus className="mr-1 h-4 w-4 transition-transform group-hover:rotate-90" />
            New lesson
          </Button>
        </div>
      </div>

      {!canWrite && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
          <p className="text-sm font-medium text-rose-200">View-only access</p>
          <p className="mt-1 text-xs text-rose-200/70">
            You can see lessons but cannot create or edit them.
          </p>
        </div>
      )}

      {noteOptions.length === 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100/90">
          <p className="font-medium">Create a lesson note first</p>
          <p className="mt-1 text-xs text-amber-100/70">
            Lessons are linked to lesson notes.{" "}
            <Link href="/teacher/lesson-notes" className="underline underline-offset-2">
              Open Lesson Notes
            </Link>
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center">
        <div className="min-w-[200px] flex-1">
          <PremiumSelect value={noteFilter} onValueChange={setNoteFilter}>
            <PremiumSelectTrigger>
              <PremiumSelectValue placeholder="Lesson note" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              <PremiumSelectItem value="all">All lesson notes</PremiumSelectItem>
              {noteOptions.map((n) => (
                <PremiumSelectItem key={n.id} value={n.id}>
                  <span className="line-clamp-1">{n.topic}</span>
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
        </div>
        <div className="min-w-[140px]">
          <PremiumSelect
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as LessonDeliveryStatus | "all")}
          >
            <PremiumSelectTrigger>
              <PremiumSelectValue placeholder="Status" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <PremiumSelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-2xl border border-white/10 bg-white/5"
            />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <Presentation className="h-8 w-8 text-white/40" />
            </div>
            <h3 className="mb-2 text-lg font-medium text-white">No lessons yet</h3>
            <p className="mb-4 max-w-sm text-center text-sm text-white/60">
              Create a lesson from one of your lesson notes to prepare student-facing content.
            </p>
            <Button
              type="button"
              onClick={openCreateModal}
              disabled={!canWrite || noteOptions.length === 0}
              className="bg-violet-500/20 text-violet-100 hover:bg-violet-500/30"
            >
              <Plus className="mr-1 h-4 w-4" />
              New lesson
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((lesson) => (
            <Card
              key={lesson.id}
              className="group border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur transition-all hover:border-white/20"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/20 text-violet-200">
                      <Presentation className="h-4 w-4" />
                    </div>
                    <Badge
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                        LESSON_STATUS_COLORS[lesson.status] || "bg-white/10 text-white/70"
                      )}
                    >
                      {LESSON_STATUS_LABELS[lesson.status]}
                    </Badge>
                  </div>
                  <PremiumDropdownMenu>
                    <PremiumDropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 rounded-full border border-white/10 bg-white/5 p-0 text-white/70 hover:bg-white/10"
                      >
                        <span className="sr-only">Actions</span>
                        <BookOpen className="h-4 w-4" />
                      </Button>
                    </PremiumDropdownMenuTrigger>
                    <PremiumDropdownMenuContent align="end">
                      <PremiumDropdownMenuItem
                        icon={<Pencil className="h-4 w-4" />}
                        onClick={() => router.push(`/teacher/lessons/${lesson.id}`)}
                      >
                        Open & edit
                      </PremiumDropdownMenuItem>
                      <PremiumDropdownMenuItem
                        icon={<ExternalLink className="h-4 w-4" />}
                        onClick={() => router.push(`/teacher/lesson-notes/${lesson.lessonNoteId}`)}
                      >
                        View lesson note
                      </PremiumDropdownMenuItem>
                      {lesson.status === "draft" && (
                        <PremiumDropdownMenuItem
                          icon={<Trash2 className="h-4 w-4" />}
                          variant="destructive"
                          onClick={() => handleDelete(lesson.id, lesson.title)}
                        >
                          Delete
                        </PremiumDropdownMenuItem>
                      )}
                    </PremiumDropdownMenuContent>
                  </PremiumDropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href={`/teacher/lessons/${lesson.id}`} className="block">
                  <CardTitle className="line-clamp-2 text-base text-white transition-colors group-hover:text-violet-200">
                    {lesson.title}
                  </CardTitle>
                </Link>
                <p className="text-xs text-white/50">
                  {(lesson.lessonNoteTopic && `Note: ${lesson.lessonNoteTopic}`) || "Lesson note"}
                  {classLabelMap.get(lesson.classGroupId)
                    ? ` · ${classLabelMap.get(lesson.classGroupId)}`
                    : ""}
                </p>
                {(lesson.status === "published" || lesson.status === "archived") &&
                  lesson.studentStudiedSummary && (
                    <p className="text-xs text-sky-200/85">
                      {lesson.studentStudiedSummary.studiedCount}/
                      {lesson.studentStudiedSummary.classActiveStudentsTotal} students marked
                      studied
                      {lesson.studentStudiedSummary.studiedPercent != null &&
                        ` (${lesson.studentStudiedSummary.studiedPercent}%)`}
                    </p>
                  )}
                {lesson.scheduledAt && (
                  <p className="flex items-center gap-1 text-xs text-white/45">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {new Date(lesson.scheduledAt).toLocaleDateString(undefined, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ResponsiveModal
        open={showCreateModal}
        onClose={closeCreateModal}
        title="New lesson from note"
        widthClass="max-w-lg"
      >
        <div className="space-y-4 px-5 py-4">
          <p className="text-sm text-white/60">
            Pick the lesson note this delivery is based on. You can refine the title and schedule
            before publishing.
          </p>
          <div className="space-y-2">
            <Label className="text-white/80">Lesson note</Label>
            <PremiumSelect value={createNoteId} onValueChange={setCreateNoteId}>
              <PremiumSelectTrigger className="w-full">
                <PremiumSelectValue placeholder="Select note" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {noteOptions.map((n) => (
                  <PremiumSelectItem key={n.id} value={n.id}>
                    <span className="line-clamp-1">{n.topic}</span>
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
          <div className="space-y-2">
            <Label className="text-white/80">Lesson title</Label>
            <Input
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              placeholder="Title shown to students when published"
              className="border-white/10 bg-white/5 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/80">Scheduled date (optional)</Label>
            <CustomDatePicker
              value={createScheduled}
              onChange={setCreateScheduled}
              placeholder="Pick date"
              triggerAriaLabel="Scheduled lesson date"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={closeCreateModal}
              className="border-white/10 bg-transparent text-white/80"
            >
              <X className="mr-1 h-4 w-4" />
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void submitCreate()}
              disabled={!canWrite || createMutation.isPending || !createNoteId}
              className="bg-violet-500/25 text-violet-100 hover:bg-violet-500/35"
            >
              Create draft
            </Button>
          </div>
        </div>
      </ResponsiveModal>

      {confirmationDialog}
    </div>
  );
}
