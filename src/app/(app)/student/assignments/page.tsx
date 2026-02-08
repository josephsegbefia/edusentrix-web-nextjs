"use client";

import * as React from "react";
import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns/formatDistanceToNowStrict";
import { format } from "date-fns/format";
import {
  ClipboardList,
  RefreshCw,
  Clock3,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";

type AssignmentStatus = "published" | "closed";

interface StudentAssignment {
  id: string;
  title: string;
  type: string;
  dueDate: string | null;
  status: AssignmentStatus;
  maxScore: number;
  subject: { id: string; name: string } | null;
}

function getStatusBadge(status: AssignmentStatus) {
  if (status === "closed") {
    return (
      <Badge
        variant="outline"
        className="border-slate-500/30 bg-slate-500/10 text-slate-300"
      >
        Closed
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    >
      Open
    </Badge>
  );
}

function dueDateLabel(dueDate: string | null) {
  if (!dueDate) return "No due date";
  const due = new Date(dueDate);
  return `${format(due, "EEE, MMM d • h:mm a")} (${formatDistanceToNowStrict(
    due,
    { addSuffix: true }
  )})`;
}

export default function StudentAssignmentsPage() {
  const [statusFilter, setStatusFilter] = React.useState<"all" | AssignmentStatus>(
    "all"
  );
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [assignments, setAssignments] = React.useState<StudentAssignment[]>([]);

  const loadAssignments = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/student/assignments", {
        cache: "no-store",
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to load assignments");
      }

      setAssignments(payload.data?.assignments || []);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load assignments"
      );
      setAssignments([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  const filteredAssignments = React.useMemo(() => {
    if (statusFilter === "all") return assignments;
    return assignments.filter((assignment) => assignment.status === statusFilter);
  }, [assignments, statusFilter]);

  const openCount = assignments.filter(
    (assignment) => assignment.status === "published"
  ).length;
  const closedCount = assignments.filter(
    (assignment) => assignment.status === "closed"
  ).length;

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white md:text-3xl">
            Assignments
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Track deadlines and submit your work on time.
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => void loadAssignments()}
          className="border-white/10 bg-white/5 hover:bg-white/10"
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl border border-white/10 bg-white/5">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-white/40">Total</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {assignments.length}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-emerald-300/80">
              Open
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-200">
              {openCount}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-slate-500/20 bg-slate-500/5">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-slate-300/80">
              Closed
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-200">
              {closedCount}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
        <CardHeader className="border-b border-white/5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg text-white">Assignment List</CardTitle>
            <PremiumSelect
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as "all" | AssignmentStatus)
              }
            >
              <PremiumSelectTrigger className="w-[170px]">
                <PremiumSelectValue placeholder="Filter status" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="all">All Statuses</PremiumSelectItem>
                <PremiumSelectItem value="published">Open</PremiumSelectItem>
                <PremiumSelectItem value="closed">Closed</PremiumSelectItem>
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, index) => (
                <Skeleton key={index} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
              <p className="text-sm text-red-200">{error}</p>
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/5">
                <ClipboardList className="h-7 w-7 text-white/30" />
              </div>
              <p className="text-sm text-white/50">No assignments found.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex flex-col gap-4 rounded-xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-white">
                        {assignment.title}
                      </p>
                      {getStatusBadge(assignment.status)}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/50">
                      {assignment.subject?.name && <span>{assignment.subject.name}</span>}
                      {assignment.subject?.name && <span>•</span>}
                      <span className="capitalize">{assignment.type}</span>
                      <span>•</span>
                      <span>Max score: {assignment.maxScore}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-white/45">
                      <Clock3 className="h-3.5 w-3.5" />
                      <span>{dueDateLabel(assignment.dueDate)}</span>
                    </div>
                  </div>

                  <Link href={`/student/assignments/${assignment.id}`}>
                    <Button
                      size="sm"
                      className="bg-brand text-brand-foreground hover:bg-brand/90"
                    >
                      Open
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
