"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FolderKanban,
  Search,
  Sparkles,
  UserCircle2,
  XCircle,
} from "lucide-react";
import { useTeacherAssignments } from "@/hooks/teacher/useTeacherAssignments";
import { useTeacherSubmissions } from "@/hooks/teacher/useTeacherSubmissions";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";

const STATUS_OPTIONS = [
  { value: "all", label: "All status" },
  { value: "submitted", label: "Submitted" },
  { value: "late", label: "Late" },
  { value: "graded", label: "Graded" },
  { value: "returned", label: "Returned" },
];

const STATUS_BADGE_STYLES: Record<string, string> = {
  submitted: "bg-sky-500/20 text-sky-200",
  late: "bg-amber-500/20 text-amber-200",
  graded: "bg-emerald-500/20 text-emerald-200",
  returned: "bg-rose-500/20 text-rose-200",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString();
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not submitted";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not submitted";
  return parsed.toLocaleString();
}

function initialsFromName(name?: string | null) {
  if (!name) return "ST";
  const segments = name
    .split(" ")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .slice(0, 2);
  if (segments.length === 0) return "ST";
  return segments.map((segment) => segment[0]?.toUpperCase() || "").join("") || "ST";
}

export default function TeacherSubmissionsPage() {
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [assignmentFilter, setAssignmentFilter] = React.useState("all");
  const [subjectFilter, setSubjectFilter] = React.useState("all");
  const [classGroupFilter, setClassGroupFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");

  const { data: contextData } = useTeacherContext();
  const { data: classesData } = useTeacherClasses();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canGrade = can(permissions, PERMISSIONS.assignmentsGrade);

  const { data: assignmentsData } = useTeacherAssignments();
  const { data, isLoading } = useTeacherSubmissions({
    status: statusFilter === "all" ? undefined : statusFilter,
    assignmentId: assignmentFilter === "all" ? undefined : assignmentFilter,
    subjectId: subjectFilter === "all" ? undefined : subjectFilter,
    classGroupId: classGroupFilter === "all" ? undefined : classGroupFilter,
  });

  const assignments = React.useMemo(() => assignmentsData?.data.assignments ?? [], [assignmentsData]);
  const submissions = React.useMemo(() => data?.data.submissions ?? [], [data]);

  const subjects = React.useMemo(() => {
    const entries = new Map<string, string>();
    (classesData?.data.classes || []).forEach((item) => {
      if (item.subjectId && item.subjectName) {
        entries.set(item.subjectId, item.subjectName);
      }
    });
    return Array.from(entries.entries()).map(([id, name]) => ({ id, name }));
  }, [classesData]);

  const classGroups = React.useMemo(() => {
    const entries = new Map<string, string>();
    (classesData?.data.classes || []).forEach((item) => {
      if (item._id && item.name) {
        entries.set(item._id, item.name);
      }
    });
    return Array.from(entries.entries()).map(([id, name]) => ({ id, name }));
  }, [classesData]);

  const filteredSubmissions = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return submissions;

    return submissions.filter((submission) => {
      const studentName = submission.student?.name?.toLowerCase() || "";
      const admissionNo = submission.student?.admissionNo?.toLowerCase() || "";
      const assignmentTitle = submission.assignment?.title?.toLowerCase() || "";
      const subjectName = submission.assignment?.subject?.name?.toLowerCase() || "";

      return (
        studentName.includes(query) ||
        admissionNo.includes(query) ||
        assignmentTitle.includes(query) ||
        subjectName.includes(query)
      );
    });
  }, [search, submissions]);

  const stats = React.useMemo(() => {
    const total = submissions.length;
    const pending = submissions.filter(
      (submission) => submission.status === "submitted" || submission.status === "late"
    ).length;
    const graded = submissions.filter(
      (submission) => submission.status === "graded" || submission.score !== null
    ).length;
    const returned = submissions.filter((submission) => submission.status === "returned").length;

    return { total, pending, graded, returned };
  }, [submissions]);

  const nextPendingSubmission = React.useMemo(
    () => submissions.find((submission) => submission.status === "submitted" || submission.status === "late") || null,
    [submissions]
  );

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border border-white/10 bg-linear-to-br from-indigo-500/15 via-white/5 to-cyan-500/10 shadow-2xl shadow-black/35 backdrop-blur">
        <CardContent className="grid gap-5 p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="space-y-3">
            <Badge className="w-fit bg-white/10 text-white/80">
              <Sparkles className="h-3.5 w-3.5" />
              Studio review
            </Badge>
            <div>
              <h1 className="text-2xl font-semibold text-white">Submissions</h1>
              <p className="text-sm text-white/65">
                Review student work across all assignments with a cleaner grading queue.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-indigo-500/20 text-indigo-100">{stats.total} total</Badge>
              <Badge className="bg-amber-500/20 text-amber-100">{stats.pending} pending</Badge>
              <Badge className="bg-emerald-500/20 text-emerald-100">{stats.graded} graded</Badge>
              <Badge className="bg-rose-500/20 text-rose-100">{stats.returned} returned</Badge>
            </div>
          </div>

          <div className="flex flex-col gap-2 lg:items-end">
            {nextPendingSubmission ? (
              <Button
                asChild
                className="bg-indigo-500/30 text-indigo-50 hover:bg-indigo-500/40"
              >
                <Link href={`/teacher/studio/submissions/${nextPendingSubmission.id}`}>
                  Open next pending
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
                No pending submissions right now
              </div>
            )}
            <p className="text-xs text-white/45">Tip: use filters to focus by class or subject.</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-white/10 bg-white/5 backdrop-blur">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="rounded-xl border border-amber-400/25 bg-amber-500/20 p-2.5 text-amber-100">
              <Clock3 className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">Pending</p>
              <p className="text-xl font-semibold text-white">{stats.pending}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-white/10 bg-white/5 backdrop-blur">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="rounded-xl border border-emerald-400/25 bg-emerald-500/20 p-2.5 text-emerald-100">
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">Graded</p>
              <p className="text-xl font-semibold text-white">{stats.graded}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-white/10 bg-white/5 backdrop-blur">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="rounded-xl border border-rose-400/25 bg-rose-500/20 p-2.5 text-rose-100">
              <XCircle className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">Returned</p>
              <p className="text-xl font-semibold text-white">{stats.returned}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-white/10 bg-white/5 backdrop-blur">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="rounded-xl border border-indigo-400/25 bg-indigo-500/20 p-2.5 text-indigo-100">
              <FileCheck2 className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">Total</p>
              <p className="text-xl font-semibold text-white">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg">Filter submissions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <PremiumSelect value={statusFilter} onValueChange={setStatusFilter}>
              <PremiumSelectTrigger icon={<ClipboardCheck className="h-4 w-4" />}>
                <PremiumSelectValue placeholder="Status" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <PremiumSelectItem key={option.value} value={option.value}>
                    {option.label}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>

            <PremiumSelect value={subjectFilter} onValueChange={setSubjectFilter}>
              <PremiumSelectTrigger icon={<FolderKanban className="h-4 w-4" />}>
                <PremiumSelectValue placeholder="Subject" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="all">All subjects</PremiumSelectItem>
                {subjects.map((subject) => (
                  <PremiumSelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>

            <PremiumSelect value={classGroupFilter} onValueChange={setClassGroupFilter}>
              <PremiumSelectTrigger icon={<UserCircle2 className="h-4 w-4" />}>
                <PremiumSelectValue placeholder="Class group" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="all">All class groups</PremiumSelectItem>
                {classGroups.map((classGroup) => (
                  <PremiumSelectItem key={classGroup.id} value={classGroup.id}>
                    {classGroup.name}
                  </PremiumSelectItem>
                ))}
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

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search student or assignment"
                className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-white/35"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
              onClick={() => {
                setStatusFilter("all");
                setSubjectFilter("all");
                setClassGroupFilter("all");
                setAssignmentFilter("all");
                setSearch("");
              }}
            >
              Reset filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {!canGrade && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          You can review submissions, but grading is disabled for your role.
        </div>
      )}

      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg">Submission inbox</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="h-20 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
              ))}
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/60">
              No submissions match this filter.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSubmissions.map((submission) => (
                <Link
                  key={submission.id}
                  href={`/teacher/studio/submissions/${submission.id}`}
                  className="block rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 border border-white/10">
                        <AvatarImage
                          src={submission.student?.photoUrl}
                          alt={submission.student?.name || "Student"}
                        />
                        <AvatarFallback className="bg-white/10 text-xs text-white/80">
                          {initialsFromName(submission.student?.name)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-white">
                          {submission.student?.name || "Student"}
                        </div>
                        <div className="text-xs text-white/50">
                          {submission.assignment?.title || "Assignment"}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-white/45">
                          <span>{submission.assignment?.subject?.name || "Subject"}</span>
                          {submission.student?.admissionNo && (
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                              {submission.student.admissionNo}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 lg:items-end">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          className={cn(
                            "rounded-full px-2.5 py-0.5",
                            STATUS_BADGE_STYLES[submission.status] || "bg-white/10 text-white/70"
                          )}
                        >
                          {submission.status.replace(/_/g, " ").toUpperCase()}
                        </Badge>
                        {submission.isLate && (
                          <Badge className="rounded-full bg-amber-500/20 text-amber-200">
                            Late submission
                          </Badge>
                        )}
                        <Badge className="rounded-full bg-indigo-500/20 text-indigo-100">
                          {submission.score !== null ? `${submission.score} pts` : "Ungraded"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-white/55">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarClock className="h-3.5 w-3.5" />
                          Due {formatDate(submission.assignment?.dueDate)}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="h-3.5 w-3.5" />
                          {formatDateTime(submission.submittedAt)}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-200">
                        Open submission
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
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
