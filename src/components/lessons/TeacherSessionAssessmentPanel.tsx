"use client";

import * as React from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { useUpdateLessonSession } from "@/hooks/teacher/useTeacherLessonSession";
import {
  type LessonAssessmentItem,
  useGenerateSessionAssessment,
} from "@/hooks/teacher/useLessonsLeo";
import { cn } from "@/lib/utils";

const ITEM_TYPE_LABELS: Record<LessonAssessmentItem["type"], string> = {
  multiple_choice: "Multiple choice",
  short_answer: "Short answer",
  fill_blank: "Fill in the blank",
  practical_task: "Practical task",
  project: "Project",
};

const ITEM_TYPE_COLORS: Record<LessonAssessmentItem["type"], string> = {
  multiple_choice: "border-teal-400/25 bg-teal-500/10 text-teal-200",
  short_answer: "border-blue-400/25 bg-blue-500/10 text-blue-200",
  fill_blank: "border-amber-400/25 bg-amber-500/10 text-amber-200",
  practical_task: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
  project: "border-violet-400/25 bg-violet-500/10 text-violet-200",
};

type Props = {
  sessionId: string;
  initialItems?: LessonAssessmentItem[];
  canWrite: boolean;
  leoEnabled: boolean;
};

function ItemCard({
  item,
  onUpdate,
  onRemove,
}: {
  item: LessonAssessmentItem;
  onUpdate: (patch: Partial<LessonAssessmentItem>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [editing, setEditing] = React.useState(false);

  return (
    <div
      className={cn(
        "rounded-xl border p-3.5 transition",
        item.aiGenerated
          ? "border-amber-500/20 bg-amber-500/5"
          : "border-white/10 bg-white/5",
      )}
    >
      <div className="flex flex-wrap items-start gap-2">
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
            ITEM_TYPE_COLORS[item.type],
          )}
        >
          {ITEM_TYPE_LABELS[item.type]}
        </span>
        {item.aiGenerated ? (
          <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200/70">
            AI draft
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-white/40 hover:text-white/80"
            onClick={() => setEditing((e) => !e)}
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-rose-300/60 hover:text-rose-300"
            onClick={onRemove}
            title="Remove"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {editing ? (
        <div className="mt-3 space-y-2.5">
          <div>
            <Label className="text-xs text-white/50">Title</Label>
            <Input
              value={item.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              className="mt-1 border-white/10 bg-black/20 text-sm text-white"
            />
          </div>
          <div>
            <Label className="text-xs text-white/50">Question / Task</Label>
            <Textarea
              value={item.question.replace(/<[^>]+>/g, " ").trim()}
              onChange={(e) =>
                onUpdate({ question: `<p>${e.target.value.replace(/</g, "&lt;")}</p>` })
              }
              className="mt-1 min-h-[80px] border-white/10 bg-black/20 text-sm text-white"
            />
          </div>
          {item.type === "multiple_choice" ? (
            <div>
              <Label className="text-xs text-white/50">Options (one per line)</Label>
              <Textarea
                value={(item.options ?? []).join("\n")}
                onChange={(e) =>
                  onUpdate({ options: e.target.value.split("\n").filter((l) => l.trim()) })
                }
                className="mt-1 min-h-[80px] border-white/10 bg-black/20 text-sm text-white"
              />
            </div>
          ) : null}
          <div>
            <Label className="text-xs text-white/50">Correct answer / expected response</Label>
            <Textarea
              value={item.correctAnswer ?? ""}
              onChange={(e) => onUpdate({ correctAnswer: e.target.value || null })}
              className="mt-1 border-white/10 bg-black/20 text-sm text-white"
            />
          </div>
          {(item.type === "practical_task" || item.type === "project") ? (
            <div>
              <Label className="text-xs text-white/50">Rubric / marking guidance</Label>
              <Textarea
                value={item.rubric ?? ""}
                onChange={(e) => onUpdate({ rubric: e.target.value || null })}
                className="mt-1 min-h-[60px] border-white/10 bg-black/20 text-sm text-white"
              />
            </div>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(false);
              onUpdate({ aiGenerated: false });
            }}
            className="border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
          >
            <Check className="mr-1.5 h-3.5 w-3.5" />
            Done editing
          </Button>
        </div>
      ) : (
        <div className="mt-2 space-y-1.5">
          <p className="text-sm font-medium text-white/90">{item.title || "Untitled item"}</p>
          <div
            className="text-sm text-white/70"
            dangerouslySetInnerHTML={{ __html: item.question }}
          />
          {item.type === "multiple_choice" && item.options?.length ? (
            <ul className="mt-1 space-y-0.5 pl-3">
              {item.options.map((opt, i) => (
                <li key={i} className="text-xs text-white/55">
                  {String.fromCharCode(65 + i)}. {opt}
                </li>
              ))}
            </ul>
          ) : null}

          {/* Expandable answer/rubric */}
          {(item.correctAnswer || item.rubric) ? (
            <button
              type="button"
              className="flex items-center gap-1 text-[11px] text-white/35 hover:text-white/60"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {expanded ? "Hide" : "Show"} answer / rubric
            </button>
          ) : null}
          {expanded ? (
            <div className="rounded-lg border border-white/8 bg-emerald-500/5 p-2.5 text-xs text-emerald-100/80">
              {item.correctAnswer ? (
                <p>
                  <span className="font-medium">Answer:</span> {item.correctAnswer}
                </p>
              ) : null}
              {item.rubric ? (
                <p className="mt-1">
                  <span className="font-medium">Rubric:</span> {item.rubric}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function TeacherSessionAssessmentPanel({
  sessionId,
  initialItems = [],
  canWrite,
  leoEnabled,
}: Props) {
  const busyToast = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const generateMut = useGenerateSessionAssessment();
  const updateMut = useUpdateLessonSession(sessionId);

  const [items, setItems] = React.useState<LessonAssessmentItem[]>(initialItems);
  const [pendingItems, setPendingItems] = React.useState<LessonAssessmentItem[]>([]);
  const [saving, setSaving] = React.useState(false);

  const hasPending = pendingItems.length > 0;
  const hasItems = items.length > 0;

  const saveItems = async (toSave: LessonAssessmentItem[]) => {
    setSaving(true);
    try {
      await updateMut.mutateAsync({ assessmentItems: toSave });
      setItems(toSave);
      busyToast.success("Assessment saved");
    } catch (e: unknown) {
      busyToast.error(e instanceof Error ? e.message : "Failed to save assessment");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (hasPending) {
      const ok = await confirm({
        title: "Replace pending items?",
        description:
          "Generating new items will replace the pending draft items that have not been accepted yet.",
        confirmLabel: "Replace",
        variant: "warning",
      });
      if (!ok) return;
    }

    const generated = await busyToast.promise(
      generateMut.mutateAsync({ sessionId, count: 6 }),
      {
        loading: "Leo is generating assessment items…",
        success: "Assessment items ready — review and accept",
        error: (e) => (e instanceof Error ? e.message : "Generation failed"),
      },
    );
    setPendingItems(generated);
  };

  const acceptItem = (item: LessonAssessmentItem) => {
    const updated = [
      ...items.filter((i) => i.id !== item.id),
      { ...item, aiGenerated: false },
    ];
    void saveItems(updated);
    setPendingItems((prev) => prev.filter((p) => p.id !== item.id));
  };

  const discardItem = (id: string) => {
    setPendingItems((prev) => prev.filter((p) => p.id !== id));
  };

  const acceptAll = () => {
    const merged = [
      ...items,
      ...pendingItems.map((p) => ({ ...p, aiGenerated: false })),
    ];
    void saveItems(merged);
    setPendingItems([]);
  };

  const updateItem = (id: string, patch: Partial<LessonAssessmentItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const removeItem = async (id: string) => {
    const ok = await confirm({
      title: "Remove assessment item?",
      description: "This will permanently remove the item from the saved assessment.",
      confirmLabel: "Remove",
      variant: "destructive",
    });
    if (!ok) return;
    const updated = items.filter((i) => i.id !== id);
    void saveItems(updated);
  };

  const savePendingEdit = (id: string, patch: Partial<LessonAssessmentItem>) => {
    setPendingItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  return (
    <div className="space-y-5">
      {confirmationDialog}

      {/* Header actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white/80">Assessment items</p>
          <p className="text-xs text-white/45">
            {hasItems
              ? `${items.length} saved item${items.length === 1 ? "" : "s"}`
              : "No assessment items yet."}
          </p>
        </div>
        {canWrite && leoEnabled ? (
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
      </div>

      {/* Pending items from Leo — review before saving */}
      {hasPending ? (
        <div className="rounded-xl border border-violet-400/20 bg-violet-500/5 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-violet-100">
              <Sparkles className="mr-1.5 inline h-4 w-4 text-violet-300" />
              Leo generated {pendingItems.length} item{pendingItems.length === 1 ? "" : "s"} — review each one
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={acceptAll}
                disabled={saving}
                className="border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
              >
                <Check className="mr-1.5 h-3.5 w-3.5" />
                Accept all
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setPendingItems([])}
                className="text-white/50 hover:text-white/80"
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                Discard all
              </Button>
            </div>
          </div>
          <div className="space-y-2.5">
            {pendingItems.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-violet-400/15 bg-violet-900/20 p-3 space-y-2"
              >
                <div className="flex flex-wrap items-start gap-2">
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                      ITEM_TYPE_COLORS[item.type],
                    )}
                  >
                    {ITEM_TYPE_LABELS[item.type]}
                  </span>
                  <p className="min-w-0 flex-1 text-sm font-medium text-white/85">{item.title}</p>
                </div>
                <div
                  className="text-sm text-white/65"
                  dangerouslySetInnerHTML={{ __html: item.question }}
                />
                {item.options?.length ? (
                  <ul className="pl-3 space-y-0.5">
                    {item.options.map((opt, i) => (
                      <li key={i} className="text-xs text-white/50">
                        {String.fromCharCode(65 + i)}. {opt}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {item.correctAnswer ? (
                  <p className="text-xs text-emerald-300/70">
                    <span className="font-medium">Answer:</span> {item.correctAnswer}
                  </p>
                ) : null}
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => acceptItem(item)}
                    disabled={saving}
                    className="border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                  >
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                    Accept
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => discardItem(item.id)}
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

      {/* Saved items */}
      {hasItems ? (
        <div className="space-y-2.5">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onUpdate={(patch) => {
                updateItem(item.id, patch);
                // Auto-save on field change with a small delay
                const updated = items.map((i) => (i.id === item.id ? { ...i, ...patch } : i));
                void saveItems(updated);
              }}
              onRemove={() => void removeItem(item.id)}
            />
          ))}
        </div>
      ) : !hasPending ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-white/8 bg-white/3 py-10 text-center">
          <BookOpen className="h-8 w-8 text-white/20" />
          <div>
            <p className="text-sm font-medium text-white/60">No assessment items yet</p>
            {canWrite && leoEnabled ? (
              <p className="mt-1 text-xs text-white/35">
                Generate items with Leo or add them manually.
              </p>
            ) : null}
          </div>
          {canWrite ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setItems((prev) => [
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    type: "short_answer",
                    title: "",
                    question: "",
                    aiGenerated: false,
                  },
                ])
              }
              className="border-white/10 bg-white/5 text-white/60"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add item manually
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Add manual item button when there are already items */}
      {hasItems && canWrite ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            setItems((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                type: "short_answer",
                title: "",
                question: "",
                aiGenerated: false,
              },
            ])
          }
          className="border-white/10 bg-white/5 text-white/50"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add item
        </Button>
      ) : null}

      {saving ? (
        <p className="flex items-center gap-1.5 text-xs text-white/35">
          <Loader2 className="h-3 w-3 animate-spin" />
          Saving…
        </p>
      ) : null}
    </div>
  );
}
