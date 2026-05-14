// src/components/admin/classes/detail/ClassSubjectsTeachersTab.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  UserPlus,
  UserCheck,
  Users,
  ExternalLink,
  MoreHorizontal,
  Loader2,
  AlertCircle,
  BookPlus,
  ArrowRight,
  AlertTriangle,
  Calendar,
  Clock,
  Trash2,
} from "lucide-react";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuTrigger,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuItem,
  PremiumDropdownMenuSeparator,
} from "@/components/ui/premium-dropdown-menu";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QuickAssignTeacherModal } from "@/components/modals/QuickAssignTeacherModal";
import { AssignSubjectScheduleModal } from "@/components/modals/AssignSubjectScheduleModal";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";

type ClassSubjectsTeachersTabProps = {
  classId: string;
  className: string;
  gradeId?: string | null;
  subjects: Array<{ id: string; subjectOfferingId?: string | null; name: string; code: string | null }>;
  onManageSubjects?: () => void;
  onOpenAssignmentWizard?: () => void;
};

type SubjectTeacherAssignment = {
  subjectId: string;
  subjectOfferingId: string | null;
  subjectName: string;
  subjectCode: string | null;
  teachers: Array<{
    id: string;
    assignmentId: string;
    contactHoursPerWeek: number | null;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string | null;
    photoUrl: string | null;
  }>;
};

type SubjectScheduleInfo = {
  assignmentId: string;
  teacherId: string;
  teacherName: string;
  teacherPhotoUrl: string | null;
  contactHoursPerWeek: number;
  schedulesCount: number;
};

export function ClassSubjectsTeachersTab({
  classId,
  className,
  gradeId,
  subjects,
  onManageSubjects,
  onOpenAssignmentWizard,
}: ClassSubjectsTeachersTabProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const busy = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();

  // State for quick assign modal
  const [quickAssignModalOpen, setQuickAssignModalOpen] = React.useState(false);
  const [selectedSubjectForAssign, setSelectedSubjectForAssign] = React.useState<{
    id: string;
    subjectOfferingId?: string | null;
    name: string;
    code: string | null;
    currentTeacherId?: string | null;
  } | null>(null);

  // State for contact-hours planning modal
  const [scheduleModalOpen, setScheduleModalOpen] = React.useState(false);
  const [selectedScheduleAssignment, setSelectedScheduleAssignment] = React.useState<{
    assignmentId: string;
    subjectId: string;
    subjectName: string;
    teacherId: string;
    teacherName: string;
    initialContactHours: number;
  } | null>(null);

  // Fetch subject-teacher assignments for this class
  const { data, isLoading, isError } = useQuery<{
    success: boolean;
    data: SubjectTeacherAssignment[];
  }>({
    queryKey: ["class-subject-teachers", classId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/classes/${classId}/subject-teachers`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch subject teachers");
      return res.json();
    },
    staleTime: 30_000,
  });

  // Fetch schedule information
  const { data: schedulesData } = useQuery<{
    success: boolean;
    data: SubjectScheduleInfo[];
  }>({
    queryKey: ["class-schedules", classId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/classes/${classId}/schedules`, {
        cache: "no-store",
      });
      if (!res.ok) return { success: true, data: [] };
      return res.json();
    },
    staleTime: 30_000,
  });

  const assignments = data?.data || [];
  const schedules = schedulesData?.data || [];

  const removeTeacherMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const res = await fetch("/api/admin/subjects/unassign-teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to remove teacher");
      }
      return json as { success: boolean; message?: string };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["class-subject-teachers", classId],
      });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["class", classId] });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    },
  });

  // Create a map of schedules by assignment ID
  const scheduleMap = React.useMemo(() => {
    const map = new Map<string, SubjectScheduleInfo>();
    schedules.forEach((s) => map.set(s.assignmentId, s));
    return map;
  }, [schedules]);

  // Create a map of subject assignments
  const assignmentMap = React.useMemo(() => {
    const map = new Map<string, SubjectTeacherAssignment>();
    assignments.forEach((a) => {
      map.set(a.subjectOfferingId || a.subjectId, a);
      map.set(a.subjectId, a);
    });
    return map;
  }, [assignments]);

  // Combine subjects with their assignments and schedule-derived progress
  const subjectAssignments = React.useMemo(() => {
    return subjects.map((subject) => {
      const assignment = assignmentMap.get(subject.subjectOfferingId || subject.id);
      const teachers = assignment?.teachers || [];

      // Get schedule info for each teacher assignment
      const teachersWithSchedules = teachers.map((teacher) => {
        const scheduleInfo = scheduleMap.get(teacher.assignmentId);
        return {
          ...teacher,
          scheduleInfo: scheduleInfo || null,
        };
      });

      return {
        ...subject,
        teachers: teachersWithSchedules as Array<{
          id: string;
          assignmentId: string;
          contactHoursPerWeek: number | null;
          firstName: string;
          lastName: string;
          fullName: string;
          email: string | null;
          photoUrl: string | null;
          scheduleInfo: SubjectScheduleInfo | null;
        }>,
      };
    });
  }, [subjects, assignmentMap, scheduleMap]);

  // Count stats
  const assignedSubjectsCount = subjectAssignments.filter(
    (s) => s.teachers.length > 0
  ).length;
  const unassignedSubjectsCount = subjectAssignments.filter(
    (s) => s.teachers.length === 0
  ).length;
  const totalTeachersCount = new Set(
    subjectAssignments.flatMap((s) => s.teachers.map((t) => t.id))
  ).size;
  const subjectsWithoutSchedules = subjectAssignments.filter(
    (s) =>
      s.teachers.length > 0 &&
      s.teachers.every((t) => !t.scheduleInfo || t.scheduleInfo.schedulesCount === 0)
  ).length;
  const subjectsWithContactHours = subjectAssignments.filter((s) =>
    s.teachers.some((t) => (t.contactHoursPerWeek ?? t.scheduleInfo?.contactHoursPerWeek ?? 0) > 0)
  ).length;

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase() || "?";
  };

  const handleViewTeacher = (teacherId: string) => {
    router.push(`/admin/teachers/${teacherId}`);
  };

  const handleOpenQuickAssign = (subject: {
    id: string;
    subjectOfferingId?: string | null;
    name: string;
    code: string | null;
    teachers: Array<{ id: string }>;
  }) => {
    setSelectedSubjectForAssign({
      id: subject.id,
      subjectOfferingId: subject.subjectOfferingId || null,
      name: subject.name,
      code: subject.code,
      currentTeacherId: subject.teachers[0]?.id || null,
    });
    setQuickAssignModalOpen(true);
  };

  const handleOpenScheduleModal = (
    assignmentId: string,
    subjectId: string,
    subjectName: string,
    teacherId: string,
    teacherName: string,
    initialContactHours: number
  ) => {
    setSelectedScheduleAssignment({
      assignmentId,
      subjectId,
      subjectName,
      teacherId,
      teacherName,
      initialContactHours,
    });
    setScheduleModalOpen(true);
  };

  const handleCloseScheduleModal = () => {
    setScheduleModalOpen(false);
    setSelectedScheduleAssignment(null);
  };

  const handleRemoveTeacher = async (
    assignmentId: string,
    teacherName: string,
    subjectName: string
  ) => {
    const decision = await confirm({
      title: "Remove Teacher?",
      description: `Remove ${teacherName} from ${subjectName} in ${className}? The subject offering will remain on the class.`,
      confirmLabel: "Remove Teacher",
      cancelLabel: "Keep Teacher",
      intent: "destructive",
    });
    if (decision !== "confirm") return;

    try {
      await busy.promise(removeTeacherMutation.mutateAsync(assignmentId), {
        loading: "Removing teacher...",
        success: `${teacherName} removed from ${subjectName}`,
        error: (e: Error) => e.message || "Failed to remove teacher",
      });
    } catch {
      // busy.promise handles the error toast
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Stats & Actions */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Subjects & Teachers
          </h2>
          <p className="text-sm text-white/50">
            Manage subject assignments and teaching staff for {className}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={onManageSubjects}
            className="gap-2 border-white/10 bg-white/5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
          >
            <BookPlus className="h-4 w-4" />
            Manage Subjects
          </Button>
          <Button
            onClick={onOpenAssignmentWizard}
            className="gap-2 bg-brand text-black hover:opacity-90"
          >
            <UserPlus className="h-4 w-4" />
            Bulk Assign Teachers
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/20 text-brand">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{subjects.length}</p>
              <p className="text-xs text-white/50">Total Subjects</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{assignedSubjectsCount}</p>
              <p className="text-xs text-white/50">With Teachers</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-300">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {assignedSubjectsCount - subjectsWithoutSchedules}
              </p>
              <p className="text-xs text-white/50">On Timetable</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 text-purple-300">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{totalTeachersCount}</p>
              <p className="text-xs text-white/50">Teachers</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Unassigned Warning */}
      {unassignedSubjectsCount > 0 && (
        <Card className="border border-amber-500/30 bg-amber-500/10 backdrop-blur">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
              <AlertTriangle className="h-5 w-5 text-amber-300" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-amber-200">
                {unassignedSubjectsCount} subject{unassignedSubjectsCount !== 1 ? "s" : ""} without a teacher
              </p>
              <p className="text-xs text-amber-200/70">
                Assign teachers to ensure all subjects are covered
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contact Hours Reminder */}
      {subjectsWithContactHours === 0 && unassignedSubjectsCount === 0 && assignedSubjectsCount > 0 && (
        <Card className="border border-blue-500/30 bg-blue-500/10 backdrop-blur">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20">
              <Clock className="h-5 w-5 text-blue-300" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-blue-200">
                Contact hours have not been set yet
              </p>
              <p className="text-xs text-blue-200/70">
                Set weekly contact-hour targets here. Actual lesson times should be created only on the Schedule tab.
              </p>
            </div>
            <Button
              onClick={() => router.push(`/admin/classes/${classId}?tab=schedule`)}
              size="sm"
              className="gap-2 bg-blue-500/20 text-blue-200 hover:bg-blue-500/30"
            >
              <Calendar className="h-3.5 w-3.5" />
              Open Schedule Tab
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Subject-Teacher List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
          <p className="mt-3 text-sm text-white/50">Loading assignments...</p>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16">
          <AlertCircle className="h-8 w-8 text-rose-400" />
          <p className="mt-3 text-sm font-medium text-white/70">
            Failed to load assignments
          </p>
        </div>
      ) : subjects.length === 0 ? (
        <Card className="border border-white/10 bg-slate-950/60 backdrop-blur">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <BookOpen className="h-8 w-8 text-white/30" />
            </div>
            <p className="mt-4 text-sm font-medium text-white/70">
              No subjects assigned to this class
            </p>
            <p className="mt-1 text-xs text-white/50">
              Add subjects first to assign teachers
            </p>
            <Button
              onClick={onManageSubjects}
              className="mt-4 gap-2 bg-brand text-black"
            >
              <BookPlus className="h-4 w-4" />
              Add Subjects
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {subjectAssignments.map((subject) => (
            <Card
              key={subject.id}
              className={cn(
                "border bg-gradient-to-br backdrop-blur transition-all",
                subject.teachers.length > 0
                  ? "border-white/10 from-slate-900/80 to-slate-950/90"
                  : "border-dashed border-white/10 from-slate-950/50 to-black/50"
              )}
            >
              <CardContent className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* Subject Info */}
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl",
                        subject.teachers.length > 0
                          ? "bg-brand/20 text-brand"
                          : "bg-white/5 text-white/30"
                      )}
                    >
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{subject.name}</p>
                      {subject.code && (
                        <p className="text-xs text-white/50">{subject.code}</p>
                      )}
                    </div>
                  </div>

                  {/* Teachers & Contact Hours */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                    {subject.teachers.length > 0 ? (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        {/* Stacked avatars for multiple teachers */}
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-2">
                            {subject.teachers.slice(0, 3).map((teacher, idx) => (
                              <Avatar
                                key={teacher.id}
                                className="h-8 w-8 border-2 border-slate-900 ring-0"
                                style={{ zIndex: 10 - idx }}
                              >
                                <AvatarImage
                                  src={teacher.photoUrl || ""}
                                  alt={teacher.fullName}
                                />
                                <AvatarFallback className="bg-linear-to-br from-brand/60 to-brand/40 text-[10px] font-semibold text-white">
                                  {getInitials(teacher.firstName, teacher.lastName)}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {subject.teachers.length > 3 && (
                              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-900 bg-white/10 text-[10px] font-medium text-white">
                                +{subject.teachers.length - 3}
                              </div>
                            )}
                          </div>

                          {/* Teacher names */}
                          <div className="hidden sm:block">
                            <p className="text-sm text-white">
                              {subject.teachers
                                .slice(0, 2)
                                .map((t) => t.fullName)
                                .join(", ")}
                              {subject.teachers.length > 2 &&
                                ` +${subject.teachers.length - 2}`}
                            </p>
                            {subject.teachers.length > 1 && (
                              <Badge
                                variant="outline"
                                className="mt-1 rounded-full border-purple-500/30 bg-purple-500/10 text-[10px] text-purple-300"
                              >
                                Co-teaching
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Contact-hour indicators and actions */}
                        <div className="flex flex-wrap items-center gap-2">
                          {subject.teachers.map((teacher) => {
                            const scheduleInfo = teacher.scheduleInfo;
                            const hasSchedule = scheduleInfo && scheduleInfo.schedulesCount > 0;
                            const contactHours =
                              teacher.contactHoursPerWeek ?? scheduleInfo?.contactHoursPerWeek ?? 0;

                            return (
                              <div
                                key={teacher.id}
                                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5"
                              >
                                <>
                                  {hasSchedule ? (
                                    <Badge
                                      variant="outline"
                                      className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-300"
                                    >
                                      <Calendar className="h-3 w-3" />
                                      {scheduleInfo.schedulesCount} slot{scheduleInfo.schedulesCount !== 1 ? "s" : ""}
                                    </Badge>
                                  ) : null}
                                  {contactHours > 0 ? (
                                    <Badge
                                      variant="outline"
                                      className="gap-1 border-blue-500/30 bg-blue-500/10 text-[10px] text-blue-300"
                                    >
                                      <Clock className="h-3 w-3" />
                                      {contactHours}h/week
                                    </Badge>
                                  ) : null}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleOpenScheduleModal(
                                        teacher.assignmentId,
                                        subject.id,
                                        subject.name,
                                        teacher.id,
                                        teacher.fullName,
                                        contactHours
                                      )
                                    }
                                    className="h-6 gap-1 border-dashed border-white/20 bg-transparent px-2 text-[10px] text-white/50 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-300"
                                  >
                                    <Clock className="h-3 w-3" />
                                    {contactHours > 0 ? "Edit hours" : "Set hours"}
                                  </Button>
                                </>
                              </div>
                            );
                          })}

                          {/* Actions dropdown */}
                          <PremiumDropdownMenu>
                            <PremiumDropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </PremiumDropdownMenuTrigger>
                            <PremiumDropdownMenuContent
                              align="end"
                              className="border border-white/10 bg-slate-900/95 text-xs text-slate-50 backdrop-blur-xl"
                            >
                              {subject.teachers.map((teacher) => (
                                <PremiumDropdownMenuItem
                                  key={teacher.id}
                                  onClick={() => handleViewTeacher(teacher.id)}
                                  className="cursor-pointer gap-2"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  View {teacher.fullName}
                                </PremiumDropdownMenuItem>
                              ))}
                              {subject.teachers.length > 0 && (
                                <PremiumDropdownMenuSeparator className="bg-white/10" />
                              )}
                              {subject.teachers.map((teacher) => (
                                <PremiumDropdownMenuItem
                                  key={`${teacher.assignmentId}-remove`}
                                  onClick={() =>
                                    handleRemoveTeacher(
                                      teacher.assignmentId,
                                      teacher.fullName,
                                      subject.name
                                    )
                                  }
                                  className="cursor-pointer gap-2 text-rose-200 focus:text-rose-100"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Remove {teacher.fullName}
                                </PremiumDropdownMenuItem>
                              ))}
                              <PremiumDropdownMenuSeparator className="bg-white/10" />
                              <PremiumDropdownMenuItem
                                onClick={() => handleOpenQuickAssign(subject)}
                                className="cursor-pointer gap-2"
                              >
                                <UserPlus className="h-3.5 w-3.5" />
                                Change Teacher
                              </PremiumDropdownMenuItem>
                            </PremiumDropdownMenuContent>
                          </PremiumDropdownMenu>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenQuickAssign(subject)}
                        className="gap-2 border-dashed border-white/20 bg-transparent text-xs text-white/50 hover:border-brand/50 hover:bg-brand/10 hover:text-brand"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Assign Teacher
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Quick Assign Teacher Modal */}
      {selectedSubjectForAssign && (
        <QuickAssignTeacherModal
          open={quickAssignModalOpen}
          onOpenChange={setQuickAssignModalOpen}
          classId={classId}
          className={className}
          subject={selectedSubjectForAssign}
          currentTeacherId={selectedSubjectForAssign.currentTeacherId}
        />
      )}

      {/* Assign Schedule Modal */}
      {selectedScheduleAssignment && (
        <AssignSubjectScheduleModal
          open={scheduleModalOpen}
          onOpenChange={handleCloseScheduleModal}
          assignmentId={selectedScheduleAssignment.assignmentId}
          subjectId={selectedScheduleAssignment.subjectId}
          subjectName={selectedScheduleAssignment.subjectName}
          teacherId={selectedScheduleAssignment.teacherId}
          teacherName={selectedScheduleAssignment.teacherName}
          classId={classId}
          className={className}
          initialContactHours={selectedScheduleAssignment.initialContactHours}
        />
      )}
      {confirmationDialog}
    </div>
  );
}
