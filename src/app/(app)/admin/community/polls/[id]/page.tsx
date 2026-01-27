// src/app/(app)/admin/community/polls/[id]/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns/format";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Edit,
  Eye,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Users,
  Vote,
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
  useCommunityPoll,
  usePollResults,
  usePublishPoll,
  useClosePoll,
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

const QUESTION_TYPE_LABELS: Record<string, string> = {
  single_choice: "Single Choice",
  multi_choice: "Multiple Choice",
  ranked_choice: "Ranked Choice",
  likert: "Likert Scale",
  yes_no: "Yes/No",
  comment: "Open Text",
};

// ============================================================================
// Results Chart Components
// ============================================================================

function ChoiceResultBar({ label, count, percentage }: { label: string; count: number; percentage: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="truncate text-white/80">{label}</span>
        <span className="shrink-0 text-white/50">{count} ({percentage}%)</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function LikertResult({ distribution, average }: { distribution: Record<number, number>; average: number | null }) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((value) => {
          const count = distribution[value] || 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={value} className="flex-1">
              <div className="mb-1 text-center text-xs text-white/50">{value}</div>
              <div className="h-16 rounded-t bg-white/10 relative overflow-hidden">
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-t bg-gradient-to-t from-violet-500 to-purple-400"
                  style={{ height: `${pct}%` }}
                />
              </div>
              <div className="mt-1 text-center text-xs text-white/40">{count}</div>
            </div>
          );
        })}
      </div>
      {average !== null && (
        <p className="text-center text-sm text-white/60">
          Average: <span className="font-medium text-white">{average}</span>
        </p>
      )}
    </div>
  );
}

function YesNoResult({ yes, no, yesPercentage, noPercentage }: { yes: number; no: number; yesPercentage: number; noPercentage: number }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-emerald-400">Yes</span>
          <span className="text-white/50">{yes} ({yesPercentage}%)</span>
        </div>
        <div className="mt-1 h-3 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
            style={{ width: `${yesPercentage}%` }}
          />
        </div>
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-rose-400">No</span>
          <span className="text-white/50">{no} ({noPercentage}%)</span>
        </div>
        <div className="mt-1 h-3 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-400"
            style={{ width: `${noPercentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function PollDetailPage() {
  const params = useParams();
  const pollId = params.id as string;

  const { data: poll, isLoading: pollLoading, isError: pollError } = useCommunityPoll(pollId);
  const { data: results, isLoading: resultsLoading } = usePollResults(pollId);

  const publishMutation = usePublishPoll();
  const closeMutation = useClosePoll();
  const busyToast = useBusyToast();

  const handlePublish = async () => {
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

  const handleClose = async () => {
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

  if (pollLoading) {
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
        <Skeleton className="h-64 rounded-2xl bg-white/5" />
      </div>
    );
  }

  if (pollError || !poll) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-rose-500/20 bg-rose-500/10">
          <XCircle className="h-10 w-10 text-rose-400" />
        </div>
        <div className="text-center">
          <p className="text-lg font-medium text-white/80">Poll not found</p>
          <p className="mt-1 text-sm text-white/50">This poll may have been deleted or doesn&apos;t exist</p>
        </div>
        <Link href="/admin/community/polls">
          <Button variant="outline" className="mt-2 gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
            Back to Polls
          </Button>
        </Link>
      </div>
    );
  }

  const canShowResults = poll.status === "live" || poll.status === "closed" || poll.revealResults === "live";

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
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <Link href="/admin/community/polls">
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
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/20 to-purple-500/20 shadow-lg shadow-violet-500/10">
                    <Vote className="h-6 w-6 text-violet-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h1 className="text-3xl font-bold tracking-tight text-white">{poll.title}</h1>
                      <Badge className={cn("rounded-full text-xs font-medium", STATUS_STYLES[poll.status])}>
                        {poll.status.replaceAll("_", " ")}
                      </Badge>
                    </div>
                    {poll.description && (
                      <p className="mt-1 text-sm text-white/60">{poll.description}</p>
                    )}
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
                {(poll.status === "draft" || poll.status === "approved") && (
                  <DropdownMenuItem onClick={handlePublish} className="text-emerald-400">
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Publish Poll
                  </DropdownMenuItem>
                )}
                {poll.status === "live" && (
                  <DropdownMenuItem onClick={handleClose} className="text-amber-400">
                    <XCircle className="mr-2 h-4 w-4" />
                    Close Poll
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/admin/community/polls/${pollId}/edit`}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Poll
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Stats Grid */}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-5 shadow-lg shadow-black/20 backdrop-blur">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent" />
              <div className="relative z-10 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-violet-500/20">
                  <Users className="h-6 w-6 text-violet-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{poll.totalVotes}</p>
                  <p className="text-xs font-medium uppercase tracking-wider text-white/50">Total Votes</p>
                </div>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-5 shadow-lg shadow-black/20 backdrop-blur">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-transparent" />
              <div className="relative z-10 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-sky-500/20">
                  <MessageSquare className="h-6 w-6 text-sky-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{poll.questions.length}</p>
                  <p className="text-xs font-medium uppercase tracking-wider text-white/50">Questions</p>
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
                    {poll.schedule.endDate
                      ? format(new Date(poll.schedule.endDate), "MMM d, yyyy")
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
          Questions & Results
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-violet-500/20 to-purple-500/20">
            <BarChart3 className="h-5 w-5 text-violet-400" />
          </div>
          <h2 className="text-xl font-semibold text-white">Questions & Results</h2>
        </div>
        
        {resultsLoading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <div className="relative">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-500/20 border-t-violet-500" />
              <div className="absolute inset-0 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-violet-400/60" />
              </div>
            </div>
            <p className="text-sm text-white/60">Loading results...</p>
          </div>
        ) : !canShowResults ? (
          <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-950/90 to-black shadow-xl">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-500/5 via-transparent to-transparent" />
            <CardContent className="relative z-10 flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
                <Eye className="h-8 w-8 text-white/30" />
              </div>
              <p className="mt-4 font-medium text-white/80">Results are hidden</p>
              <p className="mt-1 text-sm text-white/50">
                Results will be visible when the poll closes
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {results?.questions.map((q, index) => (
              <Card key={q.questionId} className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-950/90 to-black shadow-xl">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-500/5 via-transparent to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                
                <CardHeader className="relative z-10 border-b border-white/5 pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-white/40">Question {index + 1}</p>
                      <CardTitle className="mt-1 text-lg text-white">{q.prompt}</CardTitle>
                    </div>
                    <Badge className="rounded-full border-white/10 bg-white/5 text-xs text-white/60">
                      {QUESTION_TYPE_LABELS[q.type] || q.type}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-white/50">{q.totalResponses} responses</p>
                </CardHeader>
                <CardContent className="relative z-10 space-y-3 p-6">
                  {(q.type === "single_choice" || q.type === "multi_choice") && q.options && (
                    <div className="space-y-3">
                      {q.options.map((opt) => (
                        <ChoiceResultBar
                          key={opt.optionId}
                          label={opt.label}
                          count={opt.count}
                          percentage={opt.percentage}
                        />
                      ))}
                    </div>
                  )}
                  {q.type === "likert" && q.distribution && (
                    <LikertResult distribution={q.distribution} average={q.average ?? null} />
                  )}
                  {q.type === "yes_no" && (
                    <YesNoResult
                      yes={q.yes || 0}
                      no={q.no || 0}
                      yesPercentage={q.yesPercentage || 0}
                      noPercentage={q.noPercentage || 0}
                    />
                  )}
                  {q.type === "comment" && q.responses && (
                    <div className="max-h-48 space-y-2 overflow-y-auto">
                      {q.responses.length === 0 ? (
                        <p className="text-sm text-white/40">No responses yet</p>
                      ) : (
                        q.responses.map((response, i) => (
                          <div key={i} className="rounded-xl border border-white/5 bg-white/5 p-3 text-sm text-white/80">
                            {response}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
