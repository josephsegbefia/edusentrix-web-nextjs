"use client";

import { Layers, Sparkles } from "lucide-react";

export function BulkGrading() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/70">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <Layers className="h-4 w-4 text-indigo-300" />
        Bulk grading
      </div>
      <p className="mt-2 text-sm text-white/60">
        Quick batch grading tools are coming soon.
      </p>
      <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white/60">
        <Sparkles className="h-3.5 w-3.5" />
        In preview
      </div>
    </div>
  );
}
