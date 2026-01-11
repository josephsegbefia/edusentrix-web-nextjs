// src/components/admin/teachers/detail/TeacherNotesTab.tsx
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Pencil, Trash2, StickyNote, Lock } from "lucide-react";
import { toast } from "sonner";
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

function getCategoryBadgeClass(category: TeacherNoteCategory | null): string {
  switch (category) {
    case "performance":
      return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
    case "behavior":
      return "border-amber-400/30 bg-amber-500/10 text-amber-200";
    case "disciplinary":
      return "border-red-400/30 bg-red-500/10 text-red-200";
    case "professional_development":
      return "border-blue-400/30 bg-blue-500/10 text-blue-200";
    default:
      return "border-white/10 bg-white/5 text-white/80";
  }
}

export function TeacherNotesTab({ teacher }: Props) {
  const [addModalOpen, setAddModalOpen] = React.useState(false);
  const [editModalOpen, setEditModalOpen] = React.useState(false);
  const [editingNote, setEditingNote] = React.useState<TeacherNoteDTO | null>(null);
  const [categoryFilter, setCategoryFilter] = React.useState<TeacherNoteCategory | null>(null);

  const { data: notesData, isLoading } = useTeacherNotes(teacher.id, {
    category: categoryFilter || undefined,
  });
  const notes = notesData?.data ?? [];

  const deleteNoteMutation = useDeleteNote();
  const busy = useBusyToast();

  const handleEdit = (note: TeacherNoteDTO) => {
    setEditingNote(note);
    setEditModalOpen(true);
  };

  const handleDelete = async (note: TeacherNoteDTO) => {
    if (!confirm(`Are you sure you want to delete "${note.title}"?\n\nThis action cannot be undone.`))
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
          error: (e: Error) => e.message || "Failed to delete note",
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
    <div className="space-y-4">
      {/* Header with add button */}
      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Notes</CardTitle>
          <Button
            variant="outline"
            className="gap-2"
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
          >
            All ({notes.length})
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={categoryFilter === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryFilter(cat)}
            >
              {getCategoryLabel(cat)} ({notesByCategory[cat].length})
            </Button>
          ))}
        </div>
      )}

      {/* Notes list */}
      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex items-center gap-3 py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
              <p className="text-sm text-muted-foreground">Loading notes...</p>
            </div>
          ) : notes.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
              <div className="flex items-start justify-center gap-4">
                <div className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/5">
                  <StickyNote className="h-5 w-5 text-white/80" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold">No notes yet</p>
                  <p className="text-sm text-muted-foreground">
                    {categoryFilter
                      ? `No notes in the "${getCategoryLabel(categoryFilter)}" category`
                      : "Add the first note to get started"}
                  </p>
                </div>
              </div>
              {!categoryFilter && (
                <div className="mt-4">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => setAddModalOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Add First Note
                  </Button>
                </div>
              )}
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
                      <div className="flex items-center gap-2 pt-2">
                        <h3 className="text-sm font-semibold text-muted-foreground">
                          {getCategoryLabel(category)}
                        </h3>
                        <Separator className="flex-1" />
                        <Badge variant="outline" className="text-xs">
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
  return (
    <div className="group rounded-lg border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">{note.title}</p>
                {note.isConfidential && (
                  <Badge
                    variant="outline"
                    className="border-amber-400/30 bg-amber-500/10 text-amber-200 gap-1 text-xs"
                  >
                    <Lock className="h-3 w-3" />
                    Confidential
                  </Badge>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={getCategoryBadgeClass(note.category)}
                >
                  {getCategoryLabel(note.category)}
                </Badge>
                {note.tags.length > 0 &&
                  note.tags.map((tag, idx) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="border-white/5 bg-white/5 text-xs text-white/60"
                    >
                      {tag}
                    </Badge>
                  ))}
              </div>
            </div>
          </div>

          <p className="text-sm text-white/80 whitespace-pre-wrap">{note.content}</p>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Created {formatDate(note.createdAt)}</span>
            {note.createdBy && (
              <span>by {note.createdBy.name}</span>
            )}
          </div>
        </div>

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
            onClick={() => onEdit(note)}
            title="Edit note"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/60 hover:text-red-300 hover:bg-red-500/10"
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
