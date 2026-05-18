"use client";

import { BookOpen, Link2Off } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { cn } from "@/lib/utils";

export function SchemeDeleteLinkedNotesDialog({
  open,
  onOpenChange,
  schemeTitle,
  linkedLessonNoteCount,
  busy,
  onCancel,
  onUnlinkAndDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schemeTitle: string;
  linkedLessonNoteCount: number;
  busy?: boolean;
  onCancel: () => void;
  onUnlinkAndDelete: () => void;
}) {
  const noteLabel =
    linkedLessonNoteCount === 1 ? "1 lesson note is" : `${linkedLessonNoteCount} lesson notes are`;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Lesson notes are linked"
      description="This scheme cannot be deleted until you decide what to do with linked lesson notes."
      className="sm:max-w-lg"
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-amber-300/20 bg-linear-to-br from-amber-500/10 via-amber-950/20 to-black p-4">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-300/25 bg-amber-500/15">
              <BookOpen className="h-5 w-5 text-amber-100" />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-white">{schemeTitle}</p>
              <p className="text-sm leading-6 text-white/60">
                {noteLabel} still linked to this Scheme of Learning. The lesson notes themselves will
                stay in your school — only the scheme link will be removed.
              </p>
            </div>
          </div>
        </div>

        <ul className="space-y-2 text-sm text-white/55">
          <li className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300/80" />
            <span>Unlink & delete removes scheme rows, review history, and scheme links from lesson notes.</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/30" />
            <span>Cancel keeps everything unchanged so you can review lesson notes first.</span>
          </li>
        </ul>

        <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-4">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onCancel}
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={onUnlinkAndDelete}
            className={cn(
              "gap-2 bg-rose-600 text-white hover:bg-rose-700",
              busy && "opacity-80",
            )}
          >
            <Link2Off className="h-4 w-4" />
            {busy ? "Deleting…" : "Unlink & delete"}
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}
