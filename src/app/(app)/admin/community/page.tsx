// src/app/(app)/admin/community/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns/format";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import {
  ArrowRight,
  Clock,
  Heart,
  Loader2,
  MessageSquare,
  Plus,
  Target,
  TrendingUp,
  Users,
  Vote,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCommunityPolls, PollListItemDTO } from "@/hooks/admin/useCommunityPolls";
import { useFundraisingCampaigns, CampaignListItemDTO } from "@/hooks/admin/useFundraisingCampaigns";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/fees/money";

// ============================================================================
// Styles
// ============================================================================

const TONE_STYLES = {
  polls: {
    gradient: "from-violet-500/15 via-violet-500/5 to-transparent",
    iconBg: "bg-violet-500/20 border-violet-500/30",
    iconColor: "text-violet-300",
    badge: "border-violet-500/30 bg-violet-500/10 text-violet-200",
  },
  fundraising: {
    gradient: "from-emerald-500/15 via-emerald-500/5 to-transparent",
    iconBg: "bg-emerald-500/20 border-emerald-500/30",
    iconColor: "text-emerald-300",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  },
  pending: {
    gradient: "from-amber-500/15 via-amber-500/5 to-transparent",
    iconBg: "bg-amber-500/20 border-amber-500/30",
    iconColor: "text-amber-200",
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  },
};

const STATUS_STYLES: Record<string, string> = {
  draft: "border-slate-500/30 bg-slate-500/10 text-slate-200",
  pending_approval: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  approved: "border-blue-500/30 bg-blue-500/10 text-blue-200",
  live: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  paused: "border-orange-500/30 bg-orange-500/10 text-orange-200",
  closed: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  reconciled: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
  archived: "border-slate-600/30 bg-slate-600/10 text-slate-400",
};

// ============================================================================
// Helpers
// ============================================================================

function formatDateShort(value: string | null | undefined) {
  if (!value) return "—";
  return format(new Date(value), "MMM d");
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "";
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

// ============================================================================
// Stats Card Component
// ============================================================================

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  tone: keyof typeof TONE_STYLES;
  href?: string;
}

function StatsCard({ title, value, subtitle, icon: Icon, tone, href }: StatsCardProps) {
  const styles = TONE_STYLES[tone];

  const content = (
    <Card className={cn(
      "relative overflow-hidden border-white/10 bg-white/5 transition-all hover:border-white/20",
      href && "cursor-pointer"
    )}>
      <div className={cn("absolute inset-0 bg-linear-to-br opacity-60", styles.gradient)} />
      <CardContent className="relative p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-white/60">{title}</p>
            <p className="mt-1 text-3xl font-bold text-white">{value}</p>
            {subtitle && (
              <p className="mt-1 text-sm text-white/50">{subtitle}</p>
            )}
          </div>
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl border", styles.iconBg)}>
            <Icon className={cn("h-6 w-6", styles.iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

// ============================================================================
// Poll Card Component
// ============================================================================

function PollCard({ poll }: { poll: PollListItemDTO }) {
  return (
    <Link href={`/admin/community/polls/${poll.id}`}>
      <div className="group rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:border-white/20 hover:bg-white/10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="truncate font-medium text-white">{poll.title}</h4>
              <Badge className={cn("shrink-0 text-xs", STATUS_STYLES[poll.status])}>
                {poll.status.replaceAll("_", " ")}
              </Badge>
            </div>
            <p className="mt-1 truncate text-sm text-white/50">
              {poll.questionCount} question{poll.questionCount !== 1 ? "s" : ""} · {poll.audience.scope} scope
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-white/30 transition-transform group-hover:translate-x-1 group-hover:text-white/60" />
        </div>
        <div className="mt-3 flex items-center gap-4 text-sm text-white/50">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {poll.totalVotes} votes
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatRelativeTime(poll.createdAt)}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ============================================================================
// Campaign Card Component
// ============================================================================

function CampaignCard({ campaign }: { campaign: CampaignListItemDTO }) {
  return (
    <Link href={`/admin/community/fundraising/${campaign.id}`}>
      <div className="group rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:border-white/20 hover:bg-white/10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="truncate font-medium text-white">{campaign.title}</h4>
              <Badge className={cn("shrink-0 text-xs", STATUS_STYLES[campaign.status])}>
                {campaign.status.replaceAll("_", " ")}
              </Badge>
            </div>
            <p className="mt-1 truncate text-sm text-white/50">
              {campaign.category.replaceAll("_", " ")} · {campaign.donorCount} donor{campaign.donorCount !== 1 ? "s" : ""}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-white/30 transition-transform group-hover:translate-x-1 group-hover:text-white/60" />
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/50">
              {formatMoney(campaign.raisedAmountMinor, campaign.currency)} raised
            </span>
            <span className="font-medium text-emerald-400">{campaign.progressPercent}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.min(campaign.progressPercent, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function CommunityHubPage() {
  const { data: pollsData, isLoading: pollsLoading } = useCommunityPolls({ limit: 10 });
  const { data: campaignsData, isLoading: campaignsLoading } = useFundraisingCampaigns({ limit: 10 });

  // Calculate stats
  const polls = pollsData?.data || [];
  const campaigns = campaignsData?.data || [];

  const livePolls = polls.filter((p) => p.status === "live").length;
  const pendingPolls = polls.filter((p) => p.approvalStatus === "pending").length;
  const liveCampaigns = campaigns.filter((c) => c.status === "live").length;
  const pendingCampaigns = campaigns.filter((c) => c.approvalStatus === "pending").length;

  const totalRaised = campaigns
    .filter((c) => ["live", "closed", "reconciled"].includes(c.status))
    .reduce((sum, c) => sum + (c.raisedAmountMinor || 0), 0);

  const needsAttention = pendingPolls + pendingCampaigns;

  const isLoading = pollsLoading || campaignsLoading;

  return (
    <div className="min-h-screen bg-[#0a0a0f] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Community Hub</h1>
          <p className="mt-1 text-white/60">
            Manage school-wide polls and fundraising campaigns
          </p>
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            <>
              {["sk1", "sk2", "sk3", "sk4"].map((key) => (
                <Skeleton key={key} className="h-32 rounded-xl bg-white/5" />
              ))}
            </>
          ) : (
            <>
              <StatsCard
                title="Active Polls"
                value={livePolls}
                subtitle={`${polls.length} total`}
                icon={Vote}
                tone="polls"
                href="/admin/community/polls"
              />
              <StatsCard
                title="Active Campaigns"
                value={liveCampaigns}
                subtitle={`${campaigns.length} total`}
                icon={Heart}
                tone="fundraising"
                href="/admin/community/fundraising"
              />
              <StatsCard
                title="Total Raised"
                value={formatMoney(totalRaised, "GHS")}
                subtitle={`${campaigns.reduce((sum, c) => sum + c.donorCount, 0)} donors`}
                icon={TrendingUp}
                tone="fundraising"
              />
              <StatsCard
                title="Needs Attention"
                value={needsAttention}
                subtitle="Pending approvals"
                icon={AlertCircle}
                tone="pending"
              />
            </>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mb-8 flex flex-wrap gap-3">
          <Link href="/admin/community/polls?create=1">
            <Button className="gap-2 border-violet-500/30 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20">
              <Plus className="h-4 w-4" />
              Create Poll
            </Button>
          </Link>
          <Link href="/admin/community/fundraising?create=1">
            <Button className="gap-2 border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20">
              <Plus className="h-4 w-4" />
              Create Campaign
            </Button>
          </Link>
        </div>

        {/* Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Polls */}
          <Card className="border-white/10 bg-white/5">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <Vote className="h-5 w-5 text-violet-400" />
                Recent Polls
              </CardTitle>
              <Link href="/admin/community/polls">
                <Button variant="ghost" size="sm" className="gap-1 text-white/60 hover:text-white">
                  View all
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {pollsLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
                </div>
              )}
              {!pollsLoading && polls.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <MessageSquare className="h-10 w-10 text-white/20" />
                  <p className="mt-2 text-sm text-white/50">No polls yet</p>
                  <Link href="/admin/community/polls?create=1">
                    <Button size="sm" className="mt-3 gap-1" variant="outline">
                      <Plus className="h-4 w-4" />
                      Create first poll
                    </Button>
                  </Link>
                </div>
              )}
              {!pollsLoading && polls.length > 0 && (
                polls.slice(0, 5).map((poll) => (
                  <PollCard key={poll.id} poll={poll} />
                ))
              )}
            </CardContent>
          </Card>

          {/* Recent Campaigns */}
          <Card className="border-white/10 bg-white/5">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <Heart className="h-5 w-5 text-emerald-400" />
                Active Campaigns
              </CardTitle>
              <Link href="/admin/community/fundraising">
                <Button variant="ghost" size="sm" className="gap-1 text-white/60 hover:text-white">
                  View all
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {campaignsLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
                </div>
              )}
              {!campaignsLoading && campaigns.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Target className="h-10 w-10 text-white/20" />
                  <p className="mt-2 text-sm text-white/50">No campaigns yet</p>
                  <Link href="/admin/community/fundraising?create=1">
                    <Button size="sm" className="mt-3 gap-1" variant="outline">
                      <Plus className="h-4 w-4" />
                      Create first campaign
                    </Button>
                  </Link>
                </div>
              )}
              {!campaignsLoading && campaigns.length > 0 && (
                campaigns.slice(0, 5).map((campaign) => (
                  <CampaignCard key={campaign.id} campaign={campaign} />
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
