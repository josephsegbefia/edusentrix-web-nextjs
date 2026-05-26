"use client";

import * as React from "react";
import {
  BookOpen,
  Check,
  ClipboardCopy,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useGenerateBoardNotes } from "@/hooks/teacher/useLessonsLeo";
import { cn } from "@/lib/utils";

type BoardNotes = {
  contentHtml: string;
  generatedAt: string | Date;
  aiGenerated: boolean;
};

type Props = {
  sessionId: string;
  initialNotes?: BoardNotes | null;
  canWrite: boolean;
  leoEnabled: boolean;
  /** Called after notes are saved so the parent can update state */
  onSaved?: (notes: BoardNotes) => void;
};

async function saveBoardNotes(
  sessionId: string,
  contentHtml: string,
  aiGenerated: boolean,
): Promise<BoardNotes> {
  const res = await fetch(`/api/teacher/lesson-sessions/${sessionId}/board-notes`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentHtml, aiGenerated }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error ?? "Failed to save board notes");
  }
  return (json.data as { boardNotes: BoardNotes }).boardNotes;
}

export function SessionBoardNotesPanel({
  sessionId,
  initialNotes,
  canWrite,
  leoEnabled,
  onSaved,
}: Props) {
  const busyToast = useBusyToast();
  const generateBoardNotes = useGenerateBoardNotes();

  const [notes, setNotes] = React.useState<BoardNotes | null>(initialNotes ?? null);
  const [editMode, setEditMode] = React.useState(false);
  const [editHtml, setEditHtml] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (initialNotes) setNotes(initialNotes);
  }, [initialNotes]);

  const handleGenerate = async () => {
    const generated = await busyToast.promise(
      generateBoardNotes.mutateAsync({ sessionId }),
      {
        loading: "Leo is writing board notes…",
        success: "Board notes generated",
        error: (e) => (e instanceof Error ? e.message : "Generation failed"),
      },
    );
    // Auto-save after generation
    setSaving(true);
    try {
      const saved = await saveBoardNotes(sessionId, generated.contentHtml, true);
      setNotes(saved);
      onSaved?.(saved);
      busyToast.success("Board notes saved");
    } catch (e) {
      busyToast.error(e instanceof Error ? e.message : "Failed to save board notes");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = () => {
    setEditHtml(notes?.contentHtml ?? "");
    setEditMode(true);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const saved = await saveBoardNotes(sessionId, editHtml, false);
      setNotes(saved);
      onSaved?.(saved);
      setEditMode(false);
      busyToast.success("Board notes updated");
    } catch (e) {
      busyToast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    if (!notes?.contentHtml) return;
    const text = notes.contentHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isBusy = generateBoardNotes.isPending || saving;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {leoEnabled && canWrite ? (
          <Button
            type="button"
            disabled={isBusy}
            onClick={() => void handleGenerate()}
            className={cn(
              "bg-violet-500/20 text-violet-100 hover:bg-violet-500/30",
              notes ? "text-xs px-3 py-1.5 h-auto" : "",
            )}
          >
            {isBusy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {notes ? "Regenerate" : "Generate with Leo"}
          </Button>
        ) : null}
        {notes && canWrite && !editMode ? (
          <Button
            type="button"
            variant="ghost"
            onClick={handleEdit}
            className="h-auto px-3 py-1.5 text-xs text-white/60 hover:bg-white/5 hover:text-white"
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
        ) : null}
        {notes && !editMode ? (
          <Button
            type="button"
            variant="ghost"
            onClick={handleCopy}
            className="h-auto px-3 py-1.5 text-xs text-white/60 hover:bg-white/5 hover:text-white"
          >
            {copied ? (
              <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-300" />
            ) : (
              <ClipboardCopy className="mr-1.5 h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy as text"}
          </Button>
        ) : null}
        {editMode ? (
          <>
            <Button
              type="button"
              disabled={saving}
              onClick={() => void handleSaveEdit()}
              className="h-auto px-3 py-1.5 text-xs bg-teal-500/25 text-teal-100 hover:bg-teal-500/35"
            >
              {saving ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditMode(false)}
              className="h-auto px-3 py-1.5 text-xs text-white/50 hover:bg-white/5 hover:text-white"
            >
              Cancel
            </Button>
          </>
        ) : null}
      </div>

      {/* Content */}
      {editMode ? (
        <div className="space-y-2">
          <p className="text-xs text-white/40">
            Edit the board notes HTML. Use &lt;h3&gt;, &lt;ul&gt;, &lt;ol&gt;, &lt;p&gt;, &lt;strong&gt;.
          </p>
          <textarea
            value={editHtml}
            onChange={(e) => setEditHtml(e.target.value)}
            className="h-96 w-full rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/80 font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/30"
          />
        </div>
      ) : notes ? (
        <div className="rounded-xl border border-white/10 bg-black/20 p-5">
          {notes.aiGenerated ? (
            <p className="mb-3 flex items-center gap-1.5 text-xs text-violet-300/70">
              <Sparkles className="h-3 w-3" />
              Leo-generated · For teacher use on blackboard
            </p>
          ) : null}
          <div
            className="prose prose-invert max-w-none prose-h3:text-sm prose-h3:font-semibold prose-h3:text-white/90 prose-p:text-sm prose-p:text-white/75 prose-li:text-sm prose-li:text-white/75 prose-strong:text-white"
            dangerouslySetInnerHTML={{ __html: notes.contentHtml }}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/3 py-10 text-center">
          <BookOpen className="h-7 w-7 text-white/20" />
          <p className="text-sm text-white/50">No board notes yet.</p>
          {leoEnabled && canWrite ? (
            <p className="text-xs text-white/35">
              Generate notes with Leo — they&apos;ll be ready for you to dictate or write on the board.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
