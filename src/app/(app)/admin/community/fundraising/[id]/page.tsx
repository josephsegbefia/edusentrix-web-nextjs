// src/app/(app)/admin/community/fundraising/[id]/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns/format";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
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
      <div className="min-h-screen bg-[#0a0a0f] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <Skeleton className="h-8 w-64 bg-white/10" />
          <Skeleton className="mt-4 h-48 bg-white/5" />
          <Skeleton className="mt-4 h-64 bg-white/5" />
        </div>
      </div>
    );
  }

  if (campaignError || !campaign) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <XCircle className="h-12 w-12 text-rose-400/60" />
            <p className="mt-3 text-lg font-medium text-white/70">Campaign not found</p>
            <Link href="/admin/community/fundraising">
              <Button className="mt-4" variant="outline">
                Back to Campaigns
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const donations = donationsData?.data || [];

  return (
    <div className="min-h-screen bg-[#0a0a0f] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex items-start gap-4">
          <Link href="/admin/community/fundraising">
            <Button variant="ghost" size="icon" className="mt-1 text-white/60 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{campaign.title}</h1>
              <Badge className={cn("text-sm", STATUS_STYLES[campaign.status])}>
                {campaign.status.replaceAll("_", " ")}
              </Badge>
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm text-white/60">
              <span>{CATEGORY_LABELS[campaign.category] || campaign.category}</span>
              <span>·</span>
              <span>Created {formatDistanceToNow(new Date(campaign.createdAt), { addSuffix: true })}</span>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="border-white/10 text-white/60">
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
                <Link href={`/admin/community/fundraising/${campaignId}/edit`}>Edit Campaign</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Progress Card */}
        <Card className="mb-6 border-white/10 bg-linear-to-br from-emerald-500/10 to-transparent">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/60">Amount Raised</p>
                <p className="text-3xl font-bold text-white">
                  {formatMoney(campaign.raisedAmountMinor, campaign.currency)}
                </p>
                <p className="mt-1 text-sm text-white/50">
                  of {formatMoney(campaign.goalAmountMinor, campaign.currency)} goal
                </p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-bold text-emerald-400">{campaign.progressPercent}%</p>
                <p className="text-sm text-white/50">Complete</p>
              </div>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.min(campaign.progressPercent, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Card className="border-white/10 bg-white/5">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20">
                <Users className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{campaign.donorCount}</p>
                <p className="text-sm text-white/50">Donors</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-white/5">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/20">
                <TrendingUp className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {campaign.donorCount > 0
                    ? formatMoney(Math.round(campaign.raisedAmountMinor / campaign.donorCount), campaign.currency)
                    : formatMoney(0, campaign.currency)}
                </p>
                <p className="text-sm text-white/50">Avg. Donation</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-white/5">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20">
                <Calendar className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  {campaign.schedule.endDate
                    ? format(new Date(campaign.schedule.endDate), "MMM d, yyyy")
                    : "No end date"}
                </p>
                <p className="text-sm text-white/50">End Date</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Milestones */}
        {campaign.milestones && campaign.milestones.length > 0 && (
          <Card className="mb-6 border-white/10 bg-white/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-white">
                <Target className="h-5 w-5 text-violet-400" />
                Milestones
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {campaign.milestones.map((milestone) => {
                const reached = campaign.raisedAmountMinor >= milestone.amountMinor;
                return (
                  <div key={milestone.id} className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full",
                        reached
                          ? "bg-emerald-500/20 text-emerald-400"
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
                    <p className={cn("text-sm", reached ? "text-emerald-400" : "text-white/50")}>
                      {formatMoney(milestone.amountMinor, campaign.currency)}
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Recent Donations */}
        <Card className="border-white/10 bg-white/5">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-white">
              <Heart className="h-5 w-5 text-rose-400" />
              Recent Donations
            </CardTitle>
            <Link href={`/admin/community/fundraising/${campaignId}/donations`}>
              <Button variant="ghost" size="sm" className="text-white/60 hover:text-white">
                View all
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {donationsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
              </div>
            ) : donations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <DollarSign className="h-10 w-10 text-white/20" />
                <p className="mt-2 text-sm text-white/50">No donations yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {donations.map((donation) => (
                  <div
                    key={donation.id}
                    className="flex items-center gap-4 rounded-lg border border-white/5 bg-white/5 p-3"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
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
                          "text-xs",
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
    </div>
  );
}
