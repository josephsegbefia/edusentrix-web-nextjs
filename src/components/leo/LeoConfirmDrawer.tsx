"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import type { LeoActionPreviewDTO } from "@/lib/leo/types";

type LeoConfirmDrawerProps = {
  preview: LeoActionPreviewDTO | null;
  onConfirm: () => void;
  onCancel: () => void;
  isExecuting?: boolean;
};

export function LeoConfirmDrawer({
  preview,
  onConfirm,
  onCancel,
  isExecuting = false,
}: LeoConfirmDrawerProps) {
  if (!preview) return null;

  return (
    <div className="border-t border-white/10 bg-slate-950/98 p-3">
      <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3">
        <div className="mb-3 flex items-start gap-2 text-amber-50">
          <ShieldCheck className="mt-0.5 h-4 w-4 text-amber-200" />
          <div>
            <p className="text-sm font-semibold">Confirm Leo action</p>
            <p className="text-xs text-amber-50/65">
              Leo will only run this after your confirmation. The execution will be audited.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isExecuting}
            className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-white/65 hover:bg-white/10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isExecuting}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-amber-200 disabled:opacity-50"
          >
            {isExecuting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Confirm and run
          </button>
        </div>
      </div>
    </div>
  );
}
