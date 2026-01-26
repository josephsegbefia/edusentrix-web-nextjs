// src/app/(app)/admin/community/fundraising/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Filter,
  Heart,
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Search,
  Target,
  Users,
  XCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useFundraisingCampaigns,
  usePublishCampaign,
  useCloseCampaign,
  usePauseCampaign,
  useDeleteCampaign,
  CampaignListItemDTO,
  CampaignStatus,
  CampaignCategory,
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

const CATEGORY_LABELS: Record<string, string> = {
  school_project: "School Project",
  emergency: "Emergency",
  pta_drive: "PTA Drive",
  student_cause: "Student Cause",
  other: "Other",
};

// ============================================================================
// Helpers
// ============================================================================

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "";
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

// ============================================================================
// Campaign Row
// ============================================================================

interface CampaignRowProps {
  campaign: CampaignListItemDTO;
  onPublish: () => void;
  onPause: () => void;
  onClose: () => void;
  onDelete: () => void;
}

function CampaignRow({ campaign, onPublish, onPause, onClose, onDelete }: CampaignRowProps) {
  return (
    <div className="group flex items-center gap-4 border-b border-white/5 px-4 py-4 transition-colors hover:bg-white/5">
      {/* Title & Status */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/community/fundraising/${campaign.id}`}
            className="truncate font-medium text-white hover:text-emerald-300"
          >
            {campaign.title}
          </Link>
          <Badge className={cn("shrink-0 text-xs", STATUS_STYLES[campaign.status])}>
            {campaign.status.replaceAll("_", " ")}
          </Badge>
        </div>
        <p className="mt-0.5 truncate text-sm text-white/50">
          {CATEGORY_LABELS[campaign.category] || campaign.category} ·{" "}
          {campaign.donorCount} donor{campaign.donorCount !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Progress */}
      <div className="hidden w-48 md:block">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/50">
            {formatMoney(campaign.raisedAmountMinor, campaign.currency)}
          </span>
          <span className="font-medium text-emerald-400">{campaign.progressPercent}%</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${Math.min(campaign.progressPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="hidden items-center gap-6 text-sm text-white/60 lg:flex">
        <span className="flex items-center gap-1.5">
          <Target className="h-4 w-4" />
          {formatMoney(campaign.goalAmountMinor, campaign.currency)}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-4 w-4" />
          {formatRelativeTime(campaign.createdAt)}
        </span>
      </div>

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-white">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link href={`/admin/community/fundraising/${campaign.id}`}>View Details</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/admin/community/fundraising/${campaign.id}/donations`}>View Donations</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {(campaign.status === "draft" || campaign.status === "approved" || campaign.status === "paused") && (
            <DropdownMenuItem onClick={onPublish} className="text-emerald-400">
              <Play className="mr-2 h-4 w-4" />
              {campaign.status === "paused" ? "Resume" : "Publish"}
            </DropdownMenuItem>
          )}
          {campaign.status === "live" && (
            <>
              <DropdownMenuItem onClick={onPause} className="text-orange-400">
                <Pause className="mr-2 h-4 w-4" />
                Pause
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onClose} className="text-amber-400">
                <XCircle className="mr-2 h-4 w-4" />
                Close Campaign
              </DropdownMenuItem>
            </>
          )}
          {(campaign.status === "draft" || campaign.status === "pending_approval") && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-rose-400">
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function FundraisingListPage() {
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = React.useState<CampaignStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = React.useState<CampaignCategory | "all">("all");
  const [searchQuery, setSearchQuery] = React.useState("");

  const { data, isLoading, isError } = useFundraisingCampaigns({
    status: statusFilter === "all" ? undefined : statusFilter,
    category: categoryFilter === "all" ? undefined : categoryFilter,
    limit: 50,
  });

  const publishMutation = usePublishCampaign();
  const pauseMutation = usePauseCampaign();
  const closeMutation = useCloseCampaign();
  const deleteMutation = useDeleteCampaign();
  const busyToast = useBusyToast();

  const handlePublish = async (campaignId: string) => {
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

  const handlePause = async (campaignId: string) => {
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

  const handleClose = async (campaignId: string) => {
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

  const handleDelete = async (campaignId: string) => {
    if (!confirm("Are you sure you want to delete this campaign?")) return;
    busyToast.show("Deleting campaign...");
    try {
      await deleteMutation.mutateAsync(campaignId);
      toast.success("Campaign deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete campaign");
    } finally {
      busyToast.hide();
    }
  };

  // Filter campaigns by search query
  const campaigns = React.useMemo(() => {
    if (!data?.data) return [];
    if (!searchQuery) return data.data;
    const query = searchQuery.toLowerCase();
    return data.data.filter(
      (c) =>
        c.title.toLowerCase().includes(query) ||
        c.summary?.toLowerCase().includes(query) ||
        c.createdBy?.name.toLowerCase().includes(query)
    );
  }, [data?.data, searchQuery]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Link href="/admin/community">
            <Button variant="ghost" size="icon" className="text-white/60 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">Fundraising Campaigns</h1>
            <p className="text-sm text-white/60">
              Create and manage fundraising campaigns for your school
            </p>
          </div>
          <Link href="/admin/community/fundraising?create=1">
            <Button className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
              <Plus className="h-4 w-4" />
              Create Campaign
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <Input
              placeholder="Search campaigns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 border-white/10 bg-white/5 text-white placeholder:text-white/40"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as CampaignStatus | "all")}>
            <SelectTrigger className="w-40 border-white/10 bg-white/5 text-white">
              <Filter className="mr-2 h-4 w-4 text-white/40" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending_approval">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="live">Live</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="reconciled">Reconciled</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as CampaignCategory | "all")}>
            <SelectTrigger className="w-44 border-white/10 bg-white/5 text-white">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="school_project">School Project</SelectItem>
              <SelectItem value="emergency">Emergency</SelectItem>
              <SelectItem value="pta_drive">PTA Drive</SelectItem>
              <SelectItem value="student_cause">Student Cause</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Campaigns List */}
        <Card className="overflow-hidden border-white/10 bg-white/5">
          <div className="divide-y divide-white/5">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <XCircle className="h-10 w-10 text-rose-400/60" />
                <p className="mt-2 text-sm text-white/50">Failed to load campaigns</p>
              </div>
            ) : campaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Heart className="h-12 w-12 text-white/20" />
                <p className="mt-3 text-lg font-medium text-white/70">No campaigns found</p>
                <p className="mt-1 text-sm text-white/40">
                  {searchQuery || statusFilter !== "all" || categoryFilter !== "all"
                    ? "Try adjusting your filters"
                    : "Create your first campaign to get started"}
                </p>
                {!searchQuery && statusFilter === "all" && categoryFilter === "all" && (
                  <Link href="/admin/community/fundraising?create=1">
                    <Button className="mt-4 gap-2" variant="outline">
                      <Plus className="h-4 w-4" />
                      Create Campaign
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              campaigns.map((campaign) => (
                <CampaignRow
                  key={campaign.id}
                  campaign={campaign}
                  onPublish={() => handlePublish(campaign.id)}
                  onPause={() => handlePause(campaign.id)}
                  onClose={() => handleClose(campaign.id)}
                  onDelete={() => handleDelete(campaign.id)}
                />
              ))
            )}
          </div>

          {/* Pagination Info */}
          {data?.pagination && data.pagination.total > 0 && (
            <div className="border-t border-white/5 px-4 py-3 text-sm text-white/50">
              Showing {campaigns.length} of {data.pagination.total} campaign{data.pagination.total !== 1 ? "s" : ""}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
