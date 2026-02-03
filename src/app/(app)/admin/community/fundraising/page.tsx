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
 
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Search,
  Target,
 
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
import CreateCampaignModal from "@/components/modals/CreateCampaignModal";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";

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
    <div className="group flex items-center gap-4 border-b border-white/5 px-5 py-4 transition-all hover:bg-white/3">
      {/* Title & Status */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/community/fundraising/${campaign.id}`}
            className="truncate font-medium text-white transition-colors hover:text-emerald-300"
          >
            {campaign.title}
          </Link>
          <Badge className={cn("shrink-0 rounded-full text-[10px] font-medium", STATUS_STYLES[campaign.status])}>
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
            className="h-full rounded-full bg-linear-to-r from-emerald-500 to-emerald-400 transition-all"
            style={{ width: `${Math.min(campaign.progressPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="hidden items-center gap-6 text-sm text-white/60 lg:flex">
        <span className="flex items-center gap-1.5">
          <Target className="h-4 w-4 text-emerald-400/60" />
          {formatMoney(campaign.goalAmountMinor, campaign.currency)}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-white/40" />
          {formatRelativeTime(campaign.createdAt)}
        </span>
      </div>

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:bg-white/10 hover:text-white">
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
  const [createModalOpen, setCreateModalOpen] = React.useState(false);

  // Open create modal if ?create=1 is in URL
  React.useEffect(() => {
    if (searchParams.get("create") === "1") {
      setCreateModalOpen(true);
    }
  }, [searchParams]);

  const { data, isLoading, isError, refetch } = useFundraisingCampaigns({
    status: statusFilter === "all" ? undefined : statusFilter,
    category: categoryFilter === "all" ? undefined : categoryFilter,
    limit: 50,
  });

  const publishMutation = usePublishCampaign();
  const pauseMutation = usePauseCampaign();
  const closeMutation = useCloseCampaign();
  const deleteMutation = useDeleteCampaign();
  const busyToast = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();

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
    const decision = await confirm({
      title: "Delete Campaign?",
      description: "Are you sure you want to delete this campaign?",
      confirmLabel: "Delete Campaign",
      cancelLabel: "Keep Campaign",
      intent: "destructive",
    });
    if (decision !== "confirm") return;
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

  // Stats
  const liveCount = data?.data?.filter((c) => c.status === "live").length ?? 0;
  const totalRaised = data?.data?.reduce((sum, c) => sum + c.raisedAmountMinor, 0) ?? 0;
  const totalDonors = data?.data?.reduce((sum, c) => sum + c.donorCount, 0) ?? 0;
  const currency = data?.data?.[0]?.currency ?? "GHS";

  return (
    <div className="space-y-8">
      {/* ══════════════════════════════════════════════════════════════════════
          Premium Hero Header
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-slate-900/90 via-slate-950/95 to-black p-8 shadow-2xl shadow-black/40">
        {/* Background decorations */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-linear-to-br from-emerald-500/20 via-emerald-500/10 to-transparent blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-linear-to-tr from-teal-500/10 via-teal-500/5 to-transparent blur-3xl" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent" />

        <div className="relative z-10">
          {/* Top row */}
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin/community">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-linear-to-br from-emerald-500/20 to-teal-500/20 shadow-lg shadow-emerald-500/10">
                  <Heart className="h-6 w-6 text-emerald-300" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-white">Fundraising Campaigns</h1>
                  <p className="text-sm text-white/60">Create and manage fundraising campaigns for your school</p>
                </div>
              </div>
            </div>

            <Button
              onClick={() => setCreateModalOpen(true)}
              className="group gap-2 bg-linear-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-teal-700 hover:shadow-emerald-500/40"
            >
              <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
              <span>Create Campaign</span>
              <ArrowRight className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>

          {/* Quick Stats */}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-white/5 to-transparent p-5 shadow-lg shadow-black/20 backdrop-blur">
              <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-emerald-500/10 via-emerald-500/5 to-transparent" />
              <div className="relative z-10 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Live Campaigns</div>
                <div className="text-3xl font-semibold text-white drop-shadow-sm">{liveCount}</div>
                <div className="h-[3px] w-12 rounded-full bg-emerald-500/50" />
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-white/5 to-transparent p-5 shadow-lg shadow-black/20 backdrop-blur">
              <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-teal-500/10 via-teal-500/5 to-transparent" />
              <div className="relative z-10 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Total Raised</div>
                <div className="text-3xl font-semibold text-white drop-shadow-sm">{formatMoney(totalRaised, currency)}</div>
                <div className="h-[3px] w-12 rounded-full bg-teal-500/50" />
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-white/5 to-transparent p-5 shadow-lg shadow-black/20 backdrop-blur">
              <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-violet-500/10 via-violet-500/5 to-transparent" />
              <div className="relative z-10 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Total Donors</div>
                <div className="text-3xl font-semibold text-white drop-shadow-sm">{totalDonors.toLocaleString()}</div>
                <div className="h-[3px] w-12 rounded-full bg-violet-500/50" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          Filters
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:border-emerald-500/50 focus:ring-emerald-500/20"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as CampaignStatus | "all")}>
          <SelectTrigger className="w-40 rounded-xl border-white/10 bg-white/5 text-white">
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
          <SelectTrigger className="w-44 rounded-xl border-white/10 bg-white/5 text-white">
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

      {/* ══════════════════════════════════════════════════════════════════════
          Campaigns List
      ══════════════════════════════════════════════════════════════════════ */}
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
        {/* Decorative overlay */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-emerald-500/5 via-transparent to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />

        <div className="relative z-10 divide-y divide-white/5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <div className="relative">
                <div className="h-12 w-12 animate-spin rounded-full border-2 border-emerald-500/20 border-t-emerald-500" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Heart className="h-5 w-5 text-emerald-400/60" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white/80">Loading campaigns...</p>
                <p className="text-xs text-white/50">Fetching data</p>
              </div>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-rose-500/20 bg-rose-500/10">
                <XCircle className="h-8 w-8 text-rose-400" />
              </div>
              <div className="text-center">
                <p className="text-base font-medium text-white/80">Failed to load campaigns</p>
                <p className="mt-1 text-sm text-white/50">Please try again later</p>
              </div>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-linear-to-br from-white/10 to-white/5">
                  <Heart className="h-10 w-10 text-white/30" />
                </div>
                <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-900 bg-emerald-500">
                  <Plus className="h-4 w-4 text-white" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-base font-medium text-white/80">No campaigns found</p>
                <p className="mt-1 max-w-xs text-sm text-white/50">
                  {searchQuery || statusFilter !== "all" || categoryFilter !== "all"
                    ? "Try adjusting your filters"
                    : "Create your first campaign to start raising funds for your school"}
                </p>
              </div>
              {!searchQuery && statusFilter === "all" && categoryFilter === "all" && (
                <Button
                  onClick={() => setCreateModalOpen(true)}
                  className="mt-2 gap-2 bg-linear-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-teal-700"
                >
                  <Plus className="h-4 w-4" />
                  Create Campaign
                </Button>
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
          <div className="relative z-10 border-t border-white/5 px-5 py-3 text-sm text-white/50">
            Showing {campaigns.length} of {data.pagination.total} campaign{data.pagination.total !== 1 ? "s" : ""}
          </div>
        )}
      </Card>

      {/* Create Campaign Modal */}
      <CreateCampaignModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={() => {
          refetch();
          setCreateModalOpen(false);
        }}
      />
      {confirmationDialog}
    </div>
  );
}
