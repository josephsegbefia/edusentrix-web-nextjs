"use client";

import * as React from "react";
import { Layers, Plus, Pencil, Trash2, Sparkles, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { findDuplicateFlashcardIds } from "@/lib/lessons/flashcard-generation";
import { TeacherSessionFlashcardsBulkBar } from "@/components/lessons/TeacherSessionFlashcardsBulkBar";
import { LearnStudentReadyHint } from "@/components/lessons/LearnStudentReadyHint";
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
  useTeacherBulkDeleteSessionFlashcards,
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
  const bulkDeleteMut = useTeacherBulkDeleteSessionFlashcards(sessionId);
  const generateLeo = useGenerateSessionFlashcards();

  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = React.useState(false);
  const [newFront, setNewFront] = React.useState("");
  const [newBack, setNewBack] = React.useState("");
  const [editing, setEditing] = React.useState<LessonFlashcardDto | null>(null);
  const [editFront, setEditFront] = React.useState("");
  const [editBack, setEditBack] = React.useState("");

  const cards = data?.data.cards || [];
  const deck = data?.data.deck;
  const duplicateIds = React.useMemo(() => findDuplicateFlashcardIds(cards), [cards]);
  const selectedCount = selectedIds.size;
  const allSelected = cards.length > 0 && cards.every((c) => selectedIds.has(c.id));
  const someSelected = cards.some((c) => selectedIds.has(c.id));

  React.useEffect(() => {
    setSelectedIds((prev) => {
      const valid = new Set(cards.map((c) => c.id));
      const next = new Set([...prev].filter((id) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [cards]);

  const toggleCard = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(cards.map((c) => c.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectDuplicates = () => {
    setSelectedIds(new Set(duplicateIds));
  };

  const publishedHint =
    !studentPublished
      ? "Students see flashcards when this session is published to them."
      : null;

  const learnFlashcardStatus =
    deck?.status === "published" && cards.length > 0
      ? "ready"
      : cards.length > 0
        ? "needs_action"
        : "optional";

  const learnFlashcardMessage =
    learnFlashcardStatus === "ready"
      ? "Flashcards are ready for the Today's Journey flashcard step."
      : learnFlashcardStatus === "needs_action"
        ? "Publish the deck so students see flashcards in EduSentrix Learn."
        : "Optional — add flashcards if you want them in Today's Journey.";

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

  const CARD_BY_CARD_TOTAL = 8;

  /**
   * Card-by-card: each call gets a slot focus + existing deck from the server,
   * with duplicate detection and retries before save.
   */
  const generateCardByCard = async (total: number) => {
    let generated = 0;
    let skipped = 0;
    let failed = 0;

    for (let slotIndex = 0; slotIndex < total; slotIndex++) {
      try {
        const result = await generateLeo.mutateAsync({
          sessionId,
          maxCards: 1,
          slotIndex,
          totalSlots: total,
        });
        skipped += result.skippedDuplicates;
        if (!result.cards.length) {
          failed += 1;
          continue;
        }
        const saveRes = await bulkMut.mutateAsync(result.cards);
        const saveSkipped = (saveRes as { data?: { skippedDuplicates?: number } })?.data
          ?.skippedDuplicates;
        if (typeof saveSkipped === "number") skipped += saveSkipped;
        generated += 1;
      } catch {
        failed += 1;
      }
    }

    if (generated > 0) {
      const parts = [
        `${generated} unique flashcard${generated === 1 ? "" : "s"} saved`,
        skipped > 0 ? `${skipped} duplicate${skipped === 1 ? "" : "s"} skipped` : null,
        failed > 0 ? `${failed} slot${failed === 1 ? "" : "s"} could not produce a new card` : null,
      ].filter(Boolean);
      busyToast.success(parts.join(" · "));
    } else {
      busyToast.error(
        "Leo could not add new cards without repeating what you already have. Try bulk generate or add cards manually.",
      );
    }
  };

  const generateWithLeo = async (mode: "one-by-one" | "bulk" = "bulk") => {
    if (mode === "bulk") {
      await busyToast.promise(
        (async () => {
          const result = await generateLeo.mutateAsync({ sessionId, maxCards: 10 });
          if (!result.cards.length) {
            throw new Error("Leo did not return any unique cards for this lesson.");
          }
          const saveRes = await bulkMut.mutateAsync(result.cards);
          const saveSkipped = (saveRes as { data?: { skippedDuplicates?: number } })?.data
            ?.skippedDuplicates;
          const skipped = result.skippedDuplicates + (saveSkipped ?? 0);
          if (skipped > 0) {
            return `${result.cards.length} cards saved · ${skipped} duplicate${skipped === 1 ? "" : "s"} skipped`;
          }
          return `${result.cards.length} unique flashcards saved`;
        })(),
        {
          loading: "Leo is drafting a varied flashcard set…",
          success: (msg) => msg,
          error: (e) => (e instanceof Error ? e.message : "Generation failed"),
        },
      );
    } else {
      busyToast.show("Generating varied flashcards one by one…");
      await generateCardByCard(CARD_BY_CARD_TOTAL);
      busyToast.hide();
    }
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

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    const r = await confirm({
      title: `Remove ${ids.length} flashcard${ids.length === 1 ? "" : "s"}?`,
      description: "Students will no longer see the selected cards.",
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
      intent: "destructive",
    });
    if (r !== "confirm") return;
    await busyToast.promise(bulkDeleteMut.mutateAsync(ids), {
      loading: "Removing cards…",
      success: (res) => {
        const deleted = res.data?.deleted ?? ids.length;
        return `${deleted} card${deleted === 1 ? "" : "s"} removed`;
      },
      error: (e) => (e instanceof Error ? e.message : "Failed"),
    });
    clearSelection();
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
                <PremiumDropdownMenu>
                  <PremiumDropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={generateLeo.isPending || bulkMut.isPending}
                      className="border-violet-400/30 bg-violet-500/10 text-violet-100"
                    >
                      {generateLeo.isPending || bulkMut.isPending ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1 h-4 w-4" />
                      )}
                      Generate with Leo
                    </Button>
                  </PremiumDropdownMenuTrigger>
                  <PremiumDropdownMenuContent align="end">
                    <PremiumDropdownMenuItem onClick={() => void generateWithLeo("bulk")}>
                      Generate varied set (recommended)
                    </PremiumDropdownMenuItem>
                    <PremiumDropdownMenuItem onClick={() => void generateWithLeo("one-by-one")}>
                      Add one by one ({CARD_BY_CARD_TOTAL} slots)
                    </PremiumDropdownMenuItem>
                  </PremiumDropdownMenuContent>
                </PremiumDropdownMenu>
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
          <LearnStudentReadyHint status={learnFlashcardStatus} message={learnFlashcardMessage} />
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
              No flashcards yet. Add pairs manually or generate them with Leo.
            </div>
          ) : (
            <div className="space-y-3">
              {canWrite ? (
                <TeacherSessionFlashcardsBulkBar
                  selectedCount={selectedCount}
                  duplicateCount={duplicateIds.length}
                  onClearSelection={clearSelection}
                  onSelectDuplicates={selectDuplicates}
                  onDeleteSelected={() => void handleBulkDelete()}
                  isDeleting={bulkDeleteMut.isPending}
                />
              ) : null}

              {canWrite && cards.length > 1 ? (
                <div className="flex items-center gap-2 px-1">
                  <Checkbox
                    id="flashcards-select-all"
                    checked={allSelected}
                    indeterminate={someSelected && !allSelected}
                    onCheckedChange={(value) => toggleSelectAll(value === true)}
                    className="border-white/20 data-[state=checked]:border-fuchsia-400 data-[state=checked]:bg-fuchsia-500"
                  />
                  <Label
                    htmlFor="flashcards-select-all"
                    className="cursor-pointer text-xs text-white/55"
                  >
                    Select all ({cards.length})
                  </Label>
                </div>
              ) : null}

              <ul className="space-y-3">
              {cards.map((c) => {
                const isSelected = selectedIds.has(c.id);
                const isDuplicate = duplicateIds.includes(c.id);
                return (
                <li
                  key={c.id}
                  className={cn(
                    "rounded-2xl border bg-white/5 p-4 transition-colors",
                    isSelected
                      ? "border-fuchsia-400/35 bg-fuchsia-500/10"
                      : "border-white/10",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    {canWrite ? (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(value) => toggleCard(c.id, value === true)}
                        aria-label={`Select flashcard: ${c.front.slice(0, 40)}`}
                        className="mt-0.5 border-white/20 data-[state=checked]:border-fuchsia-400 data-[state=checked]:bg-fuchsia-500"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {isDuplicate ? (
                          <span className="rounded-md border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200">
                            Duplicate
                          </span>
                        ) : null}
                      </div>
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
              );
              })}
              </ul>
            </div>
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
