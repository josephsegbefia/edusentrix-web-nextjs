// src/components/community/CampaignCard.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Users, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/fees/money";
import { CampaignListItemDTO, CampaignStatus } from "@/hooks/admin/useFundraisingCampaigns";

// ============================================================================
// Types
// ============================================================================

interface CampaignCardProps {
  campaign: CampaignListItemDTO;
  href?: string;
  className?: string;
  showProgress?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_STYLES: Record<CampaignStatus, string> = {
  draft: "border-slate-500/30 bg-slate-500/10 text-slate-200",
  pending_approval: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  approved: "border-blue-500/30 bg-blue-500/10 text-blue-200",
  live: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  paused: "border-orange-500/30 bg-orange-500/10 text-orange-200",
  closed: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  reconciled: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
  archived: "border-slate-600/30 bg-slate-600/10 text-slate-400",
};

const CATEGORY_LABELS: Record<string, string> = {
  school_project: "School Project",
  emergency: "Emergency",
  pta_drive: "PTA Drive",
  student_cause: "Student Cause",
  other: "Other",
};

// ============================================================================
// Main Component
// ============================================================================

export default function CampaignCard({
  campaign,
  href,
  className,
  showProgress = true,
}: CampaignCardProps) {
  const defaultHref = `/admin/community/fundraising/${campaign.id}`;

  const content = (
    <div
      className={cn(
        "group rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:border-white/20 hover:bg-white/10",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="truncate font-medium text-white">{campaign.title}</h4>
            <Badge className={cn("shrink-0 text-xs", STATUS_STYLES[campaign.status])}>
              {campaign.status.replaceAll("_", " ")}
            </Badge>
          </div>
          {campaign.summary && (
            <p className="mt-1 line-clamp-2 text-sm text-white/50">
              {campaign.summary}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/50">
            <span className="flex items-center gap-1">
              <Target className="h-3.5 w-3.5" />
              {CATEGORY_LABELS[campaign.category] || campaign.category}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {campaign.donorCount} donor{campaign.donorCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-white/30 transition-transform group-hover:translate-x-1 group-hover:text-white/60" />
      </div>

      {showProgress && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/50">
              {formatMoney(campaign.raisedAmountMinor, campaign.currency)} raised
            </span>
            <span className="font-medium text-emerald-400">
              {campaign.progressPercent}%
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.min(campaign.progressPercent, 100)}%` }}
            />
          </div>
          <div className="mt-1 text-xs text-white/40">
            Goal: {formatMoney(campaign.goalAmountMinor, campaign.currency)}
          </div>
        </div>
      )}
    </div>
  );

  return <Link href={href || defaultHref}>{content}</Link>;
}
