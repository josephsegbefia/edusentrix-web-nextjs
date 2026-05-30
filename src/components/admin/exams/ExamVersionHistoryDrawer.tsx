"use client";

import * as React from "react";
import { History, Loader2 } from "lucide-react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  glassInsetClass,
  glassSecondaryButtonClass,
} from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import { useExamTimetableVersions } from "@/hooks/admin/useExamPublish";
import type { ExamTimetableVersionDTO } from "@/types/academics/exam-scheduling-engine";

type ExamVersionHistoryDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  sessionName: string;
};

const VERSION_STATUS_STYLES: Record<string, string> = {
  published: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  superseded: "border-white/10 bg-white/5 text-white/55",
  rolled_back: "border-amber-500/30 bg-amber-500/10 text-amber-100",
};

function formatPublishedAt(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function VersionRow({ version, isCurrent }: { version: ExamTimetableVersionDTO; isCurrent: boolean }) {
  const entryCount = version.snapshot.entries.length;
  const invigilatorCount = version.snapshot.invigilators.length;

  return (
    <div className={cn(glassInsetClass, "space-y-3 p-4")}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-white">Version {version.versionNumber}</p>
        <Badge variant="outline" className={VERSION_STATUS_STYLES[version.status]}>
          {version.status.replace("_", " ")}
        </Badge>
        {isCurrent ? (
          <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-100">
            Current
          </Badge>
        ) : null}
      </div>
      <p className="text-sm text-white/75">{version.changeSummary}</p>
      <div className="flex flex-wrap gap-3 text-xs text-white/50">
        <span>{formatPublishedAt(version.publishedAt)}</span>
        <span>{entryCount} papers</span>
        <span>{invigilatorCount} invigilator assignments</span>
      </div>
    </div>
  );
}

export function ExamVersionHistoryDrawer({
  open,
  onOpenChange,
  sessionId,
  sessionName,
}: ExamVersionHistoryDrawerProps) {
  const { data, isLoading, refetch, isFetching } = useExamTimetableVersions(sessionId, open);
  const versions = data?.data ?? [];
  const currentVersion = versions.find((version) => version.status === "published") ?? versions[0] ?? null;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Version history"
      description={`Published timetable versions for ${sessionName}.`}
    >
      {isLoading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-white/50">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading versions…
        </div>
      ) : versions.length === 0 ? (
        <div className={cn(glassInsetClass, "px-6 py-10 text-center")}>
          <History className="mx-auto h-8 w-8 text-white/35" />
          <p className="mt-3 text-sm text-white/60">
            No published versions yet. Publish the timetable to create the first snapshot.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {currentVersion ? (
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
              Current published version: v{currentVersion.versionNumber}
            </div>
          ) : null}
          {versions.map((version) => (
            <VersionRow
              key={version.id}
              version={version}
              isCurrent={currentVersion?.id === version.id}
            />
          ))}
        </div>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className={glassSecondaryButtonClass}
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          {isFetching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Refreshing…
            </>
          ) : (
            "Refresh"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          className={glassSecondaryButtonClass}
          onClick={() => onOpenChange(false)}
        >
          Close
        </Button>
      </div>
    </ResponsiveModal>
  );
}

export function getCurrentExamVersionLabel(
  versions: ExamTimetableVersionDTO[] | undefined
) {
  const current = versions?.find((version) => version.status === "published");
  if (!current) return null;
  return `v${current.versionNumber}`;
}
