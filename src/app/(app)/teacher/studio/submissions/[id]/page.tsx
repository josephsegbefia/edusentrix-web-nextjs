"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarDays, UserCircle2 } from "lucide-react";
import { useSubmissionDetail } from "@/hooks/teacher/useSubmissionDetail";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { MarkingPanel } from "@/components/teacher/studio/MarkingPanel";
import { SubmissionViewer } from "@/components/teacher/studio/SubmissionViewer";
import { BulkGrading } from "@/components/teacher/studio/BulkGrading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";

export default function SubmissionDetailPage() {
  const params = useParams();
  const submissionId = params?.id as string | undefined;
  const busyToast = useBusyToast();
  const { data, isLoading, refetch } = useSubmissionDetail(submissionId);
  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canGrade = can(permissions, PERMISSIONS.assignmentsGrade);

  const submission = data?.data.submission;
  const assignment = data?.data.assignment;

  const [score, setScore] = React.useState<number | null>(null);
  const [feedback, setFeedback] = React.useState("");
  const [rubricScores, setRubricScores] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    if (!submission) return;
    setScore(submission.score ?? null);
    setFeedback(submission.feedback || "");
    setRubricScores(submission.rubricScores || {});
  }, [submission]);

  const handleSave = async (publish?: boolean) => {
    if (!submissionId) return;
    await busyToast.promise(
      fetch(`/api/teacher/studio/submissions/${submissionId}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score,
          feedback,
          rubricScores,
          publish: Boolean(publish),
        }),
      }).then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to save grade");
        return data;
      }),
      {
        loading: publish ? "Publishing grade..." : "Saving grade...",
        success: publish ? "Grade published" : "Grade saved",
        error: "Failed to save grade",
      }
    );
    await refetch();
  };

  const handleReturn = async (reason: string) => {
    if (!reason.trim()) {
      busyToast.warning("Provide a return reason.");
      return;
    }
    if (!submissionId) return;
    await busyToast.promise(
      fetch(`/api/teacher/studio/submissions/${submissionId}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      }).then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to return submission");
        return data;
      }),
      {
        loading: "Returning submission...",
        success: "Submission returned",
        error: "Failed to return submission",
      }
    );
    await refetch();
  };

  if (isLoading || !submission || !assignment) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="h-64 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
          <div className="h-64 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-linear-to-br from-white/5 to-transparent p-6 shadow-2xl shadow-black/30 backdrop-blur">
        <Link href="/teacher/studio/submissions" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to submissions
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">{assignment.title}</h1>
            <p className="text-sm text-white/60">{assignment.subject?.name || "Subject"}</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
            <UserCircle2 className="h-4 w-4 text-white/40" />
            {submission.student?.name || "Student"}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-white/60">
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-white/40" />
            {assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : "No due date"}
          </span>
          <span className="text-xs uppercase tracking-[0.2em]">Status: {submission.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-lg">Submission</CardTitle>
            </CardHeader>
            <CardContent>
              <SubmissionViewer
                content={submission.content}
                attachments={submission.attachments}
                questions={assignment.questions || []}
                questionResponses={submission.questionResponses || []}
              />
            </CardContent>
          </Card>

          <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-lg">Bulk workflow</CardTitle>
            </CardHeader>
            <CardContent>
              <BulkGrading />
            </CardContent>
          </Card>
        </div>

        {canGrade ? (
          <MarkingPanel
            maxScore={assignment.maxScore}
            score={score}
            feedback={feedback}
            rubric={assignment.rubric || null}
            rubricScores={rubricScores}
            onScoreChange={setScore}
            onFeedbackChange={setFeedback}
            onRubricScoresChange={setRubricScores}
            onSave={handleSave}
            onReturn={handleReturn}
          />
        ) : (
          <Card className="border border-white/10 bg-white/5">
            <CardContent className="p-6 text-center text-white/70">
              You do not have permission to grade submissions.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
