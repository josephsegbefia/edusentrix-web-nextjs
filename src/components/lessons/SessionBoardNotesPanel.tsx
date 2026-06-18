"use client";

import * as React from "react";
import {
  BookOpen,
  Check,
  ClipboardCopy,
  Loader2,
  NotebookPen,
  Pencil,
  RefreshCw,
  Save,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  notebookNotesPublished?: boolean;
  canWrite: boolean;
  leoEnabled: boolean;
  /** Called after notes are saved so the parent can update state */
  onSaved?: (notes: BoardNotes, notebookNotesPublished: boolean) => void;
};

async function saveNotebookNotes(
  sessionId: string,
  contentHtml: string,
  aiGenerated: boolean,
): Promise<{ boardNotes: BoardNotes; notebookNotesPublished: boolean }> {
  const res = await fetch(`/api/teacher/lesson-sessions/${sessionId}/board-notes`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentHtml, aiGenerated }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error ?? "Failed to save notebook notes");
  }
  return json.data as { boardNotes: BoardNotes; notebookNotesPublished: boolean };
}

async function setNotebookNotesPublished(
  sessionId: string,
  notebookNotesPublished: boolean,
): Promise<{ boardNotes: BoardNotes | null; notebookNotesPublished: boolean }> {
  const res = await fetch(`/api/teacher/lesson-sessions/${sessionId}/board-notes`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notebookNotesPublished }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error ?? "Failed to update sharing");
  }
  return json.data as { boardNotes: BoardNotes | null; notebookNotesPublished: boolean };
}

export function SessionBoardNotesPanel({
  sessionId,
  initialNotes,
  notebookNotesPublished: initialPublished = false,
  canWrite,
  leoEnabled,
  onSaved,
}: Props) {
  const busyToast = useBusyToast();
  const generateBoardNotes = useGenerateBoardNotes();

  const [notes, setNotes] = React.useState<BoardNotes | null>(initialNotes ?? null);
  const [published, setPublished] = React.useState(initialPublished);
  const [editMode, setEditMode] = React.useState(false);
  const [editHtml, setEditHtml] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (initialNotes) setNotes(initialNotes);
  }, [initialNotes]);

  React.useEffect(() => {
    setPublished(initialPublished);
  }, [initialPublished]);

  const handleGenerate = async () => {
    const generated = await busyToast.promise(
      generateBoardNotes.mutateAsync({ sessionId }),
      {
        loading: "Leo is writing notebook notes…",
        success: "Notebook notes generated",
        error: (e) => (e instanceof Error ? e.message : "Generation failed"),
      },
    );
    setSaving(true);
    try {
      const saved = await saveNotebookNotes(sessionId, generated.contentHtml, true);
      setNotes(saved.boardNotes);
      setPublished(saved.notebookNotesPublished);
      onSaved?.(saved.boardNotes, saved.notebookNotesPublished);
      busyToast.success("Notebook notes saved");
    } catch (e) {
      busyToast.error(e instanceof Error ? e.message : "Failed to save notebook notes");
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
      const saved = await saveNotebookNotes(sessionId, editHtml, false);
      setNotes(saved.boardNotes);
      setPublished(saved.notebookNotesPublished);
      onSaved?.(saved.boardNotes, saved.notebookNotesPublished);
      setEditMode(false);
      busyToast.success("Notebook notes updated");
    } catch (e) {
      busyToast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handlePublishToggle = async (checked: boolean) => {
    try {
      const result = await busyToast.promise(
        setNotebookNotesPublished(sessionId, checked),
        {
          loading: checked ? "Sharing with students…" : "Hiding from students…",
          success: checked
            ? "Notebook notes will appear for students after you teach"
            : "Notebook notes hidden from students",
          error: (e) => (e instanceof Error ? e.message : "Failed to update"),
        },
      );
      setPublished(result.notebookNotesPublished);
      if (result.boardNotes) setNotes(result.boardNotes);
      onSaved?.(result.boardNotes ?? notes!, result.notebookNotesPublished);
    } catch {
      // toast handled
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
      <div className="flex flex-wrap items-center gap-2">
        {leoEnabled && canWrite ? (
          <Button
            type="button"
            disabled={isBusy}
            onClick={() => void handleGenerate()}
            className={cn(
              "bg-violet-500/20 text-violet-100 hover:bg-violet-500/30",
              notes ? "h-auto px-3 py-1.5 text-xs" : "",
            )}
          >
            {isBusy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {notes ? "Regenerate with Leo" : "Generate with Leo"}
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
              className="h-auto bg-teal-500/25 px-3 py-1.5 text-xs text-teal-100 hover:bg-teal-500/35"
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

      {notes && canWrite && !editMode ? (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-teal-400/20 bg-teal-500/8 px-4 py-3">
          <div>
            <Label className="flex items-center gap-2 text-white/85">
              <NotebookPen className="h-4 w-4 text-teal-300" />
              Share with students
            </Label>
            <p className="mt-0.5 text-xs text-white/45">
              Students see these notes in EduSentrix Learn and their lesson view after you teach
              this session.
            </p>
          </div>
          <Switch checked={published} onCheckedChange={(v) => void handlePublishToggle(v)} />
        </div>
      ) : null}

      {editMode ? (
        <div className="space-y-2">
          <p className="text-xs text-white/40">
            Structured notes students can copy into their exercise books. Use &lt;h3&gt;, lists, and
            &lt;strong&gt; for key terms.
          </p>
          <textarea
            value={editHtml}
            onChange={(e) => setEditHtml(e.target.value)}
            className="h-96 w-full rounded-xl border border-white/10 bg-white/5 p-4 font-mono text-sm text-white/80 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
          />
        </div>
      ) : notes ? (
        <div className="rounded-xl border border-white/10 bg-black/20 p-5">
          {notes.aiGenerated ? (
            <p className="mb-3 flex items-center gap-1.5 text-xs text-violet-300/70">
              <Sparkles className="h-3 w-3" />
              Leo-generated · Copy-friendly revision notes
              {published ? " · Shared with students after teaching" : ""}
            </p>
          ) : published ? (
            <p className="mb-3 text-xs text-teal-300/70">Shared with students after teaching</p>
          ) : null}
          <div
            className="prose prose-invert max-w-none prose-h3:text-sm prose-h3:font-semibold prose-h3:text-white/90 prose-p:text-sm prose-p:text-white/75 prose-li:text-sm prose-li:text-white/75 prose-strong:text-white"
            dangerouslySetInnerHTML={{ __html: notes.contentHtml }}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/3 py-10 text-center">
          <BookOpen className="h-7 w-7 text-white/20" />
          <p className="text-sm text-white/50">No notebook notes yet.</p>
          {leoEnabled && canWrite ? (
            <p className="text-xs text-white/35">
              Generate structured notes students can copy into their exercise books — for the board
              and for revision after class.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
