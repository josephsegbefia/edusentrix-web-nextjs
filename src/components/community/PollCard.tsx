// src/components/community/PollCard.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { ArrowRight, Clock, Users, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PollListItemDTO, PollStatus } from "@/hooks/admin/useCommunityPolls";
import PollAudiencePill from "./PollAudiencePill";

// ============================================================================
// Types
// ============================================================================

interface PollCardProps {
  poll: PollListItemDTO;
  href?: string;
  className?: string;
  showAudience?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_STYLES: Record<PollStatus, string> = {
  draft: "border-slate-500/30 bg-slate-500/10 text-slate-200",
  pending_approval: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  approved: "border-blue-500/30 bg-blue-500/10 text-blue-200",
  live: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  closed: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  archived: "border-slate-600/30 bg-slate-600/10 text-slate-400",
};

// ============================================================================
// Main Component
// ============================================================================

export default function PollCard({
  poll,
  href,
  className,
  showAudience = true,
}: PollCardProps) {
  const defaultHref = `/admin/community/polls/${poll.id}`;

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
            <h4 className="truncate font-medium text-white">{poll.title}</h4>
            <Badge className={cn("shrink-0 text-xs", STATUS_STYLES[poll.status])}>
              {poll.status.replaceAll("_", " ")}
            </Badge>
          </div>
          {poll.description && (
            <p className="mt-1 line-clamp-2 text-sm text-white/50">
              {poll.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/50">
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              {poll.questionCount} question{poll.questionCount !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {poll.totalVotes} vote{poll.totalVotes !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatDistanceToNow(new Date(poll.createdAt), { addSuffix: true })}
            </span>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-white/30 transition-transform group-hover:translate-x-1 group-hover:text-white/60" />
      </div>

      {showAudience && (
        <div className="mt-3 flex items-center gap-2">
          <PollAudiencePill
            scope={poll.audience.scope}
            gradeCount={poll.audience.gradeIds?.length}
            classCount={poll.audience.classGroupIds?.length}
            size="sm"
          />
          {poll.participationRate > 0 && (
            <span className="text-xs text-white/40">
              {poll.participationRate.toFixed(1)}% participation
            </span>
          )}
        </div>
      )}
    </div>
  );

  return <Link href={href || defaultHref}>{content}</Link>;
}
