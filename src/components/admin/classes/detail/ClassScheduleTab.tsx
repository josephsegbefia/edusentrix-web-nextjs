// src/components/admin/classes/detail/ClassScheduleTab.tsx
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Clock,
  MapPin,
  Plus,
  Edit,
  Trash2,
  BookOpen,
  Users,
  Loader2,
  AlertCircle,
  CalendarDays,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AssignSubjectScheduleModal } from "@/components/modals/AssignSubjectScheduleModal";

type ClassScheduleTabProps = {
  classId: string;
  className: string;
};

type ScheduleItem = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location?: string;
  roomId?: string | null;
};

type SubjectSchedule = {
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  assignmentId: string;
  teacherId: string;
  teacherName: string;
  teacherPhotoUrl: string | null;
  contactHoursPerWeek: number;
  schedules: ScheduleItem[];
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(time: string): string {
  // Convert "HH:MM" to "HH:MM AM/PM"
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

function calculateDuration(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  return (endMinutes - startMinutes) / 60; // Return hours
}

export function ClassScheduleTab({ classId, className }: ClassScheduleTabProps) {
  const [editModalOpen, setEditModalOpen] = React.useState(false);
  const [selectedAssignment, setSelectedAssignment] = React.useState<SubjectSchedule | null>(null);

  // Fetch schedules for this class
  const { data, isLoading, isError, refetch } = useQuery<{
    success: boolean;
    data: SubjectSchedule[];
  }>({
    queryKey: ["class-schedules", classId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/classes/${classId}/schedules`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch schedules");
      return res.json();
    },
    staleTime: 30_000,
  });

  const schedules = data?.data || [];

  // Group schedules by day of week for timetable view
  const timetableByDay = React.useMemo(() => {
    const timetable: Record<number, SubjectSchedule[]> = {};
    for (let i = 0; i < 7; i++) {
      timetable[i] = [];
    }

    schedules.forEach((schedule) => {
      schedule.schedules.forEach((item) => {
        if (!timetable[item.dayOfWeek]) {
          timetable[item.dayOfWeek] = [];
        }
        timetable[item.dayOfWeek].push({
          ...schedule,
          schedules: [item], // Single schedule item for this day
        });
      });
    });

    // Sort each day by start time
    Object.keys(timetable).forEach((day) => {
      timetable[parseInt(day)].sort((a, b) => {
        const aTime = a.schedules[0]?.startTime || "";
        const bTime = b.schedules[0]?.startTime || "";
        return aTime.localeCompare(bTime);
      });
    });

    return timetable;
  }, [schedules]);

  const handleEditSchedule = (assignment: SubjectSchedule) => {
    setSelectedAssignment(assignment);
    setEditModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditModalOpen(false);
    setSelectedAssignment(null);
    refetch();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border-red-500/30 bg-red-950/20">
        <CardContent className="flex items-center gap-3 p-6">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <p className="text-sm text-red-200">Failed to load schedules</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                <BookOpen className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-white/60">Subjects Scheduled</p>
                <p className="text-lg font-semibold text-white">
                  {schedules.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-white/60">Total Contact Hours</p>
                <p className="text-lg font-semibold text-white">
                  {schedules.reduce((sum, s) => sum + s.contactHoursPerWeek, 0)} hrs/week
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/10">
                <CalendarDays className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-white/60">Weekly Sessions</p>
                <p className="text-lg font-semibold text-white">
                  {schedules.reduce((sum, s) => sum + s.schedules.length, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Timetable View */}
      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <Calendar className="h-5 w-5 text-emerald-400" />
              Weekly Timetable
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((dayIndex) => {
              const daySchedules = timetableByDay[dayIndex] || [];
              if (daySchedules.length === 0) return null;

              return (
                <div
                  key={dayIndex}
                  className="rounded-lg border border-white/10 bg-white/5 p-4"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <h3 className="font-semibold text-white">{DAY_NAMES[dayIndex]}</h3>
                    <Badge variant="outline" className="text-xs">
                      {daySchedules.length} session{daySchedules.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {daySchedules.map((schedule, idx) => {
                      const scheduleItem = schedule.schedules[0];
                      const duration = calculateDuration(
                        scheduleItem.startTime,
                        scheduleItem.endTime
                      );

                      return (
                        <div
                          key={`${schedule.assignmentId}-${idx}`}
                          className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3 transition-all hover:border-emerald-500/30 hover:bg-emerald-500/5"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs font-semibold text-emerald-300">
                              {formatTime(scheduleItem.startTime)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-white">
                                  {schedule.subjectName}
                                </p>
                                {schedule.subjectCode && (
                                  <Badge variant="outline" className="text-xs">
                                    {schedule.subjectCode}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-white/60">
                                <div className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {schedule.teacherName}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {duration}h
                                </div>
                                {scheduleItem.location && (
                                  <div className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {scheduleItem.location}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditSchedule(schedule)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {schedules.length === 0 && (
            <div className="py-12 text-center">
              <Calendar className="mx-auto h-12 w-12 text-white/20" />
              <p className="mt-4 text-sm text-white/60">
                No schedules assigned yet
              </p>
              <p className="mt-1 text-xs text-white/40">
                Assign schedules to subjects and teachers to build the timetable
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subject List View */}
      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-white">
            <BookOpen className="h-5 w-5 text-emerald-400" />
            Subject Schedules
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {schedules.map((schedule) => (
              <div
                key={schedule.assignmentId}
                className="rounded-lg border border-white/10 bg-white/5 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">
                          {schedule.subjectName}
                        </h3>
                        {schedule.subjectCode && (
                          <Badge variant="outline" className="text-xs">
                            {schedule.subjectCode}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-white/60">
                        <div className="flex items-center gap-1.5">
                          <Avatar className="h-5 w-5">
                            <AvatarImage
                              src={schedule.teacherPhotoUrl || undefined}
                            />
                            <AvatarFallback className="text-[10px]">
                              {schedule.teacherName
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{schedule.teacherName}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {schedule.contactHoursPerWeek} hrs/week
                        </div>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditSchedule(schedule)}
                    className="gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Edit Schedule
                  </Button>
                </div>

                {schedule.schedules.length > 0 ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {schedule.schedules.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm"
                      >
                        <Badge
                          variant="outline"
                          className="shrink-0 text-xs font-medium"
                        >
                          {DAY_SHORT[item.dayOfWeek]}
                        </Badge>
                        <div className="flex-1">
                          <div className="font-medium text-white">
                            {formatTime(item.startTime)} - {formatTime(item.endTime)}
                          </div>
                          {item.location && (
                            <div className="text-xs text-white/60">
                              {item.location}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg border border-dashed border-white/20 bg-white/5 p-3 text-center text-xs text-white/40">
                    No schedule slots assigned
                  </div>
                )}
              </div>
            ))}

            {schedules.length === 0 && (
              <div className="py-12 text-center">
                <Calendar className="mx-auto h-12 w-12 text-white/20" />
                <p className="mt-4 text-sm text-white/60">
                  No subject schedules found
                </p>
                <p className="mt-1 text-xs text-white/40">
                  Assign schedules to subjects and teachers to build the timetable
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Schedule Modal */}
      {selectedAssignment && (
        <AssignSubjectScheduleModal
          open={editModalOpen}
          onOpenChange={handleCloseModal}
          assignmentId={selectedAssignment.assignmentId}
          subjectId={selectedAssignment.subjectId}
          subjectName={selectedAssignment.subjectName}
          teacherId={selectedAssignment.teacherId}
          teacherName={selectedAssignment.teacherName}
          classId={classId}
          className={className}
          initialContactHours={selectedAssignment.contactHoursPerWeek}
          initialSchedules={selectedAssignment.schedules}
        />
      )}
    </div>
  );
}
