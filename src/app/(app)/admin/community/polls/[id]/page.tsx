// src/app/(app)/admin/community/polls/[id]/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns/format";
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
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
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-violet-500 transition-all"
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
              <div className="h-16 rounded-t bg-white/10 relative">
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-t bg-violet-500"
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
            className="h-full rounded-full bg-emerald-500"
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
            className="h-full rounded-full bg-rose-500"
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
      <div className="min-h-screen bg-[#0a0a0f] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <Skeleton className="h-8 w-64 bg-white/10" />
          <Skeleton className="mt-4 h-48 bg-white/5" />
          <Skeleton className="mt-4 h-64 bg-white/5" />
        </div>
      </div>
    );
  }

  if (pollError || !poll) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <XCircle className="h-12 w-12 text-rose-400/60" />
            <p className="mt-3 text-lg font-medium text-white/70">Poll not found</p>
            <Link href="/admin/community/polls">
              <Button className="mt-4" variant="outline">
                Back to Polls
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const canShowResults = poll.status === "live" || poll.status === "closed" || poll.revealResults === "live";

  return (
    <div className="min-h-screen bg-[#0a0a0f] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex items-start gap-4">
          <Link href="/admin/community/polls">
            <Button variant="ghost" size="icon" className="mt-1 text-white/60 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{poll.title}</h1>
              <Badge className={cn("text-sm", STATUS_STYLES[poll.status])}>
                {poll.status.replaceAll("_", " ")}
              </Badge>
            </div>
            {poll.description && (
              <p className="mt-1 text-white/60">{poll.description}</p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="border-white/10 text-white/60">
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
                <Link href={`/admin/community/polls/${pollId}/edit`}>Edit Poll</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Stats Grid */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Card className="border-white/10 bg-white/5">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/20">
                <Users className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{poll.totalVotes}</p>
                <p className="text-sm text-white/50">Total Votes</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-white/5">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/20">
                <MessageSquare className="h-5 w-5 text-sky-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{poll.questions.length}</p>
                <p className="text-sm text-white/50">Questions</p>
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
                  {poll.schedule.endDate
                    ? format(new Date(poll.schedule.endDate), "MMM d, yyyy")
                    : "No end date"}
                </p>
                <p className="text-sm text-white/50">End Date</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Questions & Results */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Questions & Results</h2>
          
          {resultsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
            </div>
          ) : !canShowResults ? (
            <Card className="border-white/10 bg-white/5">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <Eye className="h-10 w-10 text-white/20" />
                <p className="mt-2 text-white/60">
                  Results are hidden until the poll closes
                </p>
              </CardContent>
            </Card>
          ) : (
            results?.questions.map((q, index) => (
              <Card key={q.questionId} className="border-white/10 bg-white/5">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-white/40">Question {index + 1}</p>
                      <CardTitle className="mt-1 text-white">{q.prompt}</CardTitle>
                    </div>
                    <Badge className="border-white/10 bg-white/5 text-white/60">
                      {QUESTION_TYPE_LABELS[q.type] || q.type}
                    </Badge>
                  </div>
                  <p className="text-sm text-white/50">{q.totalResponses} responses</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(q.type === "single_choice" || q.type === "multi_choice") && q.options && (
                    <div className="space-y-2">
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
                          <div key={i} className="rounded-lg bg-white/5 p-3 text-sm text-white/80">
                            {response}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
