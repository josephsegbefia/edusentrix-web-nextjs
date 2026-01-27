// src/app/(app)/admin/community/fundraising/[id]/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns/format";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Edit,
  Heart,
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  Target,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useFundraisingCampaign,
  useCampaignDonations,
  usePublishCampaign,
  usePauseCampaign,
  useCloseCampaign,
} from "@/hooks/admin/useFundraisingCampaigns";
import { useBusyToast } from "@/hooks/useBusyToast";
import { formatMoney } from "@/lib/fees/money";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ============================================================================
// Styles
// ============================================================================

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

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  paystack: "Paystack",
  mobile_money: "Mobile Money",
  bank_transfer: "Bank Transfer",
  cash: "Cash",
  cheque: "Cheque",
  stripe: "Stripe",
  other: "Other",
};

const CATEGORY_LABELS: Record<string, string> = {
  school_project: "School Project",
  emergency: "Emergency",
  pta_drive: "PTA Drive",
  student_cause: "Student Cause",
  other: "Other",
};

// ============================================================================
// Main Page
// ============================================================================

export default function CampaignDetailPage() {
  const params = useParams();
  const campaignId = params.id as string;

  const { data: campaign, isLoading: campaignLoading, isError: campaignError } = useFundraisingCampaign(campaignId);
  const { data: donationsData, isLoading: donationsLoading } = useCampaignDonations(campaignId, { limit: 10 });

  const publishMutation = usePublishCampaign();
  const pauseMutation = usePauseCampaign();
  const closeMutation = useCloseCampaign();
  const busyToast = useBusyToast();

  const handlePublish = async () => {
    busyToast.show("Publishing campaign...");
    try {
      await publishMutation.mutateAsync(campaignId);
      toast.success("Campaign published successfully");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to publish campaign");
    } finally {
      busyToast.hide();
    }
  };

  const handlePause = async () => {
    busyToast.show("Pausing campaign...");
    try {
      await pauseMutation.mutateAsync(campaignId);
      toast.success("Campaign paused");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to pause campaign");
    } finally {
      busyToast.hide();
    }
  };

  const handleClose = async () => {
    busyToast.show("Closing campaign...");
    try {
      await closeMutation.mutateAsync(campaignId);
      toast.success("Campaign closed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to close campaign");
    } finally {
      busyToast.hide();
    }
  };

  if (campaignLoading) {
    return (
      <div className="space-y-8">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 via-slate-950/95 to-black p-8 shadow-2xl">
          <Skeleton className="h-10 w-64 bg-white/10" />
          <Skeleton className="mt-2 h-4 w-48 bg-white/5" />
          <div className="mt-8 grid grid-cols-3 gap-4">
            <Skeleton className="h-24 rounded-2xl bg-white/5" />
            <Skeleton className="h-24 rounded-2xl bg-white/5" />
            <Skeleton className="h-24 rounded-2xl bg-white/5" />
          </div>
        </div>
        <Skeleton className="h-48 rounded-2xl bg-white/5" />
        <Skeleton className="h-64 rounded-2xl bg-white/5" />
      </div>
    );
  }

  if (campaignError || !campaign) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-rose-500/20 bg-rose-500/10">
          <XCircle className="h-10 w-10 text-rose-400" />
        </div>
        <div className="text-center">
          <p className="text-lg font-medium text-white/80">Campaign not found</p>
          <p className="mt-1 text-sm text-white/50">This campaign may have been deleted or doesn&apos;t exist</p>
        </div>
        <Link href="/admin/community/fundraising">
          <Button variant="outline" className="mt-2 gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
            Back to Campaigns
          </Button>
        </Link>
      </div>
    );
  }

  const donations = donationsData?.data || [];

  return (
    <div className="space-y-8">
      {/* ══════════════════════════════════════════════════════════════════════
          Premium Hero Header
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 via-slate-950/95 to-black p-8 shadow-2xl shadow-black/40">
        {/* Background decorations */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-transparent blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-gradient-to-tr from-teal-500/10 via-teal-500/5 to-transparent blur-3xl" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        <div className="relative z-10">
          {/* Top row */}
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <Link href="/admin/community/fundraising">
                <Button
                  variant="ghost"
                  size="icon"
                  className="mt-1 h-10 w-10 rounded-xl border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 shadow-lg shadow-emerald-500/10">
                    <Heart className="h-6 w-6 text-emerald-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h1 className="text-3xl font-bold tracking-tight text-white">{campaign.title}</h1>
                      <Badge className={cn("rounded-full text-xs font-medium", STATUS_STYLES[campaign.status])}>
                        {campaign.status.replaceAll("_", " ")}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-white/60">
                      <span>{CATEGORY_LABELS[campaign.category] || campaign.category}</span>
                      <span>·</span>
                      <span>Created {formatDistanceToNow(new Date(campaign.createdAt), { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-xl border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {(campaign.status === "draft" || campaign.status === "approved" || campaign.status === "paused") && (
                  <DropdownMenuItem onClick={handlePublish} className="text-emerald-400">
                    <Play className="mr-2 h-4 w-4" />
                    {campaign.status === "paused" ? "Resume" : "Publish"}
                  </DropdownMenuItem>
                )}
                {campaign.status === "live" && (
                  <>
                    <DropdownMenuItem onClick={handlePause} className="text-orange-400">
                      <Pause className="mr-2 h-4 w-4" />
                      Pause
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleClose} className="text-amber-400">
                      <XCircle className="mr-2 h-4 w-4" />
                      Close Campaign
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/admin/community/fundraising/${campaignId}/edit`}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Campaign
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Progress Section */}
          <div className="mt-8 rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Amount Raised</p>
                <p className="mt-1 text-4xl font-bold text-white">
                  {formatMoney(campaign.raisedAmountMinor, campaign.currency)}
                </p>
                <p className="mt-1 text-sm text-white/50">
                  of {formatMoney(campaign.goalAmountMinor, campaign.currency)} goal
                </p>
              </div>
              <div className="text-right">
                <p className="text-5xl font-bold text-emerald-400">{campaign.progressPercent}%</p>
                <p className="text-sm text-white/50">Complete</p>
              </div>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all"
                style={{ width: `${Math.min(campaign.progressPercent, 100)}%` }}
              />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-5 shadow-lg shadow-black/20 backdrop-blur">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent" />
              <div className="relative z-10 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-emerald-500/20">
                  <Users className="h-6 w-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{campaign.donorCount}</p>
                  <p className="text-xs font-medium uppercase tracking-wider text-white/50">Donors</p>
                </div>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-5 shadow-lg shadow-black/20 backdrop-blur">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent" />
              <div className="relative z-10 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-violet-500/20">
                  <TrendingUp className="h-6 w-6 text-violet-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {campaign.donorCount > 0
                      ? formatMoney(Math.round(campaign.raisedAmountMinor / campaign.donorCount), campaign.currency)
                      : formatMoney(0, campaign.currency)}
                  </p>
                  <p className="text-xs font-medium uppercase tracking-wider text-white/50">Avg. Donation</p>
                </div>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-5 shadow-lg shadow-black/20 backdrop-blur">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent" />
              <div className="relative z-10 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-amber-500/20">
                  <Calendar className="h-6 w-6 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {campaign.schedule.endDate
                      ? format(new Date(campaign.schedule.endDate), "MMM d, yyyy")
                      : "No end date"}
                  </p>
                  <p className="text-xs font-medium uppercase tracking-wider text-white/50">End Date</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          Milestones
      ══════════════════════════════════════════════════════════════════════ */}
      {campaign.milestones && campaign.milestones.length > 0 && (
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-950/90 to-black shadow-xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-500/5 via-transparent to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          
          <CardHeader className="relative z-10 border-b border-white/5 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-violet-500/20 to-purple-500/20">
                <Target className="h-5 w-5 text-violet-400" />
              </div>
              <CardTitle className="text-lg text-white">Milestones</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="relative z-10 space-y-3 p-6">
            {campaign.milestones.map((milestone) => {
              const reached = campaign.raisedAmountMinor >= milestone.amountMinor;
              return (
                <div key={milestone.id} className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.04]">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                      reached
                        ? "bg-gradient-to-br from-emerald-500/30 to-emerald-500/20 text-emerald-400"
                        : "bg-white/10 text-white/40"
                    )}
                  >
                    {reached ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Target className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={cn("font-medium", reached ? "text-white" : "text-white/60")}>
                      {milestone.label}
                    </p>
                  </div>
                  <p className={cn("text-sm font-medium", reached ? "text-emerald-400" : "text-white/50")}>
                    {formatMoney(milestone.amountMinor, campaign.currency)}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          Recent Donations
      ══════════════════════════════════════════════════════════════════════ */}
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-950/90 to-black shadow-xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-rose-500/5 via-transparent to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        
        <CardHeader className="relative z-10 flex flex-row items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-rose-500/20 to-pink-500/20">
              <Heart className="h-5 w-5 text-rose-400" />
            </div>
            <CardTitle className="text-lg text-white">Recent Donations</CardTitle>
          </div>
          <Link href={`/admin/community/fundraising/${campaignId}/donations`}>
            <Button variant="ghost" size="sm" className="gap-1 text-white/60 hover:text-white">
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="relative z-10 p-6">
          {donationsLoading ? (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <div className="relative">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500/20 border-t-emerald-500" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Heart className="h-4 w-4 text-emerald-400/60" />
                </div>
              </div>
              <p className="text-sm text-white/60">Loading donations...</p>
            </div>
          ) : donations.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
                <DollarSign className="h-8 w-8 text-white/30" />
              </div>
              <div className="text-center">
                <p className="font-medium text-white/80">No donations yet</p>
                <p className="mt-1 text-sm text-white/50">Donations will appear here once received</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {donations.map((donation) => (
                <div
                  key={donation.id}
                  className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.04]"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
                    <Heart className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-white">
                      {donation.isAnonymous ? "Anonymous" : donation.donorName || "Donor"}
                    </p>
                    <p className="text-sm text-white/50">
                      {PAYMENT_METHOD_LABELS[donation.paymentMethod] || donation.paymentMethod} ·{" "}
                      {formatDistanceToNow(new Date(donation.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-emerald-400">
                      {formatMoney(donation.amountMinor, donation.currency)}
                    </p>
                    <Badge
                      className={cn(
                        "mt-1 rounded-full text-[10px]",
                        donation.status === "completed"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                          : donation.status === "pending"
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                          : "border-rose-500/30 bg-rose-500/10 text-rose-200"
                      )}
                    >
                      {donation.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
