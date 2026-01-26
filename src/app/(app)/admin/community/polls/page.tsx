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
  useCommunityPolls,
  usePublishPoll,
  useClosePoll,
  useDeletePoll,
  PollListItemDTO,
  PollStatus,
} from "@/hooks/admin/useCommunityPolls";
import { useBusyToast } from "@/hooks/useBusyToast";
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
    <div className="group flex items-center gap-4 border-b border-white/5 px-4 py-4 transition-colors hover:bg-white/5">
      {/* Title & Status */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/community/polls/${poll.id}`}
            className="truncate font-medium text-white hover:text-violet-300"
          >
            {poll.title}
          </Link>
          <Badge className={cn("shrink-0 text-xs", STATUS_STYLES[poll.status])}>
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
          <Users className="h-4 w-4" />
          {poll.totalVotes}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-4 w-4" />
          {formatRelativeTime(poll.createdAt)}
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
            <Link href={`/admin/community/polls/${poll.id}`}>View Details</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/admin/community/polls/${poll.id}/results`}>View Results</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {(poll.status === "draft" || poll.status === "approved") && (
            <DropdownMenuItem onClick={onPublish} className="text-emerald-400">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Publish
            </DropdownMenuItem>
          )}
          {poll.status === "live" && (
            <DropdownMenuItem onClick={onClose} className="text-amber-400">
              <XCircle className="mr-2 h-4 w-4" />
              Close Poll
            </DropdownMenuItem>
          )}
          {(poll.status === "draft" || poll.status === "pending_approval") && (
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

export default function PollsListPage() {
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = React.useState<PollStatus | "all">("all");
  const [searchQuery, setSearchQuery] = React.useState("");

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
            <h1 className="text-2xl font-bold text-white">Community Polls</h1>
            <p className="text-sm text-white/60">
              Create and manage school-wide and targeted polls
            </p>
          </div>
          <Link href="/admin/community/polls?create=1">
            <Button className="gap-2 bg-violet-600 text-white hover:bg-violet-700">
              <Plus className="h-4 w-4" />
              Create Poll
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <Input
              placeholder="Search polls..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 border-white/10 bg-white/5 text-white placeholder:text-white/40"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as PollStatus | "all")}>
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
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Polls List */}
        <Card className="overflow-hidden border-white/10 bg-white/5">
          <div className="divide-y divide-white/5">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <XCircle className="h-10 w-10 text-rose-400/60" />
                <p className="mt-2 text-sm text-white/50">Failed to load polls</p>
              </div>
            ) : polls.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Vote className="h-12 w-12 text-white/20" />
                <p className="mt-3 text-lg font-medium text-white/70">No polls found</p>
                <p className="mt-1 text-sm text-white/40">
                  {searchQuery || statusFilter !== "all"
                    ? "Try adjusting your filters"
                    : "Create your first poll to get started"}
                </p>
                {!searchQuery && statusFilter === "all" && (
                  <Link href="/admin/community/polls?create=1">
                    <Button className="mt-4 gap-2" variant="outline">
                      <Plus className="h-4 w-4" />
                      Create Poll
                    </Button>
                  </Link>
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
            <div className="border-t border-white/5 px-4 py-3 text-sm text-white/50">
              Showing {polls.length} of {data.pagination.total} poll{data.pagination.total !== 1 ? "s" : ""}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
