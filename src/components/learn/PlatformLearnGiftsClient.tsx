"use client";

import * as React from "react";
import { Ban, Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { glassInsetClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";

type GiftRow = {
  id: string;
  schoolName: string;
  studentName: string;
  status: string;
  expiresAt: string | null;
  note: string | null;
};

type ApiResponse =
  | { success: true; data: { gifts: GiftRow[] } }
  | { success: false; error: string };

function shortDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-GH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function PlatformLearnGiftsClient() {
  const [gifts, setGifts] = React.useState<GiftRow[]>([]);
  const [studentId, setStudentId] = React.useState("");
  const [note, setNote] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [workingId, setWorkingId] = React.useState<string | null>(null);
  const { confirm, confirmationDialog } = useConfirmationDialog();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/platform/learn/gifts", { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.success ? "Failed to load gifts." : payload.error);
      }
      setGifts(payload.data.gifts);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load gifts.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function createGift() {
    setSaving(true);
    try {
      const response = await fetch("/api/platform/learn/gifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, note }),
      });
      const payload = (await response.json()) as
        | { success: true }
        | { success: false; error: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.success ? "Failed to gift access." : payload.error);
      }
      toast.success("Learn access gifted");
      setStudentId("");
      setNote("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to gift access.");
    } finally {
      setSaving(false);
    }
  }

  async function revokeGift(gift: GiftRow) {
    const result = await confirm({
      title: "Revoke Learn gift?",
      description:
        "This will revoke the platform-gifted Learn access. It will not disable the student's Learn account.",
      confirmLabel: "Revoke gift",
      intent: "destructive",
    });
    if (result !== "confirm") return;

    setWorkingId(gift.id);
    try {
      const response = await fetch(`/api/platform/learn/gifts/${gift.id}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Revoked by platform operator" }),
      });
      const payload = (await response.json()) as
        | { success: true }
        | { success: false; error: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.success ? "Failed to revoke gift." : payload.error);
      }
      toast.success("Learn gift revoked");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke gift.");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="p-6 text-white md:p-8">
      <WorkspacePageShell>
        <WorkspacePageHeader
          title="Learn gifts"
          subtitle="Gift EduSentrix Learn access to eligible students with existing Learn accounts."
          icon={Gift}
          backHref="/platform/learn"
          backLabel="Back to Learn"
        />

        <GlassPanel className="p-6" glow="teal">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
                Student ID
              </span>
              <input
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-teal-300/50"
                placeholder="Mongo ObjectId"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
                Note
              </span>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-teal-300/50"
                placeholder="Optional reason"
              />
            </label>
            <Button
              disabled={!studentId.trim() || saving}
              onClick={createGift}
              className="self-end rounded-xl bg-teal-400 text-slate-950 hover:bg-teal-300 disabled:opacity-50"
            >
              {saving ? "Gifting..." : "Gift access"}
            </Button>
          </div>
        </GlassPanel>

        <GlassPanel className="p-6" glow="both">
          <h2 className="text-lg font-semibold text-white">Recent gifts</h2>
          <div className="mt-4 space-y-3">
            {loading ? (
              <p className="flex items-center gap-2 text-sm text-white/55">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading gifts...
              </p>
            ) : gifts.length ? (
              gifts.map((gift) => (
                <div
                  key={gift.id}
                  className={cn(
                    glassInsetClass,
                    "flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                  )}
                >
                  <div>
                    <p className="font-medium text-white">{gift.studentName}</p>
                    <p className="mt-1 text-sm text-white/50">{gift.schoolName}</p>
                  </div>
                  <div className="flex flex-col gap-3 sm:items-end">
                    <div className="text-sm sm:text-right">
                      <p className="capitalize text-white">{gift.status}</p>
                      <p className="mt-1 text-white/50">Expires {shortDate(gift.expiresAt)}</p>
                    </div>
                    {gift.status === "active" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={workingId === gift.id}
                        onClick={() => void revokeGift(gift)}
                        className="h-9 rounded-xl border-rose-300/25 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
                      >
                        {workingId === gift.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Ban className="mr-2 h-4 w-4" />
                        )}
                        Revoke
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/55">
                No platform gifted Learn access has been recorded yet.
              </p>
            )}
          </div>
        </GlassPanel>
      </WorkspacePageShell>
      {confirmationDialog}
    </div>
  );
}
