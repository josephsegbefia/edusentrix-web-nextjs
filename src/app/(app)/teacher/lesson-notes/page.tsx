"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Plus,
  Copy,
  Tag,
  Trash2,
  Pencil,
  CalendarDays,
  FileText,
  GraduationCap,
  Download,
  X,
  Presentation,
  MoreHorizontal,
} from "lucide-react";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useTeacherLessonNote } from "@/hooks/teacher/useTeacherLessonNote";
import { useTeacherLessonNotes } from "@/hooks/teacher/useTeacherLessonNotes";
import { lessonNoteDetailToWizardInitial } from "@/lib/lesson-notes/detail-to-wizard";
import { useTeacherLessonNoteCreate } from "@/hooks/teacher/useTeacherLessonNoteCreate";
import { useLessonNoteFromSchemeItem } from "@/hooks/teacher/useLessonNoteFromSchemeItem";
import { useBusyToast } from "@/hooks/useBusyToast";
import {
  LessonNoteDeleteDialog,
  type LessonNoteDeleteTarget,
} from "@/components/teacher/lesson-notes/LessonNoteDeleteDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
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
import {
  LessonNoteWizard,
  type ClassOption,
} from "@/components/teacher/lesson-notes";
import {
  TEMPLATE_LABELS,
  STATUS_COLORS,
  type LessonNoteTemplateType,
  type LessonNoteStatus,
} from "@/types/lesson-notes";
import { getTemplatesForCurriculum } from "@/constants/curriculum-lesson-templates";
import type { CurriculumCode } from "@/constants/curriculum-profiles";

// ============================================================================
// Constants
// ============================================================================

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

function buildTemplateOptions(curriculumCode: CurriculumCode) {
  const templates = getTemplatesForCurriculum(curriculumCode);
  return [
    { value: "all", label: "All templates" },
    ...templates.map((t) => ({ value: t.id, label: t.label })),
  ];
}

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  NACCA_3_PHASE: <BookOpen className="h-3.5 w-3.5" />,
  CLASSIC_JHS: <GraduationCap className="h-3.5 w-3.5" />,
  SIMPLE: <FileText className="h-3.5 w-3.5" />,
  CAMBRIDGE_3_PART: <BookOpen className="h-3.5 w-3.5" />,
  BRITISH_3_PART: <BookOpen className="h-3.5 w-3.5" />,
  AMERICAN_STANDARDS: <BookOpen className="h-3.5 w-3.5" />,
  IB_PYP_UNIT_PLANNER: <BookOpen className="h-3.5 w-3.5" />,
  IB_MYP_UNIT_PLANNER: <GraduationCap className="h-3.5 w-3.5" />,
};

// ============================================================================
// Helpers
// ============================================================================

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatWeekLabel(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `Week of ${date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

function formatDateLabel(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ============================================================================
// Main Component
// ============================================================================

function TeacherLessonNotesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const createFromSchemeItemId = searchParams.get("createFromSchemeItem");
  const editNoteId = searchParams.get("edit");
  const busyToast = useBusyToast();
  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canView = can(permissions, PERMISSIONS.journalView);
  const canWrite = can(permissions, PERMISSIONS.journalWrite);

  const { data: classesData, isLoading: isLoadingClasses } = useTeacherClasses();

  // Build class options
  const classOptions: ClassOption[] = React.useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        label: string;
        isHomeroom: boolean;
        subjects: Array<{ id: string; name: string }>;
      }
    >();

    (classesData?.data.classes || []).forEach((item) => {
      if (!item._id) return;
      if (!map.has(item._id)) {
        const label = `${item.gradeName ? item.gradeName + " " : ""}${item.name}`.trim();
        map.set(item._id, {
          id: item._id,
          label: label || item.name,
          isHomeroom: item.isHomeroom,
          subjects: [],
        });
      }
      const entry = map.get(item._id);
      if (!entry) return;
      if (item.subjectId && !entry.subjects.some((subject) => subject.id === item.subjectId)) {
        entry.subjects.push({ id: item.subjectId, name: item.subjectName });
      }
      entry.isHomeroom = entry.isHomeroom || item.isHomeroom;
    });

    return Array.from(map.values())
      .map((entry) => ({
        ...entry,
        subjects: entry.subjects.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [classesData]);

  // View state
  const [showWizard, setShowWizard] = React.useState(false);
  const [editingNote, setEditingNote] = React.useState<string | null>(null);
  const [schemePrefillConsumed, setSchemePrefillConsumed] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<LessonNoteDeleteTarget | null>(null);

  // Filters
  const [selectedClassId, setSelectedClassId] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<LessonNoteStatus | "all">("all");
  const [templateFilter, setTemplateFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [weekFilter, setWeekFilter] = React.useState<Date | null>(null);

  // Fetch notes
  const { data: notesData, isLoading } = useTeacherLessonNotes(
    {
      classGroupId: selectedClassId === "all" ? undefined : selectedClassId,
      status: statusFilter === "all" ? undefined : statusFilter,
      templateType:
        templateFilter === "all"
          ? undefined
          : (templateFilter as LessonNoteTemplateType),
      weekOf: weekFilter ? toDateInputValue(weekFilter) : undefined,
      search: search || undefined,
    },
    canView
  );

  const notes = notesData?.data.entries || [];
  const groupedNotes = React.useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        className: string;
        subjectName: string;
        notes: typeof notes;
      }
    >();

    for (const note of notes) {
      const className = note.className || "Unassigned class";
      const subjectName = note.subjectName || "General";
      const key = `${className}::${subjectName}`;
      const existing = groups.get(key);
      if (existing) {
        existing.notes.push(note);
      } else {
        groups.set(key, { key, className, subjectName, notes: [note] });
      }
    }

    return Array.from(groups.values()).sort((a, b) => {
      const classCompare = a.className.localeCompare(b.className);
      return classCompare || a.subjectName.localeCompare(b.subjectName);
    });
  }, [notes]);

  const { data: editingDetailData, isLoading: editingDetailLoading } = useTeacherLessonNote(
    editingNote,
    showWizard && Boolean(editingNote),
  );

  const schoolCurriculumCode = (contextData?.data.school?.curriculumCode || "ghana_nacca") as CurriculumCode;
  const templateOptions = React.useMemo(() => buildTemplateOptions(schoolCurriculumCode), [schoolCurriculumCode]);
  const noClassesAssigned = !isLoadingClasses && classOptions.length === 0;
  const isInitializing = isLoadingClasses || !contextData;

  const createMutation = useTeacherLessonNoteCreate();
  const {
    data: schemePrefill,
    isLoading: schemePrefillLoading,
    error: schemePrefillError,
  } = useLessonNoteFromSchemeItem(createFromSchemeItemId);

  React.useEffect(() => {
    if (!createFromSchemeItemId || !schemePrefill || schemePrefillConsumed) return;
    setEditingNote(null);
    setShowWizard(true);
    setSchemePrefillConsumed(true);
  }, [createFromSchemeItemId, schemePrefill, schemePrefillConsumed]);

  React.useEffect(() => {
    if (!editNoteId) return;
    setEditingNote(editNoteId);
    setShowWizard(true);
    router.replace("/teacher/lesson-notes", { scroll: false });
  }, [editNoteId, router]);

  // Handlers
  const handleCreateNew = () => {
    setEditingNote(null);
    setShowWizard(true);
  };

  const handleEdit = (noteId: string) => {
    setEditingNote(noteId);
    setShowWizard(true);
  };

  const handleDuplicate = async (note: (typeof notes)[number]) => {
    const baseWeek = note.weekOf ? new Date(note.weekOf) : new Date();
    const nextWeek = new Date(baseWeek);
    nextWeek.setDate(baseWeek.getDate() + 7);

    const payload = {
      classGroupId: note.classGroupId,
      subjectId: note.subjectId || undefined,
      templateType: (note.templateType || "SIMPLE") as LessonNoteTemplateType,
      weekOf: toDateInputValue(nextWeek),
      topic: note.topic,
      durationMinutes: note.durationMinutes || undefined,
      references: note.references || [],
      curriculum: note.curriculum || undefined,
      tlms: note.tlms || [],
      body: note.body || undefined,
      assessment: note.assessment || undefined,
      reflections: note.reflections || undefined,
      resources: note.resources,
      tags: note.tags,
      status: "draft" as const,
    };

    const result = await busyToast.promise(createMutation.mutateAsync(payload), {
      loading: "Duplicating note...",
      success: "Note copied to next week",
      error: "Failed to duplicate note",
    });

    if ((result as { queued?: boolean })?.queued) {
      busyToast.info("Saved offline", {
        description: "The duplicated note will sync when you're back online.",
      });
    }
  };

  const openDeleteDialog = (note: (typeof notes)[number]) => {
    setDeleteTarget({
      id: note.id,
      topic: note.topic || "Untitled",
      className: note.className,
      subjectName: note.subjectName,
      weekLabel: formatWeekLabel(note.weekOf),
      status: note.status as LessonNoteStatus,
    });
  };

  const handleWizardComplete = () => {
    setShowWizard(false);
    setEditingNote(null);
    if (createFromSchemeItemId) router.replace("/teacher/lesson-notes");
  };

  const handleWizardCancel = () => {
    setShowWizard(false);
    setEditingNote(null);
    if (createFromSchemeItemId) router.replace("/teacher/lesson-notes");
  };

  // Clear filters
  const clearFilters = () => {
    setSelectedClassId("all");
    setStatusFilter("all");
    setTemplateFilter("all");
    setSearch("");
    setWeekFilter(null);
  };

  const hasActiveFilters =
    selectedClassId !== "all" ||
    statusFilter !== "all" ||
    templateFilter !== "all" ||
    search ||
    weekFilter;

  const renderNoteCard = (note: (typeof notes)[number]) => (
    <Card
      key={note.id}
      className={cn(
        glassPanelClass,
        "group cursor-pointer transition-all hover:border-white/20 hover:-translate-y-0.5"
      )}
      onClick={() => router.push(`/teacher/lesson-notes/${note.id}`)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-teal-400/20 bg-teal-500/15 text-teal-200">
              {TEMPLATE_ICONS[note.templateType as LessonNoteTemplateType] || (
                <FileText className="h-4 w-4" />
              )}
            </div>
            <Badge
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                STATUS_COLORS[note.status as LessonNoteStatus] ||
                  "bg-white/10 text-white/70"
              )}
            >
              {note.status}
            </Badge>
          </div>
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                router.push(`/teacher/lesson-notes/${note.id}`);
              }}
              className="h-8 w-8 rounded-full border border-white/10 bg-white/5 p-0 text-teal-200 hover:bg-teal-500/15 hover:text-teal-100"
              aria-label={`View ${note.topic || "lesson note"}`}
            >
              <BookOpen className="h-4 w-4" />
            </Button>
            {canWrite && note.status !== "approved" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  openDeleteDialog(note);
                }}
                className="h-8 w-8 rounded-full border border-rose-500/30 bg-rose-500/10 p-0 text-rose-200 hover:bg-rose-500/20 hover:text-rose-100"
                aria-label={`Delete ${note.topic || "lesson note"}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
            <PremiumDropdownMenu>
              <PremiumDropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(event) => event.stopPropagation()}
                  className="h-8 w-8 rounded-full border border-white/10 bg-white/5 p-0 text-white/70 hover:bg-white/10"
                  aria-label="More actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </PremiumDropdownMenuTrigger>
              <PremiumDropdownMenuContent align="end">
                <PremiumDropdownMenuItem
                  icon={<Pencil className="h-4 w-4" />}
                  onClick={() => handleEdit(note.id)}
                >
                  Edit
                </PremiumDropdownMenuItem>
                <PremiumDropdownMenuItem
                  icon={<Copy className="h-4 w-4" />}
                  onClick={() => handleDuplicate(note)}
                >
                  Duplicate to next week
                </PremiumDropdownMenuItem>
                <PremiumDropdownMenuItem
                  icon={<Presentation className="h-4 w-4" />}
                  onClick={() =>
                    router.push(
                      `/teacher/lessons/create?noteId=${note.id}${note.classGroupId ? `&classGroupId=${note.classGroupId}` : ""}`,
                    )
                  }
                >
                  Create weekly lessons
                </PremiumDropdownMenuItem>
                <PremiumDropdownMenuItem
                  icon={<Download className="h-4 w-4" />}
                  onClick={() => busyToast.info("Export coming soon")}
                >
                  Export PDF
                </PremiumDropdownMenuItem>
              </PremiumDropdownMenuContent>
            </PremiumDropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div>
          <CardTitle className="line-clamp-2 text-base text-white transition-colors group-hover:text-teal-200">
            {note.topic}
          </CardTitle>
          <p className="mt-1 text-xs text-white/50">
            {note.className}
            {note.subjectName ? ` · ${note.subjectName}` : ""}
          </p>
        </div>

        <div className="space-y-1 text-xs text-white/50">
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatWeekLabel(note.weekOf)}
          </span>
          <div className="flex flex-wrap gap-x-2 gap-y-1">
            <span>Created: {formatDateLabel(note.date || note.createdAt)}</span>
            <span>Week ending: {formatDateLabel(note.weekEndingDate)}</span>
            {note.durationMinutes ? <span>{note.durationMinutes} min</span> : null}
            {note.resources.length > 0 ? <span>{note.resources.length} resources</span> : null}
          </div>
        </div>

        <Badge className="bg-white/5 text-white/60 text-xs">
          {TEMPLATE_LABELS[note.templateType as LessonNoteTemplateType] || "Quick Note"}
        </Badge>

        {note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {note.tags.slice(0, 3).map((tag) => (
              <Badge
                key={tag}
                className="flex items-center gap-1 bg-white/5 text-white/50 text-xs"
              >
                <Tag className="h-2.5 w-2.5" />
                {tag}
              </Badge>
            ))}
            {note.tags.length > 3 && (
              <Badge className="bg-white/5 text-white/50 text-xs">
                +{note.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  // ============================================================================
  // Render: No permission
  // ============================================================================

  if (!canView) {
    return (
      <WorkspacePageShell>
        <WorkspacePageHeader
          icon={FileText}
          title="Lesson notes"
          subtitle="Create and manage lesson notes with curriculum-aligned templates."
        />
        <GlassPanel className="p-8 text-center">
          <p className="text-sm text-white/70">Lesson notes are currently locked.</p>
          <p className="mt-2 text-xs text-white/50">
            Ask an admin to grant journal permissions for your account.
          </p>
        </GlassPanel>
      </WorkspacePageShell>
    );
  }

  // ============================================================================
  // Render: Wizard Mode
  // ============================================================================

  if (showWizard) {
    const noteFromList = editingNote ? notes.find((n) => n.id === editingNote) : null;
    const noteToEdit = editingDetailData?.data
      ? lessonNoteDetailToWizardInitial(editingDetailData.data)
      : noteFromList
        ? {
            id: noteFromList.id,
            classGroupId: noteFromList.classGroupId,
            subjectId: noteFromList.subjectId || undefined,
            templateType: noteFromList.templateType as LessonNoteTemplateType,
            weekOf: noteFromList.weekOf ? new Date(noteFromList.weekOf) : new Date(),
            date: noteFromList.date ? new Date(noteFromList.date) : undefined,
            weekEndingDate: noteFromList.weekEndingDate ? new Date(noteFromList.weekEndingDate) : undefined,
            topic: noteFromList.topic,
            durationMinutes: noteFromList.durationMinutes || undefined,
            references: noteFromList.references || [],
            curriculum: noteFromList.curriculum || {
              strand: "",
              subStrand: "",
              contentStandard: "",
              indicators: [],
              learningOutcomes: [],
            },
            tlms: noteFromList.tlms || [],
            body: noteFromList.body || undefined,
            assessment: noteFromList.assessment || {
              inClassChecks: [],
              exitTicket: "",
              homework: "",
            },
            reflections: noteFromList.reflections || {
              learner: "",
              teacher: "",
              nextLessonLink: "",
            },
            resources: noteFromList.resources,
            tags: noteFromList.tags,
            status: noteFromList.status as LessonNoteStatus,
            schemeId: noteFromList.schemeId ?? undefined,
            schemeItemIds: noteFromList.schemeItemIds ?? [],
          }
        : null;
    const schemeInitialData = !editingNote && schemePrefill?.initialData ? schemePrefill.initialData : undefined;

    if (editingNote && editingDetailLoading && !noteToEdit) {
      return (
        <WorkspacePageShell>
          <WorkspacePageHeader icon={FileText} title="Edit lesson note" subtitle="Loading note..." />
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className={cn(glassInsetClass, "h-32 animate-pulse rounded-2xl")} />
            ))}
          </div>
        </WorkspacePageShell>
      );
    }

    return (
      <WorkspacePageShell>
        <WorkspacePageHeader
          icon={FileText}
          title={editingNote ? "Edit lesson note" : "New lesson note"}
          subtitle={
            editingNote
              ? "Update your lesson note"
              : schemePrefill
                ? `Based on ${schemePrefill.scheme.title}`
                : "Create a professional lesson note"
          }
          backHref="/teacher/lesson-notes"
          backLabel="Back to lesson notes"
        />

        <LessonNoteWizard
          classOptions={classOptions}
          initialData={noteToEdit ?? schemeInitialData}
          onComplete={handleWizardComplete}
          onCancel={handleWizardCancel}
          curriculumCode={(contextData?.data.school?.curriculumCode as import("@/constants/curriculum-profiles").CurriculumCode) || "ghana_nacca"}
          periodPlanningContext={schemePrefill?.periodPlanning ?? null}
        />
      </WorkspacePageShell>
    );
  }

  // ============================================================================
  // Render: List View
  // ============================================================================

  const newNoteAction = (
    <Button
      onClick={handleCreateNew}
      disabled={isInitializing || !canWrite || noClassesAssigned}
      className={glassPrimaryButtonClass}
    >
      <Plus className="h-4 w-4" />
      {isInitializing ? "Loading..." : "New note"}
    </Button>
  );

  return (
    <>
    <WorkspacePageShell>
      <WorkspacePageHeader
        icon={FileText}
        title="Lesson notes"
        subtitle="Create and manage lesson notes with NaCCA-aligned templates."
        badge={
          !isLoading ? (
            <span className="rounded-full border border-teal-400/30 bg-teal-500/15 px-3 py-1 text-xs font-medium text-teal-200">
              {notes.length} note{notes.length === 1 ? "" : "s"}
            </span>
          ) : undefined
        }
        actions={newNoteAction}
      />

      <Card className={cn(glassPanelClass, "p-4")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="min-w-[140px]">
          <PremiumSelect value={selectedClassId} onValueChange={setSelectedClassId}>
            <PremiumSelectTrigger>
              <PremiumSelectValue placeholder="Class" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              <PremiumSelectItem value="all">All classes</PremiumSelectItem>
              {classOptions.map((opt) => (
                <PremiumSelectItem key={opt.id} value={opt.id}>
                  {opt.label}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
        </div>

        <div className="min-w-[130px]">
          <PremiumSelect value={templateFilter} onValueChange={setTemplateFilter}>
            <PremiumSelectTrigger>
              <PremiumSelectValue placeholder="Template" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              {templateOptions.map((opt) => (
                <PremiumSelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
        </div>

        <div className="min-w-[120px]">
          <PremiumSelect
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(value as LessonNoteStatus | "all")
            }
          >
            <PremiumSelectTrigger>
              <PremiumSelectValue placeholder="Status" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <PremiumSelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
        </div>

        <div className="flex-1">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes..."
            className={cn(glassInsetClass, "text-white")}
          />
        </div>

        <div className="min-w-[160px]">
          <CustomDatePicker
            value={weekFilter}
            onChange={setWeekFilter}
            placeholder="Filter week"
          />
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="mr-1 h-3 w-3" />
            Clear
          </Button>
        )}
        </div>
      </Card>

      {/* No Classes Warning */}
      {noClassesAssigned && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-medium text-amber-200">No classes assigned yet</p>
          <p className="mt-1 text-xs text-amber-200/70">
            Lesson notes will unlock once classes are assigned to you by the school admin.
          </p>
        </div>
      )}

      {/* Permission Warning */}
      {!canWrite && canView && !isInitializing && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
          <p className="text-sm font-medium text-rose-200">View-only access</p>
          <p className="mt-1 text-xs text-rose-200/70">
            You can view lesson notes but don&apos;t have permission to create or edit them.
          </p>
        </div>
      )}

      {schemePrefillLoading ? (
        <div className="rounded-xl border border-blue-500/25 bg-blue-500/10 p-4 text-sm text-blue-100">
          Preparing lesson note from Scheme of Learning row...
        </div>
      ) : null}

      {schemePrefillError ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
          {schemePrefillError.message}
        </div>
      ) : null}

      {/* Notes List */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className={cn(glassInsetClass, "h-48 animate-pulse rounded-2xl")}
            />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <Card className={glassPanelClass}>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <BookOpen className="h-8 w-8 text-white/40" />
            </div>
            <h3 className="mb-2 text-lg font-medium text-white">No lesson notes yet</h3>
            <p className="mb-4 text-center text-sm text-white/60">
              Create your first lesson note using our guided wizard
            </p>
            <Button
              onClick={handleCreateNew}
              disabled={isInitializing || !canWrite || noClassesAssigned}
              className={cn(glassPrimaryButtonClass, "disabled:opacity-50")}
            >
              <Plus className="mr-1 h-4 w-4" />
              {isInitializing ? "Loading..." : "Create Lesson Note"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {groupedNotes.map((group) => (
            <section
              key={group.key}
              className={cn(glassPanelClass, "p-4")}
            >
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    {group.className} · {group.subjectName}
                  </h2>
                  <p className="text-xs text-white/50">
                    {group.notes.length} lesson {group.notes.length === 1 ? "note" : "notes"}
                  </p>
                </div>
                <Badge className="w-fit border border-white/10 bg-white/5 text-white/60">
                  Latest: {formatWeekLabel(group.notes[0]?.weekOf)}
                </Badge>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.notes.map((note) => renderNoteCard(note))}
              </div>
            </section>
          ))}
        </div>
      )}

    </WorkspacePageShell>

    <LessonNoteDeleteDialog
      target={deleteTarget}
      onOpenChange={(open) => {
        if (!open) setDeleteTarget(null);
      }}
    />
    </>
  );
}

export default function TeacherLessonNotesPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-sm text-white/60">Loading lesson notes...</div>}>
      <TeacherLessonNotesInner />
    </React.Suspense>
  );
}
