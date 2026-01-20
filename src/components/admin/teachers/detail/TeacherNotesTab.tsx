// src/components/admin/teachers/detail/TeacherNotesTab.tsx
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Pencil,
  Trash2,
  StickyNote,
  Lock,
  MessageSquare,
  User,
  Calendar,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useTeacherNotes,
  useDeleteNote,
  type TeacherNoteDTO,
  type TeacherNoteCategory,
} from "@/hooks/admin/useTeacherNotes";
import { useBusyToast } from "@/hooks/useBusyToast";
import { AddNoteModal } from "@/components/modals/AddNoteModal";

type Props = {
  teacher: {
    id: string;
    fullName: string;
  };
};

function formatDate(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getCategoryLabel(category: TeacherNoteCategory | null): string {
  const labels: Record<string, string> = {
    general: "General",
    performance: "Performance",
    behavior: "Behavior",
    professional_development: "Professional Development",
    disciplinary: "Disciplinary",
    other: "Other",
  };
  return labels[category || "general"] || "General";
}

const categoryConfig: Record<
  string,
  { bg: string; border: string; text: string }
> = {
  performance: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-200",
  },
  behavior: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-200",
  },
  disciplinary: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-200",
  },
  professional_development: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-200",
  },
  general: {
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
    text: "text-slate-200",
  },
  other: {
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    text: "text-purple-200",
  },
};

export function TeacherNotesTab({ teacher }: Props) {
  const [addModalOpen, setAddModalOpen] = React.useState(false);
  const [editModalOpen, setEditModalOpen] = React.useState(false);
  const [editingNote, setEditingNote] = React.useState<TeacherNoteDTO | null>(
    null
  );
  const [categoryFilter, setCategoryFilter] =
    React.useState<TeacherNoteCategory | null>(null);

  const { data: notesData, isLoading } = useTeacherNotes(teacher.id, {
    category: categoryFilter || undefined,
  });

  const notes = React.useMemo(() => notesData?.data ?? [], [notesData?.data]);

  const deleteNoteMutation = useDeleteNote();
  const busy = useBusyToast();

  const handleEdit = (note: TeacherNoteDTO) => {
    setEditingNote(note);
    setEditModalOpen(true);
  };

  const handleDelete = async (note: TeacherNoteDTO) => {
    if (
      !confirm(
        `Are you sure you want to delete "${note.title}"?\n\nThis action cannot be undone.`
      )
    )
      return;

    try {
      await busy.promise(
        deleteNoteMutation.mutateAsync({
          teacherId: teacher.id,
          noteId: note.id,
        }),
        {
          loading: "Deleting note...",
          success: `"${note.title}" deleted successfully`,
          error: "Failed to delete note",
        }
      );
    } catch {
      // Error already handled by busy.promise
    }
  };

  // Group notes by category for better organization
  const notesByCategory = React.useMemo(() => {
    const grouped: Record<string, TeacherNoteDTO[]> = {};
    notes.forEach((note) => {
      const category = note.category || "general";
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(note);
    });
    return grouped;
  }, [notes]);

  const categories = Object.keys(notesByCategory) as TeacherNoteCategory[];

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-linear-to-br from-rose-500/15 via-pink-500/10 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />

        <CardHeader className="relative z-10 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-linear-to-br from-rose-500/20 to-pink-500/20 shadow-inner shadow-white/5">
              <StickyNote className="h-5 w-5 text-rose-300" />
            </div>
            <div className="space-y-0.5">
              <CardTitle className="text-lg font-semibold tracking-tight text-white">
                Notes
              </CardTitle>
              <p className="text-xs text-white/50">
                {notes.length} note{notes.length !== 1 ? "s" : ""} recorded
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="gap-2 rounded-xl border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
            onClick={() => setAddModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add Note
          </Button>
        </CardHeader>
      </Card>

      {/* Category filter */}
      {notes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={categoryFilter === null ? "default" : "outline"}
            size="sm"
            onClick={() => setCategoryFilter(null)}
            className={cn(
              "rounded-xl",
              categoryFilter === null
                ? "bg-white/10 text-white"
                : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
            )}
          >
            All ({notes.length})
          </Button>
          {categories.map((cat) => {
            const config = categoryConfig[cat] || categoryConfig.general;
            return (
              <Button
                key={cat}
                variant="outline"
                size="sm"
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  "rounded-xl",
                  categoryFilter === cat
                    ? cn(config.bg, config.border, config.text)
                    : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                )}
              >
                {getCategoryLabel(cat)} ({notesByCategory[cat].length})
              </Button>
            );
          })}
        </div>
      )}

      {/* Notes list */}
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-rose-500/5 via-transparent to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
          aria-hidden="true"
        />

        <CardContent className="relative z-10 p-6">
          {isLoading ? (
            <div className="flex items-center justify-center gap-3 py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-rose-400" />
              <p className="text-sm text-white/60">Loading notes...</p>
            </div>
          ) : notes.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/2 p-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-linear-to-br from-rose-500/20 to-pink-500/20">
                  <MessageSquare className="h-7 w-7 text-rose-300" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-white">
                    No notes yet
                  </p>
                  <p className="text-sm text-white/50">
                    {categoryFilter
                      ? `No notes in the "${getCategoryLabel(
                          categoryFilter
                        )}" category`
                      : "Add the first note to get started"}
                  </p>
                </div>
                {!categoryFilter && (
                  <Button
                    variant="outline"
                    className="mt-2 gap-2 rounded-xl border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                    onClick={() => setAddModalOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Add First Note
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {categoryFilter ? (
                // Show filtered notes
                <div className="space-y-3">
                  {notesByCategory[categoryFilter]?.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      isDeleting={deleteNoteMutation.isPending}
                    />
                  ))}
                </div>
              ) : (
                // Show all notes grouped by category
                categories.map((category) => (
                  <div key={category} className="space-y-3">
                    {categories.length > 1 && (
                      <div className="flex items-center gap-3 pt-2">
                        <h3 className="text-sm font-semibold text-white/60">
                          {getCategoryLabel(category)}
                        </h3>
                        <Separator className="flex-1 bg-white/10" />
                        <Badge
                          variant="outline"
                          className="rounded-lg border-white/10 bg-white/5 text-xs text-white/50"
                        >
                          {notesByCategory[category].length}
                        </Badge>
                      </div>
                    )}
                    {notesByCategory[category].map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        isDeleting={deleteNoteMutation.isPending}
                      />
                    ))}
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <AddNoteModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        teacherId={teacher.id}
        teacherName={teacher.fullName}
        mode="add"
      />

      {editingNote && (
        <AddNoteModal
          open={editModalOpen}
          onOpenChange={(open) => {
            setEditModalOpen(open);
            if (!open) setEditingNote(null);
          }}
          teacherId={teacher.id}
          teacherName={teacher.fullName}
          mode="edit"
          note={editingNote}
        />
      )}
    </div>
  );
}

// Note Card Component
function NoteCard({
  note,
  onEdit,
  onDelete,
  isDeleting,
}: {
  note: TeacherNoteDTO;
  onEdit: (note: TeacherNoteDTO) => void;
  onDelete: (note: TeacherNoteDTO) => void;
  isDeleting: boolean;
}) {
  const config =
    categoryConfig[note.category || "general"] || categoryConfig.general;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/2 p-5 transition-all duration-200 hover:border-rose-500/30 hover:bg-white/5">
      {/* Accent bar */}
      <div
        className="absolute inset-y-0 left-0 w-1 bg-linear-to-b from-rose-500 to-pink-500"
        aria-hidden="true"
      />

      <div className="flex items-start justify-between gap-4 pl-3">
        <div className="flex-1 min-w-0 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-white">{note.title}</p>
                {note.isConfidential && (
                  <Badge
                    variant="outline"
                    className="gap-1 rounded-lg border-amber-500/30 bg-amber-500/10 text-xs text-amber-200"
                  >
                    <Lock className="h-3 w-3" />
                    Confidential
                  </Badge>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-lg text-xs",
                    config.bg,
                    config.border,
                    config.text
                  )}
                >
                  {getCategoryLabel(note.category)}
                </Badge>
                {note.tags.length > 0 &&
                  note.tags.map((tag, idx) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="gap-1 rounded-lg border-white/5 bg-white/5 text-[10px] text-white/50"
                    >
                      <Tag className="h-2.5 w-2.5" />
                      {tag}
                    </Badge>
                  ))}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="rounded-lg border border-white/10 bg-white/2 p-3">
            <p className="whitespace-pre-wrap text-sm text-white/80">
              {note.content}
            </p>
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-white/50">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(note.createdAt)}
            </span>
            {note.createdBy && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                by {note.createdBy.name}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
            onClick={() => onEdit(note)}
            title="Edit note"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-white/60 hover:bg-red-500/10 hover:text-red-300"
            onClick={() => onDelete(note)}
            disabled={isDeleting}
            title="Delete note"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
