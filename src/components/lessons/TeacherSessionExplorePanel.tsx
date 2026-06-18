"use client";

import * as React from "react";
import { Compass, Eye, Globe, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBusyToast } from "@/hooks/useBusyToast";
import { TeacherSessionExploreReviewModal } from "@/components/lessons/TeacherSessionExploreReviewModal";
import { glassInsetClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";

type ExploreStatus = {
  sessionId: string;
  adventureId: string | null;
  generationKey: string | null;
  status: "not_started" | "generating" | "ready_for_review" | "published" | "failed";
  title: string | null;
  introPreview: string | null;
  estimatedMinutes: number | null;
  message: string;
};

type Props = {
  sessionId: string;
  classGroupId?: string | null;
  canWrite: boolean;
  leoEnabled: boolean;
};

function exploreUrl(sessionId: string, classGroupId?: string | null) {
  const base = `/api/teacher/lesson-sessions/${sessionId}/explore`;
  if (!classGroupId) return base;
  return `${base}?classGroupId=${encodeURIComponent(classGroupId)}`;
}

async function readJsonResponse(res: Response) {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    if (res.status === 401 || res.redirected) {
      throw new Error("Your teacher session has expired. Please sign in again.");
    }
    throw new Error("The server returned an unexpected response. Please refresh and try again.");
  }
  return res.json();
}

export function TeacherSessionExplorePanel({
  sessionId,
  classGroupId,
  canWrite,
  leoEnabled,
}: Props) {
  const busyToast = useBusyToast();
  const [status, setStatus] = React.useState<ExploreStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [working, setWorking] = React.useState(false);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const busyToastRef = React.useRef(busyToast);

  React.useEffect(() => {
    busyToastRef.current = busyToast;
  }, [busyToast]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(exploreUrl(sessionId, classGroupId), {
        cache: "no-store",
        credentials: "include",
      });
      const json = await readJsonResponse(res);
      if (res.status === 401) {
        busyToastRef.current.error("Your teacher session has expired. Please sign in again.");
        return;
      }
      if (json.success) setStatus(json.data);
    } catch (error) {
      busyToastRef.current.error(
        error instanceof Error ? error.message : "Failed to load Explore status.",
      );
    } finally {
      setLoading(false);
    }
  }, [sessionId, classGroupId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function generate() {
    if (!canWrite || working) return;
    setWorking(true);
    try {
      await busyToast.promise(
        fetch(exploreUrl(sessionId, classGroupId), {
          method: "POST",
          credentials: "include",
        }).then(
          async (res) => {
            const json = await readJsonResponse(res);
            if (!res.ok || !json.success) {
              throw new Error(
                res.status === 401
                  ? "Your teacher session has expired. Please sign in again."
                  : json.error || "Generation failed",
              );
            }
            return json.data as ExploreStatus;
          },
        ),
        {
          loading: "Leo is building your Explore mission…",
          success: "Explore mission ready for review.",
          error: (e) => (e instanceof Error ? e.message : "Generation failed"),
        },
      );
      await load();
      setReviewOpen(true);
    } finally {
      setWorking(false);
    }
  }

  async function publish() {
    if (!canWrite || working) return;
    setWorking(true);
    try {
      await busyToast.promise(
        fetch(exploreUrl(sessionId, classGroupId), {
          method: "PATCH",
          credentials: "include",
        }).then(
          async (res) => {
            const json = await readJsonResponse(res);
            if (!res.ok || !json.success) {
              throw new Error(
                res.status === 401
                  ? "Your teacher session has expired. Please sign in again."
                  : json.error || "Publish failed",
              );
            }
            return json.data as ExploreStatus;
          },
        ),
        {
          loading: "Publishing Explore to students…",
          success: "Explore published. Every student sees the same mission.",
          error: (e) => (e instanceof Error ? e.message : "Publish failed"),
        },
      );
      await load();
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <div className={cn(glassInsetClass, "flex items-center gap-2 px-4 py-6 text-sm text-white/50")}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading Explore status…
      </div>
    );
  }

  const current = status;
  const isPublished = current?.status === "published";
  const isReady = current?.status === "ready_for_review";
  const isGenerating = current?.status === "generating";
  const canReview = Boolean(current?.adventureId && (isReady || isPublished));

  return (
    <>
      <TeacherSessionExploreReviewModal
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        sessionId={sessionId}
        classGroupId={classGroupId}
        canWrite={canWrite}
        onSaved={() => void load()}
      />
      <div className={cn(glassInsetClass, "space-y-4 px-4 py-4")}>
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-violet-400/20 bg-violet-500/10 p-2">
          <Compass className="h-5 w-5 text-violet-200" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-white">Explore with Leo</p>
          <p className="mt-1 text-sm text-white/55">
            Generate a safe, age-appropriate mission that goes beyond today&apos;s lesson. Students
            all see the same adventure after you publish.
          </p>
        </div>
      </div>

      <p className="text-sm text-white/60">{current?.message}</p>

      {current?.title ? (
        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
          <p className="font-medium text-white">{current.title}</p>
          {current.introPreview ? (
            <p className="mt-1 text-sm text-white/50">{current.introPreview}</p>
          ) : null}
          {current.estimatedMinutes ? (
            <p className="mt-2 text-xs text-white/35">About {current.estimatedMinutes} minutes</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canReview ? (
          <Button
            type="button"
            disabled={working}
            onClick={() => setReviewOpen(true)}
            className="rounded-xl border border-white/15 bg-white/5 text-white hover:bg-white/10"
          >
            <Eye className="mr-2 h-4 w-4" />
            Review & edit
          </Button>
        ) : null}

        {canWrite && leoEnabled && !isPublished && !isGenerating ? (
          <Button
            type="button"
            disabled={working}
            onClick={() => void generate()}
            className="rounded-xl bg-violet-500/20 text-violet-100 hover:bg-violet-500/30"
          >
            {working ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {isReady || current?.status === "failed" ? "Regenerate with Leo" : "Generate with Leo"}
          </Button>
        ) : null}

        {canWrite && isReady ? (
          <Button
            type="button"
            disabled={working}
            onClick={() => void publish()}
            className="rounded-xl bg-teal-400 text-slate-950 hover:bg-teal-300"
          >
            {working ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Globe className="mr-2 h-4 w-4" />
            )}
            Publish to Learn
          </Button>
        ) : null}

        {isPublished && current?.adventureId ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-100">
            Published to students
          </span>
        ) : null}
      </div>

      {!leoEnabled ? (
        <p className="text-xs text-amber-100/70">Leo is disabled for this school.</p>
      ) : null}
      </div>
    </>
  );
}
