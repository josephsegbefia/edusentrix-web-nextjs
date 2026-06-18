"use client";

import * as React from "react";
import { Expand } from "lucide-react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt: string;
  className?: string;
};

export function LessonIllustrationPreview({ src, alt, className }: Props) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group relative block overflow-hidden rounded-xl border border-white/10 bg-black/20",
          "cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50",
          className ?? "w-full max-w-[220px]",
        )}
        aria-label={`View larger: ${alt}`}
      >
        <div className="aspect-square w-full bg-slate-950/50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="h-full w-full object-contain" />
        </div>
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/35"
        >
          <span className="flex items-center gap-1 rounded-full border border-white/20 bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white/90 opacity-0 transition group-hover:opacity-100">
            <Expand className="h-3.5 w-3.5" />
            View larger
          </span>
        </span>
      </button>

      <ResponsiveModal
        open={open}
        onOpenChange={setOpen}
        title="Illustration preview"
        className="sm:max-w-5xl"
      >
        <div className="flex min-h-[50vh] items-center justify-center rounded-xl bg-black/30 p-2 sm:p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-[min(82vh,960px)] w-auto max-w-full rounded-lg object-contain shadow-2xl shadow-black/50"
          />
        </div>
      </ResponsiveModal>
    </>
  );
}
