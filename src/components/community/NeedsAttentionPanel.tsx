// src/components/community/NeedsAttentionPanel.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Vote, Heart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PollListItemDTO } from "@/hooks/admin/useCommunityPolls";
import { CampaignListItemDTO } from "@/hooks/admin/useFundraisingCampaigns";

// ============================================================================
// Types
// ============================================================================

interface NeedsAttentionPanelProps {
  pendingPolls: PollListItemDTO[];
  pendingCampaigns: CampaignListItemDTO[];
  className?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export default function NeedsAttentionPanel({
  pendingPolls,
  pendingCampaigns,
  className,
}: NeedsAttentionPanelProps) {
  const totalPending = pendingPolls.length + pendingCampaigns.length;

  if (totalPending === 0) {
    return null;
  }

  return (
    <Card className={cn("border-amber-500/20 bg-amber-500/5", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg text-white">
          <AlertCircle className="h-5 w-5 text-amber-400" />
          Needs Your Attention
          <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-200">
            {totalPending}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Pending Polls */}
        {pendingPolls.map((poll) => (
          <Link key={poll.id} href={`/admin/community/polls/${poll.id}`}>
            <div className="group flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3 transition-all hover:border-white/20 hover:bg-white/10">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 border border-violet-500/20">
                  <Vote className="h-4 w-4 text-violet-400" />
                </div>
                <div>
                  <p className="font-medium text-white">{poll.title}</p>
                  <p className="text-xs text-white/50">
                    Poll awaiting approval · {poll.questionCount} questions
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-200 text-xs">
                  Pending
                </Badge>
                <ArrowRight className="h-4 w-4 text-white/30 transition-transform group-hover:translate-x-1 group-hover:text-white/60" />
              </div>
            </div>
          </Link>
        ))}

        {/* Pending Campaigns */}
        {pendingCampaigns.map((campaign) => (
          <Link key={campaign.id} href={`/admin/community/fundraising/${campaign.id}`}>
            <div className="group flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3 transition-all hover:border-white/20 hover:bg-white/10">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <Heart className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <p className="font-medium text-white">{campaign.title}</p>
                  <p className="text-xs text-white/50">
                    Campaign awaiting approval · {campaign.category.replaceAll("_", " ")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-200 text-xs">
                  Pending
                </Badge>
                <ArrowRight className="h-4 w-4 text-white/30 transition-transform group-hover:translate-x-1 group-hover:text-white/60" />
              </div>
            </div>
          </Link>
        ))}

        {/* View All Link */}
        <div className="pt-2">
          <Button variant="ghost" className="w-full gap-2 text-amber-300 hover:text-amber-200 hover:bg-amber-500/10">
            View all pending items
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
