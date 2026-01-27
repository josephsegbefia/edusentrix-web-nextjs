// src/app/(app)/admin/community/polls/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns/format";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Filter,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Users,
  Vote,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuItem,
  PremiumDropdownMenuSeparator,
  PremiumDropdownMenuTrigger,
} from "@/components/ui/premium-dropdown-menu";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  useCommunityPolls,
  usePublishPoll,
  useClosePoll,
  useDeletePoll,
  PollListItemDTO,
  PollStatus,
} from "@/hooks/admin/useCommunityPolls";
import { usePollTemplate, TemplateListItemDTO } from "@/hooks/admin/usePollTemplates";
import { useBusyToast } from "@/hooks/useBusyToast";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import dynamic from "next/dynamic";

// Lazy load modals for better performance
const PollTemplateSelector = dynamic(() => import("@/components/polls/PollTemplateSelector"), {
  ssr: false,
});
const CreatePollModal = dynamic(() => import("@/components/modals/CreatePollModal"), {
  ssr: false,
});

// ============================================================================
// Styles
// ============================================================================

const STATUS_STYLES: Record<string, string> = {
  draft: "border-slate-500/30 bg-slate-500/10 text-slate-200",
  pending_approval: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  approved: "border-blue-500/30 bg-blue-500/10 text-blue-200",
  live: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  closed: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  archived: "border-slate-600/30 bg-slate-600/10 text-slate-400",
};

const SCOPE_LABELS: Record<string, string> = {
  school: "School-wide",
  grade: "Grade-specific",
  class: "Class-specific",
  staff: "Staff only",
  parents: "Parents only",
  students: "Students only",
};

// ============================================================================
// Helpers
// ============================================================================

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "";
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

// ============================================================================
// Poll Table Row
// ============================================================================

interface PollRowProps {
  poll: PollListItemDTO;
  onPublish: () => void;
  onClose: () => void;
  onDelete: () => void;
}

function PollRow({ poll, onPublish, onClose, onDelete }: PollRowProps) {
  return (
    <div className="group flex items-center gap-4 border-b border-white/5 px-5 py-4 transition-all hover:bg-white/[0.03]">
      {/* Title & Status */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/community/polls/${poll.id}`}
            className="truncate font-medium text-white transition-colors hover:text-violet-300"
          >
            {poll.title}
          </Link>
          <Badge className={cn("shrink-0 rounded-full text-[10px] font-medium", STATUS_STYLES[poll.status])}>
            {poll.status.replaceAll("_", " ")}
          </Badge>
        </div>
        <p className="mt-0.5 truncate text-sm text-white/50">
          {poll.questionCount} question{poll.questionCount !== 1 ? "s" : ""} ·{" "}
          {SCOPE_LABELS[poll.audience.scope] || poll.audience.scope}
        </p>
      </div>

      {/* Stats */}
      <div className="hidden items-center gap-6 text-sm text-white/60 md:flex">
        <span className="flex items-center gap-1.5">
          <Users className="h-4 w-4 text-violet-400/60" />
          {poll.totalVotes}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-white/40" />
          {formatRelativeTime(poll.createdAt)}
        </span>
      </div>

      {/* Actions */}
      <PremiumDropdownMenu>
        <PremiumDropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:bg-white/10 hover:text-white">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </PremiumDropdownMenuTrigger>
        <PremiumDropdownMenuContent align="end">
          <PremiumDropdownMenuItem asChild>
            <Link href={`/admin/community/polls/${poll.id}`} className="flex items-center gap-2.5">
              <Vote className="h-4 w-4" />
              View Details
            </Link>
          </PremiumDropdownMenuItem>
          <PremiumDropdownMenuItem asChild>
            <Link href={`/admin/community/polls/${poll.id}/results`} className="flex items-center gap-2.5">
              <BarChart3 className="h-4 w-4" />
              View Results
            </Link>
          </PremiumDropdownMenuItem>
          <PremiumDropdownMenuSeparator />
          {(poll.status === "draft" || poll.status === "approved") && (
            <PremiumDropdownMenuItem 
              onClick={onPublish} 
              variant="success"
              icon={<CheckCircle2 className="h-4 w-4" />}
            >
              Publish
            </PremiumDropdownMenuItem>
          )}
          {poll.status === "live" && (
            <PremiumDropdownMenuItem 
              onClick={onClose} 
              variant="warning"
              icon={<XCircle className="h-4 w-4" />}
            >
              Close Poll
            </PremiumDropdownMenuItem>
          )}
          {(poll.status === "draft" || poll.status === "pending_approval") && (
            <>
              <PremiumDropdownMenuSeparator />
              <PremiumDropdownMenuItem 
                onClick={onDelete} 
                variant="destructive"
              >
                Delete
              </PremiumDropdownMenuItem>
            </>
          )}
        </PremiumDropdownMenuContent>
      </PremiumDropdownMenu>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function PollsListPage() {
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = React.useState<PollStatus | "all">("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  
  // Template selector and create modal state
  const [showTemplateSelector, setShowTemplateSelector] = React.useState(false);
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string | null>(null);
  
  // Fetch selected template details
  const { data: templateDetail } = usePollTemplate(selectedTemplateId || undefined);

  // Check URL for create param
  React.useEffect(() => {
    if (searchParams.get("create") === "1") {
      setShowTemplateSelector(true);
      // Clear the URL param
      window.history.replaceState({}, "", "/admin/community/polls");
    }
  }, [searchParams]);
  
  // Handle template selection
  const handleSelectTemplate = (template: TemplateListItemDTO | null) => {
    if (template) {
      setSelectedTemplateId(template.id);
    } else {
      setSelectedTemplateId(null);
    }
    setShowCreateModal(true);
  };
  
  // Handle modal close
  const handleCreateModalClose = (open: boolean) => {
    setShowCreateModal(open);
    if (!open) {
      setSelectedTemplateId(null);
    }
  };

  const { data, isLoading, isError } = useCommunityPolls({
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: 50,
  });

  const publishMutation = usePublishPoll();
  const closeMutation = useClosePoll();
  const deleteMutation = useDeletePoll();
  const busyToast = useBusyToast();

  const handlePublish = async (pollId: string) => {
    busyToast.show("Publishing poll...");
    try {
      await publishMutation.mutateAsync(pollId);
      toast.success("Poll published successfully");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to publish poll");
    } finally {
      busyToast.hide();
    }
  };

  const handleClose = async (pollId: string) => {
    busyToast.show("Closing poll...");
    try {
      await closeMutation.mutateAsync(pollId);
      toast.success("Poll closed successfully");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to close poll");
    } finally {
      busyToast.hide();
    }
  };

  const handleDelete = async (pollId: string) => {
    if (!confirm("Are you sure you want to delete this poll?")) return;
    busyToast.show("Deleting poll...");
    try {
      await deleteMutation.mutateAsync(pollId);
      toast.success("Poll deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete poll");
    } finally {
      busyToast.hide();
    }
  };

  // Filter polls by search query
  const polls = React.useMemo(() => {
    if (!data?.data) return [];
    if (!searchQuery) return data.data;
    const query = searchQuery.toLowerCase();
    return data.data.filter(
      (p) =>
        p.title.toLowerCase().includes(query) ||
        p.createdBy?.name.toLowerCase().includes(query)
    );
  }, [data?.data, searchQuery]);

  // Stats
  const liveCount = data?.data?.filter((p) => p.status === "live").length ?? 0;
  const totalVotes = data?.data?.reduce((sum, p) => sum + p.totalVotes, 0) ?? 0;
  const draftCount = data?.data?.filter((p) => p.status === "draft").length ?? 0;

  return (
    <div className="space-y-8">
      {/* ══════════════════════════════════════════════════════════════════════
          Premium Hero Header
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 via-slate-950/95 to-black p-8 shadow-2xl shadow-black/40">
        {/* Background decorations */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-violet-500/20 via-violet-500/10 to-transparent blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-gradient-to-tr from-purple-500/10 via-purple-500/5 to-transparent blur-3xl" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

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
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/20 to-purple-500/20 shadow-lg shadow-violet-500/10">
                  <Vote className="h-6 w-6 text-violet-300" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-white">Community Polls</h1>
                  <p className="text-sm text-white/60">Create and manage school-wide and targeted polls</p>
                </div>
              </div>
            </div>

            <Button 
              onClick={() => setShowTemplateSelector(true)}
              className="group gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25 hover:from-violet-600 hover:to-purple-700 hover:shadow-violet-500/40"
            >
              <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
              <span>Create Poll</span>
              <ArrowRight className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>

          {/* Quick Stats */}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-5 shadow-lg shadow-black/20 backdrop-blur">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent" />
              <div className="relative z-10 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Live Polls</div>
                <div className="text-3xl font-semibold text-white drop-shadow-sm">{liveCount}</div>
                <div className="h-[3px] w-12 rounded-full bg-emerald-500/50" />
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-5 shadow-lg shadow-black/20 backdrop-blur">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent" />
              <div className="relative z-10 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Total Votes</div>
                <div className="text-3xl font-semibold text-white drop-shadow-sm">{totalVotes.toLocaleString()}</div>
                <div className="h-[3px] w-12 rounded-full bg-violet-500/50" />
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-5 shadow-lg shadow-black/20 backdrop-blur">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent" />
              <div className="relative z-10 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Drafts</div>
                <div className="text-3xl font-semibold text-white drop-shadow-sm">{draftCount}</div>
                <div className="h-[3px] w-12 rounded-full bg-amber-500/50" />
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
            placeholder="Search polls..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:border-violet-500/50 focus:ring-violet-500/20"
          />
        </div>
        <PremiumSelect value={statusFilter} onValueChange={(v) => setStatusFilter(v as PollStatus | "all")}>
          <PremiumSelectTrigger className="w-44" icon={<Filter className="h-4 w-4" />}>
            <PremiumSelectValue placeholder="Status" />
          </PremiumSelectTrigger>
          <PremiumSelectContent>
            <PremiumSelectItem value="all">All Status</PremiumSelectItem>
            <PremiumSelectItem value="draft">Draft</PremiumSelectItem>
            <PremiumSelectItem value="pending_approval">Pending Approval</PremiumSelectItem>
            <PremiumSelectItem value="approved">Approved</PremiumSelectItem>
            <PremiumSelectItem value="live">Live</PremiumSelectItem>
            <PremiumSelectItem value="closed">Closed</PremiumSelectItem>
            <PremiumSelectItem value="archived">Archived</PremiumSelectItem>
          </PremiumSelectContent>
        </PremiumSelect>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          Polls List
      ══════════════════════════════════════════════════════════════════════ */}
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
        {/* Decorative overlay */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-500/5 via-transparent to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

        <div className="relative z-10 divide-y divide-white/5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <div className="relative">
                <div className="h-12 w-12 animate-spin rounded-full border-2 border-violet-500/20 border-t-violet-500" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Vote className="h-5 w-5 text-violet-400/60" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white/80">Loading polls...</p>
                <p className="text-xs text-white/50">Fetching data</p>
              </div>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-rose-500/20 bg-rose-500/10">
                <XCircle className="h-8 w-8 text-rose-400" />
              </div>
              <div className="text-center">
                <p className="text-base font-medium text-white/80">Failed to load polls</p>
                <p className="mt-1 text-sm text-white/50">Please try again later</p>
              </div>
            </div>
          ) : polls.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-white/10 to-white/5">
                  <Vote className="h-10 w-10 text-white/30" />
                </div>
                <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-900 bg-violet-500">
                  <Plus className="h-4 w-4 text-white" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-base font-medium text-white/80">No polls found</p>
                <p className="mt-1 max-w-xs text-sm text-white/50">
                  {searchQuery || statusFilter !== "all"
                    ? "Try adjusting your filters"
                    : "Create your first poll to gather feedback from your community"}
                </p>
              </div>
              {!searchQuery && statusFilter === "all" && (
                <Button 
                  onClick={() => setShowTemplateSelector(true)}
                  className="mt-2 gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25 hover:from-violet-600 hover:to-purple-700"
                >
                  <Plus className="h-4 w-4" />
                  Create Poll
                </Button>
              )}
            </div>
          ) : (
            polls.map((poll) => (
              <PollRow
                key={poll.id}
                poll={poll}
                onPublish={() => handlePublish(poll.id)}
                onClose={() => handleClose(poll.id)}
                onDelete={() => handleDelete(poll.id)}
              />
            ))
          )}
        </div>

        {/* Pagination Info */}
        {data?.pagination && data.pagination.total > 0 && (
          <div className="relative z-10 border-t border-white/5 px-5 py-3 text-sm text-white/50">
            Showing {polls.length} of {data.pagination.total} poll{data.pagination.total !== 1 ? "s" : ""}
          </div>
        )}
      </Card>

      {/* Template Selector Modal */}
      <PollTemplateSelector
        open={showTemplateSelector}
        onOpenChange={setShowTemplateSelector}
        onSelectTemplate={handleSelectTemplate}
      />

      {/* Create Poll Modal */}
      <CreatePollModal
        open={showCreateModal}
        onOpenChange={handleCreateModalClose}
        onSuccess={() => {
          setShowCreateModal(false);
          setSelectedTemplateId(null);
        }}
        template={templateDetail ? {
          id: templateDetail.id,
          name: templateDetail.name,
          description: templateDetail.description,
          category: templateDetail.category,
          questions: templateDetail.questions,
          defaults: templateDetail.defaults,
        } : null}
      />
    </div>
  );
}
