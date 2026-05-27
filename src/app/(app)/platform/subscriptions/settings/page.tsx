"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, PlayCircle, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { glassPanelClass, glassInsetClass, glassPrimaryButtonClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";

export default function SubscriptionSettingsPage() {
  const [running, setRunning] = React.useState(false);
  const [dryRun, setDryRun] = React.useState(true);
  const [autoSuspend, setAutoSuspend] = React.useState(false);
  const [suspendHours, setSuspendHours] = React.useState("72");
  const [lastResult, setLastResult] = React.useState<{
    total: number;
    summary: Record<string, number>;
    dryRun: boolean;
  } | null>(null);

  async function runLifecycle() {
    if (running) return;
    setRunning(true);
    try {
      const res = await fetch("/api/platform/subscriptions/lifecycle-advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dryRun,
          autoSuspend,
          suspendAfterHours: parseInt(suspendHours, 10) || 72,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setLastResult({ total: json.total, summary: json.summary, dryRun: json.dryRun });
        toast.success(json.dryRun ? `Dry run: ${json.total} transitions detected.` : `Applied ${json.total} lifecycle transitions.`);
      } else {
        toast.error("Failed to run lifecycle advance.");
      }
    } catch { toast.error("Network error."); }
    finally { setRunning(false); }
  }

  return (
    <div className="space-y-5 p-2 md:p-4">
      <div>
        <Link href="/platform/subscriptions" className="mb-1 flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70">
          <ChevronLeft className="h-3 w-3" /> Subscriptions
        </Link>
        <h1 className="text-xl font-semibold text-white">Subscription settings</h1>
        <p className="text-xs text-white/40">Global defaults and lifecycle automation controls.</p>
      </div>

      {/* Lifecycle automation */}
      <div className={cn(glassPanelClass, "px-5 py-5")}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
        <div className="mb-4 flex items-center gap-2">
          <PlayCircle className="h-4 w-4 text-white/40" />
          <p className="text-sm font-semibold text-white/80">Lifecycle automation</p>
        </div>
        <p className="mb-4 text-xs text-white/40">
          Advance subscriptions through their lifecycle: active → grace → restricted read-only → suspended.
          Use dry-run to preview before applying.
        </p>

        <div className={cn(glassInsetClass, "mb-4 flex flex-wrap items-center gap-4 px-4 py-3")}>
          <label className="flex items-center gap-2 text-xs text-white/60">
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} className="accent-amber-400" />
            Dry run (preview only)
          </label>
          <label className="flex items-center gap-2 text-xs text-white/60">
            <input type="checkbox" checked={autoSuspend} onChange={(e) => setAutoSuspend(e.target.checked)} className="accent-rose-400" />
            <ShieldAlert className="h-3.5 w-3.5 text-rose-300/70" />
            Auto-suspend read-only after
          </label>
          {autoSuspend && (
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="24"
                max="8760"
                value={suspendHours}
                onChange={(e) => setSuspendHours(e.target.value)}
                className="w-16 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none"
              />
              <span className="text-xs text-white/40">hours</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={runLifecycle}
          disabled={running}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium",
            dryRun
              ? "border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
              : glassPrimaryButtonClass,
            running && "opacity-50 cursor-not-allowed"
          )}
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
          {dryRun ? "Preview" : "Apply"} lifecycle advance
        </button>

        {lastResult && (
          <div className={cn(glassInsetClass, "mt-4 px-4 py-3")}>
            <p className="text-xs font-semibold text-white/60 mb-2">
              {lastResult.dryRun ? "Preview result" : "Applied result"} — {lastResult.total} transition{lastResult.total !== 1 ? "s" : ""}
            </p>
            {Object.keys(lastResult.summary).length === 0 ? (
              <p className="text-xs text-white/30">No subscriptions required advancement.</p>
            ) : (
              Object.entries(lastResult.summary).map(([t, c]) => (
                <div key={t} className="flex items-center justify-between text-xs text-white/50 py-0.5">
                  <span>{t}</span>
                  <span className="font-mono">{c}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
