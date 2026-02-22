"use client";

import * as React from "react";
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
} from "lucide-react";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useTeacherLessonNotes } from "@/hooks/teacher/useTeacherLessonNotes";
import { useTeacherLessonNoteCreate } from "@/hooks/teacher/useTeacherLessonNoteCreate";
import { useTeacherLessonNoteDelete } from "@/hooks/teacher/useTeacherLessonNoteDelete";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
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

// ============================================================================
// Constants
// ============================================================================

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "published", label: "Published" },
];

const TEMPLATE_OPTIONS = [
  { value: "all", label: "All templates" },
  { value: "NACCA_3_PHASE", label: "NaCCA 3-Phase" },
  { value: "CLASSIC_JHS", label: "Classic JHS" },
  { value: "SIMPLE", label: "Quick Note" },
];

const TEMPLATE_ICONS: Record<LessonNoteTemplateType, React.ReactNode> = {
  NACCA_3_PHASE: <BookOpen className="h-3.5 w-3.5" />,
  CLASSIC_JHS: <GraduationCap className="h-3.5 w-3.5" />,
  SIMPLE: <FileText className="h-3.5 w-3.5" />,
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

// ============================================================================
// Main Component
// ============================================================================

export default function TeacherLessonNotesPage() {
  const busyToast = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();
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
  const noClassesAssigned = !isLoadingClasses && classOptions.length === 0;
  const isInitializing = isLoadingClasses || !contextData;

  const createMutation = useTeacherLessonNoteCreate();
  const deleteMutation = useTeacherLessonNoteDelete();

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

  const handleDelete = async (id: string, noteTitle: string) => {
    const result = await confirm({
      title: "Delete Lesson Note",
      description: `Are you sure you want to delete "${noteTitle}"? This action cannot be undone.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      intent: "destructive",
    });

    if (result !== "confirm") return;

    await busyToast.promise(deleteMutation.mutateAsync(id), {
      loading: "Deleting note...",
      success: "Lesson note deleted",
      error: "Failed to delete lesson note",
    });
  };

  const handleWizardComplete = () => {
    setShowWizard(false);
    setEditingNote(null);
  };

  const handleWizardCancel = () => {
    setShowWizard(false);
    setEditingNote(null);
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

  // ============================================================================
  // Render: No permission
  // ============================================================================

  if (!canView) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Lesson Notes</h1>
          <p className="text-sm text-white/60">Lesson notes are currently locked.</p>
        </div>
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60">
                <BookOpen className="h-4 w-4" />
              </span>
              Lesson notes access required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
              Ask an admin to grant journal permissions for your account.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================================================================
  // Render: Wizard Mode
  // ============================================================================

  if (showWizard) {
    // Find the note being edited
    const noteToEdit = editingNote
      ? notes.find((n) => n.id === editingNote)
      : null;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">
              {editingNote ? "Edit Lesson Note" : "New Lesson Note"}
            </h1>
            <p className="text-sm text-white/60">
              {editingNote
                ? "Update your lesson note"
                : "Create a professional lesson note"}
            </p>
          </div>
        </div>

        <LessonNoteWizard
          classOptions={classOptions}
          initialData={
            noteToEdit
              ? {
                  id: noteToEdit.id,
                  classGroupId: noteToEdit.classGroupId,
                  subjectId: noteToEdit.subjectId || undefined,
                  templateType: noteToEdit.templateType as LessonNoteTemplateType,
                  weekOf: noteToEdit.weekOf ? new Date(noteToEdit.weekOf) : new Date(),
                  date: noteToEdit.date ? new Date(noteToEdit.date) : undefined,
                  topic: noteToEdit.topic,
                  durationMinutes: noteToEdit.durationMinutes || undefined,
                  references: noteToEdit.references || [],
                  curriculum: noteToEdit.curriculum || {
                    strand: "",
                    subStrand: "",
                    contentStandard: "",
                    indicators: [],
                    learningOutcomes: [],
                  },
                  tlms: noteToEdit.tlms || [],
                  body: noteToEdit.body || undefined,
                  assessment: noteToEdit.assessment || {
                    inClassChecks: [],
                    exitTicket: "",
                    homework: "",
                  },
                  reflections: noteToEdit.reflections || {
                    learner: "",
                    teacher: "",
                    nextLessonLink: "",
                  },
                  resources: noteToEdit.resources,
                  tags: noteToEdit.tags,
                  status: noteToEdit.status as LessonNoteStatus,
                }
              : undefined
          }
          onComplete={handleWizardComplete}
          onCancel={handleWizardCancel}
        />
      </div>
    );
  }

  // ============================================================================
  // Render: List View
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Lesson Notes</h1>
          <p className="text-sm text-white/60">
            Create and manage lesson notes with NaCCA-aligned templates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-indigo-500/20 text-indigo-200">
            {notes.length} notes
          </Badge>
          <Button
            onClick={handleCreateNew}
            disabled={isInitializing || !canWrite || noClassesAssigned}
            className="group bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30 disabled:opacity-50"
          >
            <Plus className="mr-1 h-4 w-4 transition-transform group-hover:rotate-90" />
            {isInitializing ? "Loading..." : "New Note"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center">
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
              {TEMPLATE_OPTIONS.map((opt) => (
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
            className="border-white/10 bg-white/5 text-white"
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

      {/* Notes List */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-48 animate-pulse rounded-2xl border border-white/10 bg-white/5"
            />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
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
              className="bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30 disabled:opacity-50"
            >
              <Plus className="mr-1 h-4 w-4" />
              {isInitializing ? "Loading..." : "Create Lesson Note"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <Card
              key={note.id}
              className="group border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur transition-all hover:border-white/20"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-200">
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
                  <PremiumDropdownMenu>
                    <PremiumDropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 rounded-full border border-white/10 bg-white/5 p-0 text-white/70 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/10"
                      >
                        <span className="sr-only">Actions</span>
                        <BookOpen className="h-4 w-4" />
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
                        icon={<Download className="h-4 w-4" />}
                        onClick={() => busyToast.info("Export coming soon")}
                      >
                        Export PDF
                      </PremiumDropdownMenuItem>
                      <PremiumDropdownMenuItem
                        icon={<Trash2 className="h-4 w-4" />}
                        variant="destructive"
                        onClick={() => handleDelete(note.id, note.topic || "Untitled")}
                      >
                        Delete
                      </PremiumDropdownMenuItem>
                    </PremiumDropdownMenuContent>
                  </PremiumDropdownMenu>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div>
                  <CardTitle
                    className="line-clamp-2 text-base text-white cursor-pointer hover:text-indigo-200 transition-colors"
                    onClick={() => handleEdit(note.id)}
                  >
                    {note.topic}
                  </CardTitle>
                  <p className="mt-1 text-xs text-white/50">
                    {note.className}
                    {note.subjectName ? ` · ${note.subjectName}` : ""}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-white/50">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatWeekLabel(note.weekOf)}
                  </span>
                  {note.durationMinutes && (
                    <span>· {note.durationMinutes} min</span>
                  )}
                  {note.resources.length > 0 && (
                    <span>· {note.resources.length} resources</span>
                  )}
                </div>

                {/* Template badge */}
                <Badge className="bg-white/5 text-white/60 text-xs">
                  {TEMPLATE_LABELS[note.templateType as LessonNoteTemplateType] ||
                    "Quick Note"}
                </Badge>

                {/* Tags */}
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
          ))}
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmationDialog}
    </div>
  );
}
