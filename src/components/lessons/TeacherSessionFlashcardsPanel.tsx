"use client";

import * as React from "react";
import { Layers, Plus, Pencil, Trash2, Sparkles, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveModal } from "@/components/modals/ResponsiveModal";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuItem,
  PremiumDropdownMenuTrigger,
} from "@/components/ui/premium-dropdown-menu";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { useBusyToast } from "@/hooks/useBusyToast";
import {
  useTeacherSessionFlashcards,
  useTeacherCreateSessionFlashcard,
  useTeacherUpdateSessionFlashcard,
  useTeacherDeleteSessionFlashcard,
  useTeacherBulkCreateSessionFlashcards,
} from "@/hooks/teacher/useTeacherSessionFlashcards";
import { useGenerateSessionFlashcards } from "@/hooks/teacher/useLessonsLeo";
import type { LessonFlashcardDto } from "@/types/lesson-flashcards";

type Props = {
  sessionId: string;
  canWrite: boolean;
  leoEnabled: boolean;
  studentPublished: boolean;
};

export function TeacherSessionFlashcardsPanel({
  sessionId,
  canWrite,
  leoEnabled,
  studentPublished,
}: Props) {
  const busyToast = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const { data, isLoading, error } = useTeacherSessionFlashcards(sessionId, true);
  const createMut = useTeacherCreateSessionFlashcard(sessionId);
  const bulkMut = useTeacherBulkCreateSessionFlashcards(sessionId);
  const updateMut = useTeacherUpdateSessionFlashcard(sessionId);
  const deleteMut = useTeacherDeleteSessionFlashcard(sessionId);
  const generateLeo = useGenerateSessionFlashcards();

  const [showAdd, setShowAdd] = React.useState(false);
  const [newFront, setNewFront] = React.useState("");
  const [newBack, setNewBack] = React.useState("");
  const [editing, setEditing] = React.useState<LessonFlashcardDto | null>(null);
  const [editFront, setEditFront] = React.useState("");
  const [editBack, setEditBack] = React.useState("");

  const cards = data?.data.cards || [];
  const publishedHint =
    !studentPublished
      ? "Students see flashcards when this session is published to them."
      : null;

  const openEdit = (c: LessonFlashcardDto) => {
    setEditing(c);
    setEditFront(c.front);
    setEditBack(c.back);
  };

  const submitAdd = async () => {
    await busyToast.promise(
      createMut.mutateAsync({ front: newFront.trim(), back: newBack.trim() }),
      {
        loading: "Adding card…",
        success: "Flashcard added",
        error: (e) => (e instanceof Error ? e.message : "Failed"),
      },
    );
    setNewFront("");
    setNewBack("");
    setShowAdd(false);
  };

  const generateWithLeo = async () => {
    const drafted = await busyToast.promise(generateLeo.mutateAsync({ sessionId, maxCards: 10 }), {
      loading: "Leo is drafting flashcards…",
      success: (rows) => `${rows.length} draft cards ready`,
      error: (e) => (e instanceof Error ? e.message : "Generation failed"),
    });
    if (!drafted?.length) return;
    await busyToast.promise(bulkMut.mutateAsync(drafted), {
      loading: "Saving cards…",
      success: "Flashcards saved — review before students study",
      error: (e) => (e instanceof Error ? e.message : "Failed to save"),
    });
  };

  const submitEdit = async () => {
    if (!editing) return;
    await busyToast.promise(
      updateMut.mutateAsync({
        cardId: editing.id,
        front: editFront.trim(),
        back: editBack.trim(),
      }),
      {
        loading: "Saving…",
        success: "Updated",
        error: (e) => (e instanceof Error ? e.message : "Failed"),
      },
    );
    setEditing(null);
  };

  const handleDelete = async (c: LessonFlashcardDto) => {
    const r = await confirm({
      title: "Remove flashcard?",
      description: "Students will no longer see this card.",
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
      intent: "destructive",
    });
    if (r !== "confirm") return;
    await busyToast.promise(deleteMut.mutateAsync(c.id), {
      loading: "Removing…",
      success: "Removed",
      error: (e) => (e instanceof Error ? e.message : "Failed"),
    });
  };

  return (
    <>
      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-fuchsia-500/15 text-fuchsia-200">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-lg text-white">Flashcards</CardTitle>
              <p className="text-xs text-white/50">{cards.length} card{cards.length === 1 ? "" : "s"}</p>
            </div>
          </div>
          {canWrite && (
            <div className="flex flex-wrap gap-2">
              {leoEnabled && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void generateWithLeo()}
                  disabled={generateLeo.isPending || bulkMut.isPending}
                  className="border-white/10 bg-white/5 text-white/75"
                >
                  {generateLeo.isPending ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1 h-4 w-4" />
                  )}
                  Draft with Leo
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                onClick={() => setShowAdd(true)}
                className="bg-fuchsia-500/20 text-fuchsia-100 hover:bg-fuchsia-500/30"
              >
                <Plus className="mr-1 h-4 w-4" />
                Add card
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {publishedHint && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
              {publishedHint}
            </div>
          )}
          {error && <p className="text-sm text-rose-300">{error.message}</p>}
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-white/5" />
              ))}
            </div>
          ) : cards.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 py-10 text-center text-sm text-white/50">
              <Sparkles className="mx-auto mb-2 h-8 w-8 text-white/25" />
              No flashcards yet. Add pairs manually or draft with Leo after you complete the session.
            </div>
          ) : (
            <ul className="space-y-3">
              {cards.map((c) => (
                <li key={c.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-sm text-white/90">{c.front}</p>
                      <p className="text-sm text-white/70">{c.back}</p>
                    </div>
                    {canWrite && (
                      <PremiumDropdownMenu>
                        <PremiumDropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 shrink-0 border border-white/10 text-white/70"
                          >
                            <span className="sr-only">Actions</span>
                            <Layers className="h-4 w-4" />
                          </Button>
                        </PremiumDropdownMenuTrigger>
                        <PremiumDropdownMenuContent align="end">
                          <PremiumDropdownMenuItem
                            icon={<Pencil className="h-4 w-4" />}
                            onClick={() => openEdit(c)}
                          >
                            Edit
                          </PremiumDropdownMenuItem>
                          <PremiumDropdownMenuItem
                            icon={<Trash2 className="h-4 w-4" />}
                            variant="destructive"
                            onClick={() => void handleDelete(c)}
                          >
                            Delete
                          </PremiumDropdownMenuItem>
                        </PremiumDropdownMenuContent>
                      </PremiumDropdownMenu>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ResponsiveModal open={showAdd} onClose={() => setShowAdd(false)} title="New flashcard" widthClass="max-w-lg">
        <div className="space-y-4 px-5 py-4">
          <div className="space-y-2">
            <Label className="text-white/80">Front</Label>
            <Textarea
              value={newFront}
              onChange={(e) => setNewFront(e.target.value)}
              className="min-h-[88px] border-white/10 bg-white/5 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/80">Back</Label>
            <Textarea
              value={newBack}
              onChange={(e) => setNewBack(e.target.value)}
              className="min-h-[88px] border-white/10 bg-white/5 text-white"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setShowAdd(false)} className="text-white/70">
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void submitAdd()}
              disabled={createMut.isPending || !newFront.trim() || !newBack.trim()}
              className="bg-fuchsia-500/25 text-fuchsia-100 hover:bg-fuchsia-500/35"
            >
              Save card
            </Button>
          </div>
        </div>
      </ResponsiveModal>

      <ResponsiveModal open={!!editing} onClose={() => setEditing(null)} title="Edit flashcard" widthClass="max-w-lg">
        {editing && (
          <div className="space-y-4 px-5 py-4">
            <Textarea
              value={editFront}
              onChange={(e) => setEditFront(e.target.value)}
              className="min-h-[88px] border-white/10 bg-white/5 text-white"
            />
            <Textarea
              value={editBack}
              onChange={(e) => setEditBack(e.target.value)}
              className="min-h-[88px] border-white/10 bg-white/5 text-white"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)} className="text-white/70">
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void submitEdit()}
                disabled={updateMut.isPending}
                className="bg-fuchsia-500/25 text-fuchsia-100"
              >
                Save
              </Button>
            </div>
          </div>
        )}
      </ResponsiveModal>

      {confirmationDialog}
    </>
  );
}
