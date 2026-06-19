"use client";

import * as React from "react";
import {
  BookOpen,
  CheckCircle2,
  CircleDashed,
  Compass,
  Eye,
  Layers,
  Loader2,
  Lock,
  Sparkles,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type {
  LearnPackageItemId,
  LearnPackageItemStatus,
  TeacherSessionLearnPackage,
} from "@/lib/lessons/learn-package-readiness";
import { TeacherSessionLearnPreviewModal } from "@/components/lessons/TeacherSessionLearnPreviewModal";

const ITEM_ICONS: Record<LearnPackageItemId, React.ComponentType<{ className?: string }>> = {
  notebook: BookOpen,
  flashcards: Layers,
  explore: Compass,
  assignment: Sparkles,
  publish: CheckCircle2,
};

function statusTone(status: LearnPackageItemStatus) {
  if (status === "ready") return "text-emerald-300";
  if (status === "needs_action") return "text-amber-200";
  if (status === "locked") return "text-white/35";
  if (status === "optional") return "text-sky-200/80";
  return "text-white/45";
}

function StatusIcon({ status }: { status: LearnPackageItemStatus }) {
  if (status === "ready") return <CheckCircle2 className="h-4 w-4 text-emerald-300" />;
  if (status === "locked") return <Lock className="h-4 w-4 text-white/35" />;
  if (status === "optional") return <CircleDashed className="h-4 w-4 text-sky-200/70" />;
  return <Sparkles className="h-4 w-4 text-amber-200" />;
}

type Props = {
  sessionId: string;
  classGroupId?: string | null;
  classLabel: string;
  canWrite: boolean;
  learnTeacherPriority: boolean;
  onPriorityChange?: (value: boolean) => void;
  prioritySaving?: boolean;
};

export function TeacherSessionLearnPackageSummary({
  sessionId,
  classGroupId,
  classLabel,
  canWrite,
  learnTeacherPriority,
  onPriorityChange,
  prioritySaving,
}: Props) {
  const [packageData, setPackageData] = React.useState<TeacherSessionLearnPackage | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (classGroupId) params.set("classGroupId", classGroupId);
      const qs = params.toString();
      const res = await fetch(
        `/api/teacher/lesson-sessions/${sessionId}/learn-package${qs ? `?${qs}` : ""}`,
        { cache: "no-store", credentials: "include" },
      );
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        setPackageData(json.data as TeacherSessionLearnPackage);
      }
    } finally {
      setLoading(false);
    }
  }, [classGroupId, sessionId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/50">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking EduSentrix Learn package…
      </div>
    );
  }

  if (!packageData) return null;

  return (
    <>
      <TeacherSessionLearnPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        sessionTitle={packageData.sessionTitle}
        classLabel={classLabel}
        steps={packageData.journeySteps}
      />

      <div className="space-y-4 rounded-xl border border-sky-400/20 bg-linear-to-br from-sky-500/10 via-slate-950/20 to-transparent p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">{packageData.headline}</p>
            <p className="text-xs text-white/55">{packageData.message}</p>
            <p className="text-[11px] text-white/40">
              {packageData.readyCount} of {packageData.totalCount} Learn items ready for students
            </p>
          </div>
          {packageData.studentPreviewAvailable ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-white/15 bg-white/5 text-white hover:bg-white/10"
              onClick={() => setPreviewOpen(true)}
            >
              <Eye className="mr-2 h-4 w-4" />
              Preview student journey
            </Button>
          ) : null}
        </div>

        <ul className="grid gap-2 sm:grid-cols-2">
          {packageData.items.map((item) => {
            const Icon = ITEM_ICONS[item.id];
            return (
              <li
                key={item.id}
                className="flex items-start gap-2 rounded-lg border border-white/8 bg-black/20 px-3 py-2.5"
              >
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", statusTone(item.status))} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-white/85">{item.label}</p>
                    <StatusIcon status={item.status} />
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-white/50">{item.message}</p>
                </div>
              </li>
            );
          })}
        </ul>

        {canWrite ? (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="flex items-start gap-2">
              <Star className="mt-0.5 h-4 w-4 text-amber-300" />
              <div>
                <Label className="text-white/85">Priority for Learn</Label>
                <p className="text-xs text-white/45">
                  Gently boosts this lesson in students&apos; Today&apos;s Journey when enabled.
                </p>
              </div>
            </div>
            <Switch
              checked={learnTeacherPriority}
              disabled={prioritySaving}
              onCheckedChange={(checked) => onPriorityChange?.(checked)}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
