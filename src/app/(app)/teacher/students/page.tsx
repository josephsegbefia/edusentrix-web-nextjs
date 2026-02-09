"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Download,
  RefreshCw,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useClassRoster } from "@/hooks/teacher/useClassRoster";
import { useBusyToast } from "@/hooks/useBusyToast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

const toneStyles: Record<
  string,
  { border: string; bg: string; icon: string; glow: string; value: string }
> = {
  indigo: {
    border: "border-indigo-500/30",
    bg: "from-indigo-500/15 via-indigo-500/5 to-transparent",
    icon: "text-indigo-300",
    glow: "bg-indigo-500/20",
    value: "text-indigo-100",
  },
  emerald: {
    border: "border-emerald-500/30",
    bg: "from-emerald-500/15 via-emerald-500/5 to-transparent",
    icon: "text-emerald-300",
    glow: "bg-emerald-500/20",
    value: "text-emerald-100",
  },
  amber: {
    border: "border-amber-500/30",
    bg: "from-amber-500/15 via-amber-500/5 to-transparent",
    icon: "text-amber-300",
    glow: "bg-amber-500/20",
    value: "text-amber-100",
  },
};

function SummaryCard({
  label,
  value,
  subtitle,
  icon,
  tone,
  loading,
}: {
  label: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  tone: keyof typeof toneStyles;
  loading?: boolean;
}) {
  const config = toneStyles[tone];
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 shadow-xl shadow-black/30 backdrop-blur",
        config.border,
        config.bg
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl transition-opacity duration-300",
          config.glow,
          "opacity-50"
        )}
        aria-hidden="true"
      />
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
            {label}
          </p>
          <p className={cn("text-3xl font-bold tracking-tight", config.value)}>
            {loading ? (
              <span className="inline-block h-8 w-20 animate-pulse rounded bg-white/10" />
            ) : (
              value
            )}
          </p>
          <p className="text-xs text-white/50">{subtitle}</p>
        </div>
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5",
            config.icon
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

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
  const [searchFocused, setSearchFocused] = React.useState(false);

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
  const students = React.useMemo(
    () => rosterQuery.data?.data.students || [],
    [rosterQuery.data]
  );
  const selectedClass = classOptions.find((entry) => entry.id === selectedClassId) ?? null;

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
            type="button"
            onClick={handleRefresh}
            className="h-11 rounded-xl border border-emerald-300/20 bg-linear-to-r from-emerald-500/30 via-cyan-500/25 to-indigo-500/25 px-5 font-medium text-emerald-50 shadow-lg shadow-emerald-950/35 transition-all hover:from-emerald-500/40 hover:via-cyan-500/35 hover:to-indigo-500/35 disabled:border-white/10 disabled:bg-white/5 disabled:text-white/40 disabled:shadow-none"
            disabled={rosterQuery.isFetching}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md border border-white/20 bg-black/20">
              <RefreshCw className={cn("h-3.5 w-3.5", rosterQuery.isFetching && "animate-spin")} />
            </span>
            Refresh
          </Button>
          <Button
            type="button"
            onClick={handleExport}
            className="h-11 rounded-xl border border-white/15 bg-white/10 px-5 text-white/85 shadow-lg shadow-black/30 hover:bg-white/15"
            disabled={!students.length}
          >
            <Download className="h-4 w-4" />
            Export roster
          </Button>
        </div>
      </div>

      {classOptions.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/15 bg-linear-to-br from-white/10 to-transparent p-10 text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/60">
            <Users className="h-5 w-5" />
          </span>
          <p className="text-white/75">
            No classes assigned yet. Once classes are assigned, student rosters will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-linear-to-br from-white/10 via-white/5 to-transparent p-4 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
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
          <div className="relative w-full">
            <div
              className={cn(
                "group relative flex items-center overflow-hidden rounded-xl border transition-all duration-200",
                searchFocused
                  ? "border-teal-500/50 bg-teal-500/5 shadow-lg shadow-teal-500/10"
                  : "border-white/10 bg-white/5 hover:border-white/15 hover:bg-white/8"
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                <Search
                  className={cn(
                    "h-4 w-4 transition-colors",
                    searchFocused ? "text-teal-400" : "text-white/40"
                  )}
                />
              </div>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search students by name, ID, or class..."
                className="h-10 flex-1 bg-transparent pr-3 text-sm text-white placeholder:text-white/40 focus:outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="mr-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/60 transition-colors hover:bg-white/15 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard
          label="Total Students"
          value={`${students.length}`}
          subtitle="In selected class"
          icon={<Users className="h-5 w-5" />}
          tone="indigo"
          loading={rosterQuery.isLoading}
        />
        <SummaryCard
          label="Visible"
          value={`${filteredStudents.length}`}
          subtitle="After search filter"
          icon={<Search className="h-5 w-5" />}
          tone="emerald"
          loading={rosterQuery.isLoading}
        />
        <SummaryCard
          label="Subjects"
          value={`${selectedClass?.subjects ?? 0}`}
          subtitle="Assigned to this class"
          icon={<Sparkles className="h-5 w-5" />}
          tone="amber"
          loading={rosterQuery.isLoading}
        />
      </div>

      {classOptions.length === 0 ? null : rosterQuery.isError ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6 text-center text-sm text-rose-100">
          We could not load students for this class. Please refresh or try another class.
        </div>
      ) : rosterQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-44 animate-pulse rounded-2xl border border-white/10 bg-linear-to-br from-white/10 via-white/5 to-transparent"
            />
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
            <Link
              key={student._id}
              href={`/teacher/students/${student._id}`}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-teal-500/25 bg-linear-to-br from-teal-500/10 via-slate-900/55 to-slate-950/35 shadow-xl shadow-black/30 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/40"
            >
              <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-linear-to-b from-teal-500 to-cyan-500" />
              <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-teal-500/20 opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100" />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent" />

              <CardContent className="relative z-10 flex flex-col gap-4 p-5">
                <div className="flex items-start gap-4 pl-1">
                  <Avatar className="h-14 w-14 border-2 border-white/20 shadow-lg ring-2 ring-slate-800/50">
                    <AvatarImage
                      src={student.photoUrl || undefined}
                      alt={`${student.firstName} ${student.lastName}`}
                    />
                    <AvatarFallback className="bg-linear-to-br from-slate-700 to-slate-900 text-sm font-bold text-slate-200">
                      {getInitials(student.firstName, student.lastName)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="truncate text-sm font-semibold text-white">
                      {student.firstName} {student.lastName}
                    </div>
                    <div className="truncate text-xs text-white/55">
                      {selectedClass?.name || "Class roster"}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <Badge className="border border-teal-500/30 bg-teal-500/20 text-[10px] text-teal-200">
                        Active
                      </Badge>
                      <Badge className="border border-white/10 bg-white/10 text-[10px] text-white/70">
                        {student.admissionNo || "No admission no"}
                      </Badge>
                    </div>
                  </div>

                  <ArrowRight className="h-4 w-4 shrink-0 text-white/40 transition-transform group-hover:translate-x-0.5 group-hover:text-white/70" />
                </div>

                <div className="grid grid-cols-2 gap-2 pl-1 text-[11px]">
                  <div className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-white/60">
                    Admission
                    <div className="mt-1 truncate text-xs font-medium text-white/80">
                      {student.admissionNo || "Not set"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-white/60">
                    Profile
                    <div className="mt-1 text-xs font-medium text-teal-200">
                      View details
                    </div>
                  </div>
                </div>
              </CardContent>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
