"use client";

import * as React from "react";
import Link from "next/link";
import { ClipboardCheck, FileCheck2, FolderKanban } from "lucide-react";
import { useTeacherAssignments } from "@/hooks/teacher/useTeacherAssignments";
import { useTeacherSubmissions } from "@/hooks/teacher/useTeacherSubmissions";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";

export default function TeacherSubmissionsPage() {
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [assignmentFilter, setAssignmentFilter] = React.useState("all");

  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canGrade = can(permissions, PERMISSIONS.assignmentsGrade);

  const { data: assignmentsData } = useTeacherAssignments();
  const { data, isLoading } = useTeacherSubmissions({
    status: statusFilter === "all" ? undefined : statusFilter,
    assignmentId: assignmentFilter === "all" ? undefined : assignmentFilter,
  });

  const assignments = assignmentsData?.data.assignments || [];
  const submissions = data?.data.submissions || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Submissions</h1>
          <p className="text-sm text-white/60">Review student work across all assignments.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <PremiumSelect value={statusFilter} onValueChange={setStatusFilter}>
            <PremiumSelectTrigger icon={<ClipboardCheck className="h-4 w-4" />}>
              <PremiumSelectValue placeholder="Status" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              <PremiumSelectItem value="all">All status</PremiumSelectItem>
              <PremiumSelectItem value="submitted">Submitted</PremiumSelectItem>
              <PremiumSelectItem value="late">Late</PremiumSelectItem>
              <PremiumSelectItem value="graded">Graded</PremiumSelectItem>
              <PremiumSelectItem value="returned">Returned</PremiumSelectItem>
            </PremiumSelectContent>
          </PremiumSelect>
          <PremiumSelect value={assignmentFilter} onValueChange={setAssignmentFilter}>
            <PremiumSelectTrigger icon={<FolderKanban className="h-4 w-4" />}>
              <PremiumSelectValue placeholder="Assignment" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              <PremiumSelectItem value="all">All assignments</PremiumSelectItem>
              {assignments.map((assignment) => (
                <PremiumSelectItem key={assignment.id} value={assignment.id}>
                  {assignment.title}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
        </div>
      </div>

      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg">Submission inbox</CardTitle>
        </CardHeader>
        <CardContent>
          {!canGrade && (
            <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
              You can review submissions, but grading is disabled for your role.
            </div>
          )}
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="h-20 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
              ))}
            </div>
          ) : submissions.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/60">
              No submissions match this filter.
            </div>
          ) : (
            <div className="space-y-3">
              {submissions.map((submission) => (
                <Link
                  key={submission.id}
                  href={`/teacher/studio/submissions/${submission.id}`}
                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {submission.student?.name || "Student"}
                    </div>
                    <div className="text-xs text-white/50">
                      {submission.assignment?.title || "Assignment"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/60">
                    <span className="inline-flex items-center gap-2">
                      <FileCheck2 className="h-4 w-4 text-emerald-300" />
                      {submission.score !== null ? `${submission.score} pts` : "Ungraded"}
                    </span>
                    <span>{submission.status.replace(/_/g, " ")}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
