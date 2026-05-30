"use client";

import * as React from "react";
import Link from "next/link";
import { Download, ExternalLink, FileText } from "lucide-react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Button } from "@/components/ui/button";
import { OfficialStatusBadge } from "@/components/admin/students/detail/OfficialStatusBadge";
import { buildReportStatusPanelModel } from "@/lib/academics/profile/report-status-panel-utils";
import {
  glassInsetClass,
  glassPrimaryButtonClass,
  glassSecondaryButtonClass,
} from "@/lib/ui/glass-surfaces";
import type { StudentAcademicProfileDTO } from "@/types/academics/student-academic-profile";
import { cn } from "@/lib/utils";

const ROW_TONE_CLASS: Record<string, string> = {
  success: "text-emerald-200",
  warning: "text-amber-200",
  error: "text-rose-200",
  neutral: "text-white/80",
};

type Props = {
  profile: StudentAcademicProfileDTO | null | undefined;
  /** When set (e.g. parent API download), uses click handler instead of direct href. */
  onDownloadReport?: () => void | Promise<void>;
  isDownloadingReport?: boolean;
};

function StatusRow({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4", glassInsetClass, "px-3 py-2")}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-white/45">
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-medium sm:max-w-[65%] sm:text-right",
          ROW_TONE_CLASS[tone] ?? ROW_TONE_CLASS.neutral
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function ReportStatusPanel({
  profile,
  onDownloadReport,
  isDownloadingReport = false,
}: Props) {
  const model = React.useMemo(
    () => (profile ? buildReportStatusPanelModel(profile) : null),
    [profile]
  );

  if (!model) {
    return null;
  }

  const { actions } = model;
  const showActions = actions.canDownload || actions.canView;

  return (
    <GlassPanel className="p-4 sm:p-5" glow="cyan">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-linear-to-br from-cyan-500/20 to-teal-500/20">
            <FileText className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-white">{model.title}</h3>
            <OfficialStatusBadge
              status={model.badgeStatus}
              isOfficial={profile?.reportStatus.isOfficial}
            />
          </div>
        </div>

        {showActions ? (
          <div className="flex flex-wrap items-center gap-2">
            {actions.canView && actions.viewHref ? (
              <Button
                asChild
                type="button"
                variant="outline"
                size="sm"
                className={glassSecondaryButtonClass}
              >
                <Link href={actions.viewHref}>
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  View report
                </Link>
              </Button>
            ) : null}
            {actions.canDownload && (actions.downloadUrl || onDownloadReport) ? (
              onDownloadReport ? (
                <Button
                  type="button"
                  size="sm"
                  className={glassPrimaryButtonClass}
                  disabled={isDownloadingReport}
                  onClick={() => void onDownloadReport()}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  {isDownloadingReport ? "Downloading…" : actions.downloadLabel}
                </Button>
              ) : actions.downloadUrl ? (
                <Button
                  asChild
                  type="button"
                  size="sm"
                  className={glassPrimaryButtonClass}
                >
                  <a
                    href={actions.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    {actions.downloadLabel}
                  </a>
                </Button>
              ) : null
            ) : null}
          </div>
        ) : null}
      </div>

      {model.parentMessage ? (
        <p className="mt-4 text-sm leading-relaxed text-white/70">{model.parentMessage}</p>
      ) : null}

      {model.showStaffDetails && model.rows.length > 0 ? (
        <div className="mt-4 space-y-2">
          {model.rows.map((row) => (
            <StatusRow
              key={row.label}
              label={row.label}
              value={row.value}
              tone={row.tone}
            />
          ))}
        </div>
      ) : null}

      {!model.showStaffDetails && !model.parentMessage && model.rows.length > 0 ? (
        <div className="mt-4 space-y-2">
          {model.rows.map((row) => (
            <StatusRow
              key={row.label}
              label={row.label}
              value={row.value}
              tone={row.tone}
            />
          ))}
        </div>
      ) : null}
    </GlassPanel>
  );
}

export function ReportStatusPanelSkeleton() {
  return (
    <GlassPanel className="p-5" glow="none">
      <div className="h-28 animate-pulse rounded-xl bg-white/5" />
    </GlassPanel>
  );
}
