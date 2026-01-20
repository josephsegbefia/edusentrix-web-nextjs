// src/app/(app)/admin/timetable/page.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  BookOpen,
  Loader2,
  AlertCircle,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AssignSubjectScheduleModal } from "@/components/modals/AssignSubjectScheduleModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TimetableEntry = {
  assignmentId: string;
  classId: string;
  className: string;
  gradeName: string;
  gradeLevel: number;
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  teacherId: string;
  teacherName: string;
  teacherPhotoUrl: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location: string | null;
  roomId: string | null;
  contactHoursPerWeek: number;
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(time: string): string {
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
  return (endMinutes - startMinutes) / 60;
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase() || "?";
}

// Detect conflicts: same teacher at overlapping times
function detectConflicts(entries: TimetableEntry[]): Map<string, TimetableEntry[]> {
  const conflicts = new Map<string, TimetableEntry[]>();

  for (let i = 0; i < entries.length; i++) {
    const entry1 = entries[i];
    const conflictsForEntry: TimetableEntry[] = [];

    for (let j = i + 1; j < entries.length; j++) {
      const entry2 = entries[j];

      // Check if same teacher, same day, and overlapping times
      if (
        entry1.teacherId === entry2.teacherId &&
        entry1.dayOfWeek === entry2.dayOfWeek &&
        entry1.assignmentId !== entry2.assignmentId
      ) {
        const start1 = entry1.startTime.split(":").map(Number);
        const end1 = entry1.endTime.split(":").map(Number);
        const start2 = entry2.startTime.split(":").map(Number);
        const end2 = entry2.endTime.split(":").map(Number);

        const start1Minutes = start1[0] * 60 + start1[1];
        const end1Minutes = end1[0] * 60 + end1[1];
        const start2Minutes = start2[0] * 60 + start2[1];
        const end2Minutes = end2[0] * 60 + end2[1];

        // Check for overlap
        if (
          (start1Minutes < end2Minutes && end1Minutes > start2Minutes) ||
          (start2Minutes < end1Minutes && end2Minutes > start1Minutes)
        ) {
          conflictsForEntry.push(entry2);
        }
      }
    }

    if (conflictsForEntry.length > 0) {
      conflicts.set(entry1.assignmentId, conflictsForEntry);
    }
  }

  return conflicts;
}

export default function MasterTimetablePage() {
  const router = useRouter();
  const [selectedDay, setSelectedDay] = React.useState<number | null>(null); // null = all days
  const [selectedGrade, setSelectedGrade] = React.useState<string>("all");
  const [selectedClass, setSelectedClass] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [editModalOpen, setEditModalOpen] = React.useState(false);
  const [selectedEntry, setSelectedEntry] = React.useState<TimetableEntry | null>(null);

  // Fetch master timetable
  const { data, isLoading, isError, refetch } = useQuery<{
    success: boolean;
    data: TimetableEntry[];
  }>({
    queryKey: ["master-timetable"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/timetable/master`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch master timetable");
      return res.json();
    },
    staleTime: 30_000,
  });

  const allEntries = data?.data || [];

  // Get unique grades and classes for filters
  const grades = React.useMemo(() => {
    const gradeSet = new Set(allEntries.map((e) => e.gradeName));
    return Array.from(gradeSet).sort();
  }, [allEntries]);

  const classes = React.useMemo(() => {
    const classSet = new Set(allEntries.map((e) => e.className));
    return Array.from(classSet).sort();
  }, [allEntries]);

  // Filter entries
  const filteredEntries = React.useMemo(() => {
    return allEntries.filter((entry) => {
      if (selectedDay !== null && entry.dayOfWeek !== selectedDay) return false;
      if (selectedGrade !== "all" && entry.gradeName !== selectedGrade) return false;
      if (selectedClass !== "all" && entry.className !== selectedClass) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          entry.className.toLowerCase().includes(query) ||
          entry.subjectName.toLowerCase().includes(query) ||
          entry.teacherName.toLowerCase().includes(query) ||
          entry.gradeName.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [allEntries, selectedDay, selectedGrade, selectedClass, searchQuery]);

  // Detect conflicts
  const conflicts = React.useMemo(() => {
    return detectConflicts(allEntries);
  }, [allEntries]);

  // Group by day for weekly view
  const entriesByDay = React.useMemo(() => {
    const grouped: Record<number, TimetableEntry[]> = {};
    for (let i = 0; i < 7; i++) {
      grouped[i] = [];
    }
    filteredEntries.forEach((entry) => {
      grouped[entry.dayOfWeek].push(entry);
    });
    // Sort each day by start time
    Object.keys(grouped).forEach((day) => {
      grouped[parseInt(day)].sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
    return grouped;
  }, [filteredEntries]);

  const handleEditSchedule = (entry: TimetableEntry) => {
    setSelectedEntry(entry);
    setEditModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditModalOpen(false);
    setSelectedEntry(null);
    refetch();
  };

  // Get conflict count for an entry
  const getConflictCount = (assignmentId: string) => {
    return conflicts.get(assignmentId)?.length || 0;
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
          <p className="text-sm text-red-200">Failed to load master timetable</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative">
        <div
          className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/20">
              <Calendar className="h-6 w-6 text-emerald-300" />
            </div>
            <div>
              <h1 className="bg-gradient-to-r from-emerald-200 via-green-200 to-teal-300 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent lg:text-4xl">
                Master Timetable
              </h1>
              <p className="mt-1 text-sm text-white/60">
                School-wide schedule overview for all classes
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                <Calendar className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-white/60">Total Sessions</p>
                <p className="text-lg font-semibold text-white">{allEntries.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-white/60">Classes Scheduled</p>
                <p className="text-lg font-semibold text-white">
                  {new Set(allEntries.map((e) => e.classId)).size}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/10">
                <BookOpen className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-white/60">Subjects</p>
                <p className="text-lg font-semibold text-white">
                  {new Set(allEntries.map((e) => e.subjectId)).size}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10">
                <AlertTriangle className="h-5 w-5 text-rose-400" />
              </div>
              <div>
                <p className="text-xs text-white/60">Conflicts</p>
                <p className="text-lg font-semibold text-white">{conflicts.size}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-white/10 bg-white/5">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-white/40" />
              <Input
                placeholder="Search classes, subjects, teachers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 border-white/10 bg-white/5 text-white"
              />
            </div>

            <Select value={selectedGrade} onValueChange={setSelectedGrade}>
              <SelectTrigger className="w-40 border-white/10 bg-white/5 text-white">
                <SelectValue placeholder="All Grades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                {grades.map((grade) => (
                  <SelectItem key={grade} value={grade}>
                    {grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-48 border-white/10 bg-white/5 text-white">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((className) => (
                  <SelectItem key={className} value={className}>
                    {className}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Button
                variant={selectedDay === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedDay(null)}
                className={cn(
                  selectedDay === null && "bg-emerald-500 text-white"
                )}
              >
                All Days
              </Button>
              {[1, 2, 3, 4, 5].map((day) => (
                <Button
                  key={day}
                  variant={selectedDay === day ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    selectedDay === day && "bg-emerald-500 text-white"
                  )}
                >
                  {DAY_SHORT[day]}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conflicts Warning */}
      {conflicts.size > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-300" />
            <div className="flex-1">
              <p className="font-medium text-amber-200">
                {conflicts.size} scheduling conflict{conflicts.size !== 1 ? "s" : ""} detected
              </p>
              <p className="text-xs text-amber-200/70">
                Some teachers are scheduled at overlapping times
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly Timetable View */}
      <div className="space-y-4">
        {selectedDay === null ? (
          // Show all days
          [1, 2, 3, 4, 5].map((dayIndex) => {
            const dayEntries = entriesByDay[dayIndex] || [];
            if (dayEntries.length === 0) return null;

            return (
              <Card key={dayIndex} className="border-white/10 bg-white/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg text-white">
                    <Calendar className="h-5 w-5 text-emerald-400" />
                    {DAY_NAMES[dayIndex]}
                    <Badge variant="outline" className="text-xs">
                      {dayEntries.length} session{dayEntries.length !== 1 ? "s" : ""}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {dayEntries.map((entry, idx) => {
                      const duration = calculateDuration(entry.startTime, entry.endTime);
                      const hasConflict = getConflictCount(entry.assignmentId) > 0;

                      return (
                        <div
                          key={`${entry.assignmentId}-${idx}`}
                          className={cn(
                            "flex items-center justify-between rounded-lg border p-3 transition-all hover:border-emerald-500/30 hover:bg-emerald-500/5",
                            hasConflict
                              ? "border-rose-500/50 bg-rose-500/10"
                              : "border-white/10 bg-white/5"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs font-semibold text-emerald-300">
                              {formatTime(entry.startTime)}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-white">
                                  {entry.className} - {entry.subjectName}
                                </p>
                                {entry.subjectCode && (
                                  <Badge variant="outline" className="text-xs">
                                    {entry.subjectCode}
                                  </Badge>
                                )}
                                {hasConflict && (
                                  <Badge
                                    variant="outline"
                                    className="border-rose-500/50 bg-rose-500/20 text-xs text-rose-300"
                                  >
                                    <AlertTriangle className="mr-1 h-3 w-3" />
                                    Conflict
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-1 flex items-center gap-3 text-xs text-white/60">
                                <div className="flex items-center gap-1.5">
                                  <Avatar className="h-4 w-4">
                                    <AvatarImage
                                      src={entry.teacherPhotoUrl || undefined}
                                    />
                                    <AvatarFallback className="text-[8px]">
                                      {getInitials(
                                        entry.teacherName.split(" ")[0],
                                        entry.teacherName.split(" ")[1] || ""
                                      )}
                                    </AvatarFallback>
                                  </Avatar>
                                  {entry.teacherName}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {duration}h
                                </div>
                                {entry.location && (
                                  <div className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {entry.location}
                                  </div>
                                )}
                                <div className="text-white/40">{entry.gradeName}</div>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditSchedule(entry)}
                            className="h-8 w-8 p-0"
                          >
                            <Calendar className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          // Show single day
          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <Calendar className="h-5 w-5 text-emerald-400" />
                {DAY_NAMES[selectedDay]}
                <Badge variant="outline" className="text-xs">
                  {entriesByDay[selectedDay]?.length || 0} session
                  {(entriesByDay[selectedDay]?.length || 0) !== 1 ? "s" : ""}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {entriesByDay[selectedDay] && entriesByDay[selectedDay].length > 0 ? (
                <div className="space-y-2">
                  {entriesByDay[selectedDay].map((entry, idx) => {
                    const duration = calculateDuration(entry.startTime, entry.endTime);
                    const hasConflict = getConflictCount(entry.assignmentId) > 0;

                    return (
                      <div
                        key={`${entry.assignmentId}-${idx}`}
                        className={cn(
                          "flex items-center justify-between rounded-lg border p-3 transition-all hover:border-emerald-500/30 hover:bg-emerald-500/5",
                          hasConflict
                            ? "border-rose-500/50 bg-rose-500/10"
                            : "border-white/10 bg-white/5"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs font-semibold text-emerald-300">
                            {formatTime(entry.startTime)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-white">
                                {entry.className} - {entry.subjectName}
                              </p>
                              {entry.subjectCode && (
                                <Badge variant="outline" className="text-xs">
                                  {entry.subjectCode}
                                </Badge>
                              )}
                              {hasConflict && (
                                <Badge
                                  variant="outline"
                                  className="border-rose-500/50 bg-rose-500/20 text-xs text-rose-300"
                                >
                                  <AlertTriangle className="mr-1 h-3 w-3" />
                                  Conflict
                                </Badge>
                              )}
                            </div>
                            <div className="mt-1 flex items-center gap-3 text-xs text-white/60">
                              <div className="flex items-center gap-1.5">
                                <Avatar className="h-4 w-4">
                                  <AvatarImage
                                    src={entry.teacherPhotoUrl || undefined}
                                  />
                                  <AvatarFallback className="text-[8px]">
                                    {getInitials(
                                      entry.teacherName.split(" ")[0],
                                      entry.teacherName.split(" ")[1] || ""
                                    )}
                                  </AvatarFallback>
                                </Avatar>
                                {entry.teacherName}
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {duration}h
                              </div>
                              {entry.location && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {entry.location}
                                </div>
                              )}
                              <div className="text-white/40">{entry.gradeName}</div>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditSchedule(entry)}
                          className="h-8 w-8 p-0"
                        >
                          <Calendar className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Calendar className="mx-auto h-12 w-12 text-white/20" />
                  <p className="mt-4 text-sm text-white/60">No schedules for this day</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Schedule Modal */}
      {selectedEntry && (
        <AssignSubjectScheduleModal
          open={editModalOpen}
          onOpenChange={handleCloseModal}
          assignmentId={selectedEntry.assignmentId}
          subjectId={selectedEntry.subjectId}
          subjectName={selectedEntry.subjectName}
          teacherId={selectedEntry.teacherId}
          teacherName={selectedEntry.teacherName}
          classId={selectedEntry.classId}
          className={selectedEntry.className}
          initialContactHours={selectedEntry.contactHoursPerWeek}
          initialSchedules={[
            {
              dayOfWeek: selectedEntry.dayOfWeek,
              startTime: selectedEntry.startTime,
              endTime: selectedEntry.endTime,
              location: selectedEntry.location || undefined,
              roomId: selectedEntry.roomId || null,
            },
          ]}
        />
      )}
    </div>
  );
}
