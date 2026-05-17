"use client";

import * as React from "react";
import { Clock, Loader2, LogOut, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type AssistedAccessState = {
  active: boolean;
  schoolId?: string;
  schoolName?: string;
  actorEmail?: string;
  reason?: string;
  expiresAt?: string;
};

export function AssistedAccessBanner() {
  const [session, setSession] = React.useState<AssistedAccessState | null>(null);
  const [ending, setEnding] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/platform/assisted-access/current", {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!cancelled && res.ok && json?.success) {
        setSession(json.data as AssistedAccessState);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function endSession() {
    try {
      setEnding(true);
      const res = await fetch("/api/platform/assisted-access/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "ended_from_admin_banner" }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to end assisted access");
      }
      window.location.href = json.data?.redirectTo || "/platform/schools";
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to end assisted access");
    } finally {
      setEnding(false);
    }
  }

  if (!session?.active) return null;

  return (
    <div className="sticky top-0 z-50 border-b border-amber-300/25 bg-slate-950/95 px-4 py-3 text-white shadow-2xl shadow-black/30 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-300/25 bg-amber-400/10">
            <ShieldAlert className="h-4 w-4 text-amber-200" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">
              Assisted school-admin access: {session.schoolName || "School"}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/60">
              <span className="truncate">Platform actor: {session.actorEmail}</span>
              {session.expiresAt ? (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Ends {new Date(session.expiresAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              ) : null}
              {session.reason ? <span className="truncate">Reason: {session.reason}</span> : null}
            </div>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-fit border-amber-300/30 bg-amber-300/10 text-amber-50 hover:bg-amber-300/20"
          disabled={ending}
          onClick={() => void endSession()}
        >
          {ending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
          Exit assisted access
        </Button>
      </div>
    </div>
  );
}
