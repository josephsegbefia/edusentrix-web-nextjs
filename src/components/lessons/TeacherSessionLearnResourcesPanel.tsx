"use client";

import * as React from "react";
import {
  Check,
  Globe,
  ImageIcon,
  Lightbulb,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LessonIllustrationPreview } from "@/components/lessons/LessonIllustrationPreview";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { useGenerateSessionFactCards } from "@/hooks/teacher/useLessonsLeo";
import {
  type FactCardDto,
  type FactCardPublishPayload,
  useBulkCreateSessionFactCards,
  useDeleteSessionFactCard,
  useTeacherSessionFactCards,
} from "@/hooks/teacher/useTeacherSessionFactCards";

type Props = {
  sessionId: string;
  sessionTitle: string;
  canWrite: boolean;
  leoEnabled: boolean;
};

type IllustrationReview = "none" | "suggested" | "draft" | "approved" | "rejected";

type PendingFactCard = {
  localId: string;
  fact: string;
  detail: string;
  tags: string[];
  illustrationSuggested?: boolean;
  illustrationPrompt?: string | null;
  illustrationGenerationBrief?: string | null;
  illustrationUrl?: string | null;
  illustrationUploadThingKey?: string | null;
  illustrationReview: IllustrationReview;
};

function newLocalId() {
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toPublishPayload(card: PendingFactCard): FactCardPublishPayload {
  const payload: FactCardPublishPayload = {
    fact: card.fact,
    detail: card.detail,
    tags: card.tags,
  };
  if (card.illustrationReview === "approved" && card.illustrationUrl) {
    payload.illustrationUrl = card.illustrationUrl;
    payload.illustrationUploadThingKey = card.illustrationUploadThingKey ?? null;
    payload.illustrationPrompt = card.illustrationPrompt ?? null;
  }
  return payload;
}

export function TeacherSessionLearnResourcesPanel({
  sessionId,
  sessionTitle,
  canWrite,
  leoEnabled,
}: Props) {
  const busyToast = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const generateMut = useGenerateSessionFactCards();
  const bulkSaveMut = useBulkCreateSessionFactCards(sessionId);
  const deleteMut = useDeleteSessionFactCard(sessionId);
  const { data, isLoading } = useTeacherSessionFactCards(sessionId);

  const [pendingCards, setPendingCards] = React.useState<PendingFactCard[]>([]);
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [newFact, setNewFact] = React.useState("");
  const [newDetail, setNewDetail] = React.useState("");
  const [illustrationLoadingId, setIllustrationLoadingId] = React.useState<string | null>(null);

  const savedCards = data?.data.cards ?? [];
  const hasPending = pendingCards.length > 0;

  const updatePendingCard = (localId: string, patch: Partial<PendingFactCard>) => {
    setPendingCards((prev) =>
      prev.map((card) => (card.localId === localId ? { ...card, ...patch } : card)),
    );
  };

  const handleGenerate = async () => {
    if (hasPending) {
      const ok = await confirm({
        title: "Replace pending cards?",
        description: "New Leo suggestions will replace the current pending batch.",
        confirmLabel: "Replace",
        variant: "warning",
      });
      if (!ok) return;
    }
    const result = await busyToast.promise(generateMut.mutateAsync({ sessionId, count: 3 }), {
      loading: "Leo is thinking of interesting facts…",
      success: (value) => {
        const skipped = value.skippedDuplicates;
        if (skipped > 0) {
          return `${value.cards.length} unique facts ready · ${skipped} duplicate${skipped === 1 ? "" : "s"} skipped`;
        }
        return "Fact cards ready — review and publish to Learn";
      },
      error: (e) => (e instanceof Error ? e.message : "Generation failed"),
    });
    setPendingCards(
      result.cards.map((card) => ({
        localId: newLocalId(),
        fact: card.fact,
        detail: card.detail,
        tags: card.tags ?? [],
        illustrationSuggested: card.illustrationSuggested,
        illustrationPrompt: card.illustrationPrompt ?? null,
        illustrationReview: card.illustrationSuggested ? "suggested" : "none",
      })),
    );
  };

  const generateIllustrationDraft = async (card: PendingFactCard) => {
    if (!card.fact.trim() || !card.detail.trim()) return;
    setIllustrationLoadingId(card.localId);
    try {
      const res = await fetch("/api/leo/lessons/generate-illustration-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fact: card.fact,
          detail: card.detail,
          prompt: card.illustrationPrompt ?? undefined,
          sessionTitle,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Illustration draft failed");
      }
      updatePendingCard(card.localId, {
        illustrationUrl: json.data?.imageUrl ?? null,
        illustrationUploadThingKey: json.data?.uploadThingKey ?? null,
        illustrationGenerationBrief: json.data?.generationPrompt ?? null,
        illustrationReview: "draft",
      });
      busyToast.success("Illustration draft ready — review before publishing");
    } catch (e) {
      busyToast.error(e instanceof Error ? e.message : "Illustration draft failed");
    } finally {
      setIllustrationLoadingId(null);
    }
  };

  const acceptCard = async (card: PendingFactCard) => {
    await busyToast.promise(bulkSaveMut.mutateAsync([toPublishPayload(card)]), {
      loading: "Publishing to Learn…",
      success: "Card published to EduSentrix Learn",
      error: (e) => (e instanceof Error ? e.message : "Failed to publish"),
    });
    setPendingCards((prev) => prev.filter((p) => p.localId !== card.localId));
  };

  const acceptAll = async () => {
    if (pendingCards.length === 0) return;
    const payloads = pendingCards.map(toPublishPayload);
    await busyToast.promise(bulkSaveMut.mutateAsync(payloads), {
      loading: "Publishing all cards to Learn…",
      success: "All fact cards published to EduSentrix Learn",
      error: (e) => (e instanceof Error ? e.message : "Failed to publish"),
    });
    setPendingCards([]);
  };

  const handleDelete = async (card: FactCardDto) => {
    const ok = await confirm({
      title: "Remove fact card?",
      description: "This will remove the card from EduSentrix Learn.",
      confirmLabel: "Remove",
      variant: "destructive",
    });
    if (!ok) return;
    await busyToast.promise(deleteMut.mutateAsync(card.id), {
      loading: "Removing…",
      success: "Fact card removed",
      error: (e) => (e instanceof Error ? e.message : "Failed"),
    });
  };

  const submitManual = async () => {
    if (!newFact.trim() || !newDetail.trim()) return;
    await busyToast.promise(
      bulkSaveMut.mutateAsync([{ fact: newFact.trim(), detail: newDetail.trim(), tags: [] }]),
      {
        loading: "Publishing to Learn…",
        success: "Fact card published",
        error: (e) => (e instanceof Error ? e.message : "Failed"),
      },
    );
    setNewFact("");
    setNewDetail("");
    setShowAddForm(false);
  };

  return (
    <div className="space-y-5">
      {confirmationDialog}

      {/* Section: Did You Know cards */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-200">
              <Lightbulb className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/85">Did You Know cards</p>
              <p className="text-xs text-white/40">
                Curiosity facts pushed directly to EduSentrix Learn for students.
                {savedCards.length > 0 ? ` ${savedCards.length} published.` : ""}
              </p>
            </div>
          </div>
          {canWrite ? (
            <div className="flex gap-2">
              {leoEnabled ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={generateMut.isPending}
                  onClick={() => void handleGenerate()}
                  className="border-violet-400/30 bg-violet-500/10 text-violet-100"
                >
                  {generateMut.isPending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Generate with Leo
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowAddForm(true)}
                className="border-white/10 bg-white/5 text-white/60"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add manually
              </Button>
            </div>
          ) : null}
        </div>

        {/* Pending cards from Leo */}
        {hasPending ? (
          <div className="rounded-xl border border-violet-400/20 bg-violet-500/5 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-violet-100">
                <Sparkles className="mr-1.5 inline h-4 w-4 text-violet-300" />
                {pendingCards.length} Leo suggestion{pendingCards.length === 1 ? "" : "s"} — review and publish
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void acceptAll()}
                  disabled={bulkSaveMut.isPending}
                  className="border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                >
                  <Globe className="mr-1.5 h-3.5 w-3.5" />
                  Publish all to Learn
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setPendingCards([])}
                  className="text-white/40 hover:text-white/70"
                >
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Discard all
                </Button>
              </div>
            </div>
            <div className="space-y-2.5">
              {pendingCards.map((card) => (
                <div
                  key={card.localId}
                  className="rounded-xl border border-violet-400/15 bg-violet-900/20 p-3 space-y-2"
                >
                  <p className="text-sm font-semibold text-amber-100">{card.fact}</p>
                  <p className="text-sm text-white/65">{card.detail}</p>
                  {card.illustrationReview === "suggested" && card.illustrationPrompt ? (
                    <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
                      <p className="font-medium">Leo suggests an illustration</p>
                      <p className="mt-1 text-white/60">{card.illustrationPrompt}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-2 h-7 border-amber-400/30 bg-amber-500/10 text-amber-100"
                        disabled={illustrationLoadingId === card.localId}
                        onClick={() => void generateIllustrationDraft(card)}
                      >
                        {illustrationLoadingId === card.localId ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Generate illustration draft
                      </Button>
                    </div>
                  ) : null}
                  {card.illustrationUrl && card.illustrationReview === "draft" ? (
                    <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-2">
                      <LessonIllustrationPreview
                        src={card.illustrationUrl}
                        alt="Draft illustration for fact card"
                      />
                      {card.illustrationGenerationBrief ? (
                        <details className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/55">
                          <summary className="cursor-pointer font-medium text-white/70">
                            Leo illustration brief
                          </summary>
                          <p className="mt-2 whitespace-pre-wrap leading-relaxed text-white/50">
                            {card.illustrationGenerationBrief}
                          </p>
                        </details>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 bg-emerald-500/20 text-emerald-100"
                          onClick={() =>
                            updatePendingCard(card.localId, { illustrationReview: "approved" })
                          }
                        >
                          <Check className="mr-1 h-3.5 w-3.5" />
                          Accept illustration
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 text-rose-300/80"
                          onClick={() =>
                            updatePendingCard(card.localId, {
                              illustrationReview: "rejected",
                              illustrationUrl: null,
                              illustrationUploadThingKey: null,
                              illustrationGenerationBrief: null,
                            })
                          }
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {card.illustrationReview === "approved" && card.illustrationUrl ? (
                    <div className="space-y-2">
                      <LessonIllustrationPreview
                        src={card.illustrationUrl}
                        alt="Approved illustration for fact card"
                      />
                      <p className="text-[11px] text-emerald-300/80">
                        <Check className="mr-1 inline h-3 w-3" />
                        Illustration approved — will publish with this card
                      </p>
                    </div>
                  ) : null}
                  {card.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {card.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/45"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void acceptCard(card)}
                      disabled={bulkSaveMut.isPending}
                      className="border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                    >
                      <Globe className="mr-1.5 h-3.5 w-3.5" />
                      Publish to Learn
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setPendingCards((prev) => prev.filter((p) => p.localId !== card.localId))
                      }
                      className="text-rose-300/60 hover:text-rose-300"
                    >
                      <X className="mr-1.5 h-3.5 w-3.5" />
                      Discard
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Manual add form */}
        {showAddForm ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            <p className="text-sm font-medium text-white/80">New fact card</p>
            <div className="space-y-2">
              <Label className="text-xs text-white/50">Hook sentence</Label>
              <Input
                value={newFact}
                onChange={(e) => setNewFact(e.target.value)}
                placeholder="Did you know that…"
                className="border-white/10 bg-black/20 text-sm text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-white/50">Detail (2-3 sentences)</Label>
              <Textarea
                value={newDetail}
                onChange={(e) => setNewDetail(e.target.value)}
                placeholder="Explain why this is interesting or how it connects to real life…"
                className="min-h-[80px] border-white/10 bg-black/20 text-sm text-white"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => void submitManual()}
                disabled={bulkSaveMut.isPending || !newFact.trim() || !newDetail.trim()}
                className="bg-emerald-500/20 text-emerald-100"
              >
                <Globe className="mr-1.5 h-3.5 w-3.5" />
                Publish to Learn
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowAddForm(false);
                  setNewFact("");
                  setNewDetail("");
                }}
                className="text-white/50"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {/* Saved / published cards */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        ) : savedCards.length > 0 ? (
          <div className="space-y-2.5">
            {savedCards.map((card) => (
              <div
                key={card.id}
                className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-3.5"
              >
                <div className="flex items-start gap-2">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/70" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-semibold text-amber-100">{card.fact}</p>
                    <p className="text-sm text-white/60">{card.detail}</p>
                    {card.illustrationUrl ? (
                      <LessonIllustrationPreview
                        src={card.illustrationUrl}
                        alt="Fact card illustration"
                        className="mt-2"
                      />
                    ) : null}
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="flex items-center gap-1 text-[10px] text-emerald-300/70">
                        <Check className="h-3 w-3" />
                        Published to Learn
                      </span>
                      {card.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/40"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  {canWrite ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0 text-rose-300/40 hover:text-rose-300"
                      onClick={() => void handleDelete(card)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : !hasPending ? (
          <div className="rounded-xl border border-dashed border-white/10 py-8 text-center">
            <Lightbulb className="mx-auto mb-2 h-7 w-7 text-white/20" />
            <p className="text-sm text-white/40">No fact cards published yet.</p>
            {canWrite && leoEnabled ? (
              <p className="mt-0.5 text-xs text-white/25">
                Generate curiosity facts with Leo or add one manually.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
