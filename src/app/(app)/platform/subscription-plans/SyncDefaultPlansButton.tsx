"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function SyncDefaultPlansButton({ className }: { className?: string }) {
  const router = useRouter();
  const [syncing, setSyncing] = React.useState(false);

  async function syncDefaults() {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/platform/subscription-plans/sync-defaults", {
        method: "POST",
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(typeof json.error === "string" ? json.error : "Failed to sync default plans.");
        return;
      }
      const rows = Array.isArray(json.data?.results) ? json.data.results : [];
      toast.success(`Synced ${rows.length || 4} default subscription plans.`);
      router.refresh();
    } catch {
      toast.error("Network error while syncing default plans.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <button
      type="button"
      onClick={syncDefaults}
      disabled={syncing}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
    >
      <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
      {syncing ? "Syncing..." : "Sync defaults"}
    </button>
  );
}
