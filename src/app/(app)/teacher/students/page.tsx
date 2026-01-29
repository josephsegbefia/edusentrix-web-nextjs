"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Download, RefreshCw, Search, Users } from "lucide-react";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useClassRoster } from "@/hooks/teacher/useClassRoster";
import { useBusyToast } from "@/hooks/useBusyToast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";

function getInitials(firstName?: string, lastName?: string) {
  const first = firstName?.[0] ?? "";
  const last = lastName?.[0] ?? "";
  return `${first}${last}`.toUpperCase() || "ST";
}

export default function TeacherStudentsPage() {
  const searchParams = useSearchParams();
  const busyToast = useBusyToast();

  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canView = can(permissions, PERMISSIONS.studentsView);

  const { data: classesData } = useTeacherClasses();
  const classOptions = React.useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; studentCount: number; subjectIds: Set<string> }
    >();
    (classesData?.data.classes || []).forEach((item) => {
      if (!item._id) return;
      if (!map.has(item._id)) {
        map.set(item._id, {
          id: item._id,
          name: item.name,
          studentCount: item.studentCount,
          subjectIds: new Set(),
        });
      }
      const entry = map.get(item._id);
      if (!entry) return;
      entry.studentCount = Math.max(entry.studentCount, item.studentCount);
      if (item.subjectId) entry.subjectIds.add(item.subjectId);
    });
    return Array.from(map.values())
      .map((entry) => ({ ...entry, subjects: entry.subjectIds.size }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [classesData]);

  const [selectedClassId, setSelectedClassId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    if (classOptions.length === 0) return;
    const queryClass = searchParams.get("class");
    const queryExists = queryClass
      ? classOptions.some((item) => item.id === queryClass)
      : false;
    const fallbackId = queryExists ? queryClass! : classOptions[0].id;
    const currentValid = selectedClassId
      ? classOptions.some((item) => item.id === selectedClassId)
      : false;

    if (!currentValid) {
      setSelectedClassId(fallbackId);
      return;
    }

    if (queryClass && queryClass !== selectedClassId && queryExists) {
      setSelectedClassId(queryClass);
    }
  }, [classOptions, searchParams, selectedClassId]);

  const rosterQuery = useClassRoster(selectedClassId || undefined);
  const students = rosterQuery.data?.data.students || [];

  const filteredStudents = students.filter((student) => {
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    return (
      `${student.firstName} ${student.lastName}`.toLowerCase().includes(query) ||
      (student.admissionNo || "").toLowerCase().includes(query)
    );
  });

  const handleRefresh = React.useCallback(async () => {
    await busyToast.promise(rosterQuery.refetch(), {
      loading: "Refreshing roster...",
      success: "Roster updated",
      error: "Failed to refresh roster",
    });
  }, [busyToast, rosterQuery]);

  const handleExport = React.useCallback(() => {
    if (!selectedClassId) return;
    const headers = ["AdmissionNo", "FirstName", "LastName", "MiddleName"];
    const rows = students.map((student) => [
      student.admissionNo || "",
      student.firstName,
      student.lastName,
      student.middleName || "",
    ]);
    const csv = [headers.join(","), ...rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, "\"\"")}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "class-roster.csv";
    link.click();
    URL.revokeObjectURL(url);
  }, [students, selectedClassId]);

  if (!canView) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Students</h1>
          <p className="text-sm text-white/60">Student access is currently locked.</p>
        </div>
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60">
                <Users className="h-4 w-4" />
              </span>
              Student access required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
              Ask an admin to grant student access for your account.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Students</h1>
          <p className="text-sm text-white/60">
            Review class rosters, profiles, and key details for your students.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleRefresh}
            variant="outline"
            className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            disabled={rosterQuery.isFetching}
          >
            <RefreshCw className={cn("h-4 w-4", rosterQuery.isFetching && "animate-spin")} />
            Refresh
          </Button>
          <Button
            onClick={handleExport}
            className="bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
            disabled={!students.length}
          >
            <Download className="h-4 w-4" />
            Export roster
          </Button>
        </div>
      </div>

      {classOptions.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
          No classes assigned yet. Once classes are assigned, student rosters will appear here.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
          <PremiumSelect value={selectedClassId ?? ""} onValueChange={(value) => setSelectedClassId(value)}>
            <PremiumSelectTrigger>
              <PremiumSelectValue placeholder="Select class" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              {classOptions.map((entry) => (
                <PremiumSelectItem key={entry.id} value={entry.id}>
                  {entry.name}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-white/40" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or admission number"
              className="border-white/10 bg-white/5 pl-9 text-white"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-white/70">
              <Users className="h-4 w-4 text-indigo-200" />
              Total Students
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-white">
            {rosterQuery.isLoading ? (
              <span className="inline-block h-8 w-16 animate-pulse rounded bg-white/10" />
            ) : (
              students.length
            )}
          </CardContent>
        </Card>
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-white/70">
              <Users className="h-4 w-4 text-emerald-200" />
              Visible
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-white">
            {rosterQuery.isLoading ? (
              <span className="inline-block h-8 w-16 animate-pulse rounded bg-white/10" />
            ) : (
              filteredStudents.length
            )}
          </CardContent>
        </Card>
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-white/70">
              <Users className="h-4 w-4 text-amber-200" />
              Subjects
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-white">
            {classOptions.find((entry) => entry.id === selectedClassId)?.subjects ?? 0}
          </CardContent>
        </Card>
      </div>

      {classOptions.length === 0 ? null : rosterQuery.isError ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6 text-center text-sm text-rose-100">
          We could not load students for this class. Please refresh or try another class.
        </div>
      ) : rosterQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
          ))}
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
          {students.length === 0
            ? "No students found for this class yet."
            : "No students match your search."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredStudents.map((student) => (
            <Card
              key={student._id}
              className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur"
            >
              <CardContent className="flex items-center gap-4 p-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={student.photoUrl || undefined} alt={student.firstName} />
                  <AvatarFallback className="bg-white/10 text-white/70">
                    {getInitials(student.firstName, student.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-white">
                    {student.firstName} {student.lastName}
                  </div>
                  <div className="text-xs text-white/50">
                    Admission No: {student.admissionNo || "—"}
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] text-white/40">
                    <Badge className="bg-indigo-500/20 text-indigo-100">Profile</Badge>
                    <Badge className="bg-emerald-500/20 text-emerald-100">Roster</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
