"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  AlertTriangle,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  SquareCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import {
  glassInsetClass,
  glassPrimaryButtonClass,
  glassSecondaryButtonClass,
} from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import {
  useAcknowledgeInvigilationDuty,
  useMarkExamCompleted,
  useMarkExamStarted,
  useReportExamIncident,
  useTeacherExamMarksPending,
  useTeacherExamSummary,
  useTeacherExamTimetable,
  useTeacherInvigilationDuties,
} from "@/hooks/teacher/useTeacherExams";
import { ExamIncidentReportModal } from "@/components/teacher/exams/ExamIncidentReportModal";
import type {
  TeacherExamInvigilationDutyDTO,
  TeacherExamMarksPendingDTO,
  TeacherExamTimetableEntryDTO,
} from "@/types/academics/exam-scheduling-engine";

function formatExamDate(value: string) {
  return format(new Date(value), "EEE, d MMM yyyy");
}

function formatVenueLabel(input: {
  venueName: string | null;
  roomLabel: string | null;
}) {
  if (input.venueName && input.roomLabel) {
    return `${input.venueName} · ${input.roomLabel}`;
  }
  return input.venueName || input.roomLabel || "Venue to be confirmed";
}

function roleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function statusBadgeClass(status: string) {
  if (status === "acknowledged" || status === "completed") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }
  if (status === "assigned") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }
  return "border-white/15 bg-white/5 text-white/70";
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <GlassPanel className="p-6 sm:p-8">
      <div className="mx-auto max-w-md space-y-3 text-center">
        <p className="text-base font-medium text-white">{title}</p>
        <p className="text-sm text-white/60">{description}</p>
        {action ? <div className="pt-2">{action}</div> : null}
      </div>
    </GlassPanel>
  );
}

function LoadingCards() {
  return (
    <div className="grid gap-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <GlassPanel key={index} className="p-5">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-1/3 rounded bg-white/10" />
            <div className="h-3 w-2/3 rounded bg-white/10" />
            <div className="h-3 w-1/2 rounded bg-white/10" />
          </div>
        </GlassPanel>
      ))}
    </div>
  );
}

function TimetableCard({ entry }: { entry: TeacherExamTimetableEntryDTO }) {
  return (
    <GlassPanel className="p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-100">
              {entry.examSessionName}
            </Badge>
            <Badge className={statusBadgeClass(entry.status)}>{entry.status.replace("_", " ")}</Badge>
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">
              {entry.title || entry.subjectName || "Exam paper"}
            </h3>
            <p className="mt-1 text-sm text-white/60">
              {entry.classGroupNames.join(", ") || "Class groups pending"}
            </p>
          </div>
          <div className="grid gap-2 text-sm text-white/75 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 shrink-0 text-cyan-300" />
              <span>{formatExamDate(entry.date)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 shrink-0 text-cyan-300" />
              <span>
                {entry.startTime} – {entry.endTime}
              </span>
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <MapPin className="h-4 w-4 shrink-0 text-cyan-300" />
              <span>{formatVenueLabel(entry)}</span>
            </div>
          </div>
          {entry.instructionsForStudents ? (
            <div className={cn(glassInsetClass, "p-3 text-sm text-white/70")}>
              <p className="font-medium text-white/85">Student instructions</p>
              <p className="mt-1 whitespace-pre-wrap">{entry.instructionsForStudents}</p>
            </div>
          ) : null}
        </div>
      </div>
    </GlassPanel>
  );
}

function InvigilationDutyCard({
  duty,
  onAcknowledge,
  onMarkStarted,
  onMarkCompleted,
  onReportIncident,
  acknowledging,
  markingStarted,
  markingCompleted,
}: {
  duty: TeacherExamInvigilationDutyDTO;
  onAcknowledge: (assignmentId: string) => void;
  onMarkStarted: (entryId: string) => void;
  onMarkCompleted: (entryId: string) => void;
  onReportIncident: (duty: TeacherExamInvigilationDutyDTO) => void;
  acknowledging: boolean;
  markingStarted: boolean;
  markingCompleted: boolean;
}) {
  return (
    <GlassPanel className="p-4 sm:p-5">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border-violet-500/30 bg-violet-500/10 text-violet-100">
            {roleLabel(duty.assignment.role)}
          </Badge>
          <Badge className={statusBadgeClass(duty.assignment.status)}>
            {duty.assignment.status}
          </Badge>
        </div>

        <div>
          <h3 className="text-base font-semibold text-white">
            {duty.entryTitle || duty.subjectName || "Invigilation duty"}
          </h3>
          <p className="mt-1 text-sm text-white/60">
            {duty.classGroupNames.join(", ") || "Class groups pending"}
          </p>
        </div>

        <div className="grid gap-2 text-sm text-white/75 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-violet-300" />
            <span>{formatExamDate(duty.date)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 shrink-0 text-violet-300" />
            <span>
              {duty.startTime} – {duty.endTime}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <MapPin className="h-4 w-4 shrink-0 text-violet-300" />
            <span>{formatVenueLabel(duty)}</span>
          </div>
        </div>

        {duty.instructionsForInvigilators ? (
          <div className={cn(glassInsetClass, "p-3 text-sm text-white/70")}>
            <p className="font-medium text-white/85">Invigilator instructions</p>
            <p className="mt-1 whitespace-pre-wrap">{duty.instructionsForInvigilators}</p>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {duty.canAcknowledge ? (
            <Button
              className={cn("rounded-xl", glassPrimaryButtonClass)}
              disabled={acknowledging}
              onClick={() => onAcknowledge(duty.assignment.id)}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Acknowledge duty
            </Button>
          ) : null}
          {duty.dayOps.canMarkStarted ? (
            <Button
              variant="outline"
              className={cn("rounded-xl", glassSecondaryButtonClass)}
              disabled={markingStarted}
              onClick={() => onMarkStarted(duty.entryId)}
            >
              <PlayCircle className="mr-2 h-4 w-4" />
              Mark started
            </Button>
          ) : null}
          {duty.dayOps.canMarkCompleted ? (
            <Button
              variant="outline"
              className={cn("rounded-xl", glassSecondaryButtonClass)}
              disabled={markingCompleted}
              onClick={() => onMarkCompleted(duty.entryId)}
            >
              <SquareCheck className="mr-2 h-4 w-4" />
              Mark completed
            </Button>
          ) : null}
          {duty.dayOps.canReportIncident ? (
            <Button
              variant="outline"
              className={cn("rounded-xl", glassSecondaryButtonClass)}
              onClick={() => onReportIncident(duty)}
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Report incident
            </Button>
          ) : null}
          <Button
            asChild
            variant="outline"
            className={cn("rounded-xl", glassSecondaryButtonClass)}
          >
            <Link href="/teacher/communication/escalations">
              Report issue
            </Link>
          </Button>
        </div>
      </div>
    </GlassPanel>
  );
}

function MarksPendingCard({ item }: { item: TeacherExamMarksPendingDTO }) {
  return (
    <GlassPanel className="p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-100">
              Marks pending
            </Badge>
            <Badge className="border-white/15 bg-white/5 text-white/70">
              {item.missingScoreCount} of {item.studentCount} missing
            </Badge>
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">{item.assessmentItemTitle}</h3>
            <p className="mt-1 text-sm text-white/60">
              {item.classGroupName || "Class"} · {item.subjectName || "Subject"}
            </p>
          </div>
          <div className="grid gap-2 text-sm text-white/75 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 shrink-0 text-amber-300" />
              <span>{formatExamDate(item.examDate)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 shrink-0 text-amber-300" />
              <span>{item.examStartTime}</span>
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Users className="h-4 w-4 shrink-0 text-amber-300" />
              <span>{item.examSessionName}</span>
            </div>
          </div>
        </div>
        <Button asChild className={cn("rounded-xl shrink-0", glassPrimaryButtonClass)}>
          <Link href={item.gradebookPath}>
            <BookOpenCheck className="mr-2 h-4 w-4" />
            Enter marks
          </Link>
        </Button>
      </div>
    </GlassPanel>
  );
}

export function TeacherMyExamsPageContent() {
  const [activeTab, setActiveTab] = React.useState("timetable");
  const [incidentDuty, setIncidentDuty] = React.useState<TeacherExamInvigilationDutyDTO | null>(
    null
  );
  const summaryQuery = useTeacherExamSummary();
  const timetableQuery = useTeacherExamTimetable();
  const dutiesQuery = useTeacherInvigilationDuties();
  const marksQuery = useTeacherExamMarksPending();
  const acknowledgeMutation = useAcknowledgeInvigilationDuty();
  const startMutation = useMarkExamStarted();
  const completeMutation = useMarkExamCompleted();
  const incidentMutation = useReportExamIncident();

  const summary = summaryQuery.data?.data;
  const isRefreshing =
    summaryQuery.isFetching ||
    timetableQuery.isFetching ||
    dutiesQuery.isFetching ||
    marksQuery.isFetching;

  const handleRefresh = () => {
    void summaryQuery.refetch();
    void timetableQuery.refetch();
    void dutiesQuery.refetch();
    void marksQuery.refetch();
  };

  const handleAcknowledge = async (assignmentId: string) => {
    try {
      await acknowledgeMutation.mutateAsync(assignmentId);
      toast.success("Invigilation duty acknowledged");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to acknowledge duty");
    }
  };

  const handleMarkStarted = async (entryId: string) => {
    try {
      await startMutation.mutateAsync(entryId);
      toast.success("Exam marked as started");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to mark exam as started");
    }
  };

  const handleMarkCompleted = async (entryId: string) => {
    try {
      await completeMutation.mutateAsync(entryId);
      toast.success("Exam marked as completed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to mark exam as completed");
    }
  };

  const handleReportIncident = async (input: {
    type: string;
    severity: string;
    description: string;
    actionTaken?: string | null;
  }) => {
    if (!incidentDuty) return;
    try {
      await incidentMutation.mutateAsync({
        entryId: incidentDuty.entryId,
        ...input,
      });
      toast.success("Incident report submitted");
      setIncidentDuty(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to report incident");
    }
  };

  const timetable = timetableQuery.data?.data ?? [];
  const duties = dutiesQuery.data?.data ?? [];
  const marksPending = marksQuery.data?.data ?? [];

  return (
    <div className="mx-auto w-full max-w-[1200px] p-4 md:p-6">
      <WorkspacePageShell>
        <WorkspacePageHeader
          iconName="calendar-check-2"
          title="My Exams"
          subtitle="Published exam timetable, invigilation duties, and exam marks still waiting for entry."
          actions={
            <Button
              variant="outline"
              size="sm"
              className={cn("rounded-xl", glassSecondaryButtonClass)}
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
              Refresh
            </Button>
          }
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <GlassPanel className="p-4">
            <p className="text-xs uppercase tracking-wide text-white/50">Upcoming exams</p>
            <p className="mt-2 text-2xl font-semibold text-cyan-100">
              {summaryQuery.isLoading ? "—" : summary?.upcomingTimetableCount ?? 0}
            </p>
          </GlassPanel>
          <GlassPanel className="p-4">
            <p className="text-xs uppercase tracking-wide text-white/50">Acknowledgements due</p>
            <p className="mt-2 text-2xl font-semibold text-violet-100">
              {summaryQuery.isLoading ? "—" : summary?.pendingAcknowledgementCount ?? 0}
            </p>
          </GlassPanel>
          <GlassPanel className="p-4">
            <p className="text-xs uppercase tracking-wide text-white/50">Marks pending</p>
            <p className="mt-2 text-2xl font-semibold text-amber-100">
              {summaryQuery.isLoading ? "—" : summary?.marksPendingCount ?? 0}
            </p>
          </GlassPanel>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
            <TabsTrigger
              value="timetable"
              className="rounded-xl data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-100"
            >
              My Timetable
            </TabsTrigger>
            <TabsTrigger
              value="duties"
              className="rounded-xl data-[state=active]:bg-violet-500/15 data-[state=active]:text-violet-100"
            >
              Invigilation Duties
            </TabsTrigger>
            <TabsTrigger
              value="marks"
              className="rounded-xl data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-100"
            >
              Marks Pending
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timetable" className="space-y-4">
            {timetableQuery.isLoading ? (
              <LoadingCards />
            ) : timetableQuery.isError ? (
              <EmptyState
                title="Could not load timetable"
                description={
                  timetableQuery.error instanceof Error
                    ? timetableQuery.error.message
                    : "Try refreshing the page."
                }
              />
            ) : timetable.length === 0 ? (
              <EmptyState
                title="No published exams for your classes yet"
                description="When the school publishes an exam timetable for your class subjects, it will appear here."
              />
            ) : (
              <div className="grid gap-4">
                {timetable.map((entry) => (
                  <TimetableCard key={entry.entryId} entry={entry} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="duties" className="space-y-4">
            {dutiesQuery.isLoading ? (
              <LoadingCards />
            ) : dutiesQuery.isError ? (
              <EmptyState
                title="Could not load invigilation duties"
                description={
                  dutiesQuery.error instanceof Error
                    ? dutiesQuery.error.message
                    : "Try refreshing the page."
                }
              />
            ) : duties.length === 0 ? (
              <EmptyState
                title="No invigilation duties assigned"
                description="When you are assigned to invigilate an exam paper, the duty will appear here with acknowledge and reporting actions."
                action={
                  <div className="inline-flex items-center gap-2 text-sm text-white/50">
                    <ShieldCheck className="h-4 w-4" />
                    Only your assigned duties are shown.
                  </div>
                }
              />
            ) : (
              <div className="grid gap-4">
                {duties.map((duty) => (
                  <InvigilationDutyCard
                    key={duty.assignment.id}
                    duty={duty}
                    onAcknowledge={handleAcknowledge}
                    onMarkStarted={handleMarkStarted}
                    onMarkCompleted={handleMarkCompleted}
                    onReportIncident={setIncidentDuty}
                    acknowledging={acknowledgeMutation.isPending}
                    markingStarted={startMutation.isPending}
                    markingCompleted={completeMutation.isPending}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="marks" className="space-y-4">
            {marksQuery.isLoading ? (
              <LoadingCards />
            ) : marksQuery.isError ? (
              <EmptyState
                title="Could not load marks pending"
                description={
                  marksQuery.error instanceof Error
                    ? marksQuery.error.message
                    : "Try refreshing the page."
                }
              />
            ) : marksPending.length === 0 ? (
              <EmptyState
                title="No exam marks waiting"
                description="After an exam date passes, linked assessment items with missing scores will appear here."
              />
            ) : (
              <div className="grid gap-4">
                {marksPending.map((item) => (
                  <MarksPendingCard key={item.assessmentItemId} item={item} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <ExamIncidentReportModal
          open={Boolean(incidentDuty)}
          onOpenChange={(open) => {
            if (!open) setIncidentDuty(null);
          }}
          dutyTitle={incidentDuty?.entryTitle || incidentDuty?.subjectName || "this exam"}
          submitting={incidentMutation.isPending}
          onSubmit={handleReportIncident}
        />
      </WorkspacePageShell>
    </div>
  );
}
