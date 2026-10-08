"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

export default function TeacherModalShell({
  open,
  onClose,
  title,
  children,
}: Props) {
  React.useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      />
      <div className="relative z-10 flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-[860px] overflow-hidden rounded-2xl border border-(--ws-line) bg-(--ws-popover) text-(--ws-fg) shadow-[var(--ws-shadow)]">
          <div className="px-6 pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h1 className="text-lg font-semibold">{title}</h1>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-(--ws-fg-70) hover:bg-(--ws-fill-strong) hover:text-(--ws-fg)"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-5 h-px bg-(--ws-fill-strong)" />
          </div>
          <div className="max-h-[70vh] overflow-y-auto px-6 py-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
