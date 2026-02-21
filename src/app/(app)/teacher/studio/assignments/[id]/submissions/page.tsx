"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { useAssignmentSubmissions } from "@/hooks/teacher/useAssignmentSubmissions";
import { SubmissionInbox } from "@/components/teacher/studio/SubmissionInbox";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AssignmentSubmissionsPage() {
  const params = useParams();
  const assignmentId = params?.id as string | undefined;
  const [statusFilter, setStatusFilter] = React.useState("all");

  const { data, isLoading } = useAssignmentSubmissions(assignmentId);
  const submissions = data?.data.submissions || [];
  const assignment = data?.data.assignment;
  const assignmentType = (assignment as { type?: string } | undefined)?.type;

  if (!isLoading && assignmentType === "quiz") {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
          This item is a quiz and submissions are managed in the Quizzes section.
        </div>
        <Button asChild className="w-fit bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30">
          <Link href={`/teacher/studio/quizzes/${assignmentId || ""}/submissions`}>
            Open quiz submissions
          </Link>
        </Button>
      </div>
    );
  }

  const filtered = statusFilter === "all"
    ? submissions
    : submissions.filter((submission) => submission.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href={`/teacher/studio/assignments/${assignmentId}`}
            className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to assignment
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white">Submissions</h1>
          <p className="text-sm text-white/60">{assignment?.title || "Assignment"}</p>
        </div>
        <PremiumSelect value={statusFilter} onValueChange={setStatusFilter}>
          <PremiumSelectTrigger icon={<ClipboardCheck className="h-4 w-4" />}>
            <PremiumSelectValue placeholder="Filter status" />
          </PremiumSelectTrigger>
          <PremiumSelectContent>
            <PremiumSelectItem value="all">All submissions</PremiumSelectItem>
            <PremiumSelectItem value="submitted">Submitted</PremiumSelectItem>
            <PremiumSelectItem value="late">Late</PremiumSelectItem>
            <PremiumSelectItem value="graded">Graded</PremiumSelectItem>
            <PremiumSelectItem value="returned">Returned</PremiumSelectItem>
          </PremiumSelectContent>
        </PremiumSelect>
      </div>

      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg">Submission inbox</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className="h-20 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
              ))}
            </div>
          ) : (
            <SubmissionInbox submissions={filtered} hrefBase="/teacher/studio/submissions" />
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button asChild className="bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30">
          <Link href={`/teacher/studio/submissions?assignmentId=${assignmentId || ""}`}>
            View all submissions
          </Link>
        </Button>
      </div>
    </div>
  );
}
