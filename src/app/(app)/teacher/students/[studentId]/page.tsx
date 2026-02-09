"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  Mail,
  Phone,
  Users,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AttendanceHistory } from "@/components/teacher/attendance/AttendanceHistory";
import { cn } from "@/lib/utils";
import { useTeacherStudentDetail } from "@/hooks/teacher/useTeacherStudentDetail";

type TeacherStudentTabId =
  | "overview"
  | "academics"
  | "fees"
  | "behaviour"
  | "relationships"
  | "activity";

type TabConfig = {
  id: TeacherStudentTabId;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  colors: {
    active: string;
    icon: string;
  };
};

const TABS: TabConfig[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    colors: {
      active:
        "border-teal-500/40 bg-teal-500/15 text-teal-200 shadow-teal-500/20",
      icon: "bg-teal-500/20 text-teal-300 border-teal-500/30",
    },
  },
  {
    id: "academics",
    label: "Academics",
    icon: GraduationCap,
    colors: {
      active:
        "border-cyan-500/40 bg-cyan-500/15 text-cyan-200 shadow-cyan-500/20",
      icon: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    },
  },
  {
    id: "fees",
    label: "Fees & Accounts",
    icon: Wallet,
    colors: {
      active:
        "border-emerald-500/40 bg-emerald-500/15 text-emerald-200 shadow-emerald-500/20",
      icon: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    },
  },
  {
    id: "behaviour",
    label: "Behaviour",
    icon: ClipboardCheck,
    colors: {
      active:
        "border-amber-500/40 bg-amber-500/15 text-amber-200 shadow-amber-500/20",
      icon: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    },
  },
  {
    id: "relationships",
    label: "Relationships",
    icon: Users,
    colors: {
      active:
        "border-rose-500/40 bg-rose-500/15 text-rose-200 shadow-rose-500/20",
      icon: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    },
  },
  {
    id: "activity",
    label: "Activity",
    icon: Activity,
    colors: {
      active:
        "border-violet-500/40 bg-violet-500/15 text-violet-200 shadow-violet-500/20",
      icon: "bg-violet-500/20 text-violet-300 border-violet-500/30",
    },
  },
];

function getInitials(fullName: string) {
  const parts = fullName.trim().split(" ");
  const first = parts[0]?.charAt(0)?.toUpperCase() || "";
  const last = parts[parts.length - 1]?.charAt(0)?.toUpperCase() || "";
  return first + last || "ST";
}

function formatDate(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getRelationshipLabel(relationship: string) {
  const labels: Record<string, string> = {
    mother: "Mother",
    father: "Father",
    guardian: "Guardian",
    step_mother: "Step Mother",
    step_father: "Step Father",
    grandmother: "Grandmother",
    grandfather: "Grandfather",
    aunt: "Aunt",
    uncle: "Uncle",
    other: "Other",
  };
  return labels[relationship] || relationship;
}

function prettifyActivityType(raw: string) {
  return raw
    .replaceAll(".", " ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function getInitialTab(sp: URLSearchParams | null): TeacherStudentTabId {
  if (!sp) return "overview";
  const raw = sp.get("tab");
  if (
    raw === "overview" ||
    raw === "academics" ||
    raw === "fees" ||
    raw === "behaviour" ||
    raw === "relationships" ||
    raw === "activity"
  ) {
    return raw;
  }
  return "overview";
}

function TeacherStudentTabs({
  value,
  onChange,
}: {
  value: TeacherStudentTabId;
  onChange: (tab: TeacherStudentTabId) => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = tab.id === value;
        return (
          <button
            type="button"
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "group relative inline-flex items-center gap-2.5 whitespace-nowrap rounded-xl border px-4 py-2.5 text-xs font-medium transition-all duration-200",
              active
                ? cn("shadow-lg", tab.colors.active)
                : "border-white/10 bg-white/5 text-white/60 hover:border-white/15 hover:bg-white/8 hover:text-white/80"
            )}
            aria-pressed={active}
          >
            {active && (
              <span className="absolute -top-0.5 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-current opacity-60" />
            )}
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg border transition-all duration-200",
                active
                  ? tab.colors.icon
                  : "border-white/10 bg-white/5 text-white/50 group-hover:border-white/15 group-hover:bg-white/8 group-hover:text-white/70"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="font-medium">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function DetailStatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "indigo" | "emerald" | "amber";
}) {
  const toneClasses = {
    indigo: "border-indigo-500/30 bg-indigo-500/10 text-indigo-100",
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  };

  return (
    <div className={cn("rounded-xl border p-3", toneClasses[tone])}>
      <div className="text-xs opacity-70">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}

function InfoPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
      <CardContent className="p-8">
        <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center">
          <div className="text-lg font-semibold text-white">{title}</div>
          <p className="mt-2 text-sm text-white/55">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TeacherStudentDetailPage() {
  const params = useParams<{ studentId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const studentId = typeof params?.studentId === "string" ? params.studentId : "";
  const { data, isLoading, isError, refetch } = useTeacherStudentDetail(
    studentId || undefined
  );

  const student = data?.data;
  const [activeTab, setActiveTab] = React.useState<TeacherStudentTabId>(() =>
    getInitialTab(searchParams)
  );

  React.useEffect(() => {
    setActiveTab(getInitialTab(searchParams));
  }, [searchParams]);

  const handleTabChange = (tab: TeacherStudentTabId) => {
    setActiveTab(tab);
    if (!studentId) return;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("tab", tab);
    router.replace(`/teacher/students/${encodeURIComponent(studentId)}?${params.toString()}`, {
      scroll: false,
    });
  };

  if (!studentId) {
    return (
      <div className="space-y-6">
        <Card className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-linear-to-br from-red-950/40 to-transparent shadow-2xl shadow-black/40 backdrop-blur-xl">
          <CardContent className="relative z-10 flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/20">
                <AlertTriangle className="h-5 w-5 text-red-300" />
              </div>
              <div>
                <div className="font-semibold text-red-100">
                  Missing student identifier
                </div>
                <p className="text-xs text-red-200/70">
                  The student ID was not provided in the URL.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push("/teacher/students")}
              className="gap-2 rounded-xl border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Students
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="relative">
          <div
            className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-teal-500/10 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative z-10 flex items-start gap-4">
            <div className="h-10 w-10 animate-pulse rounded-xl border border-white/10 bg-white/5" />
            <div className="space-y-2">
              <div className="h-9 w-64 animate-pulse rounded-lg bg-white/10" />
              <div className="h-4 w-96 animate-pulse rounded bg-white/5" />
            </div>
          </div>
        </div>

        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardContent className="flex animate-pulse flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center gap-4">
              <div className="size-20 rounded-full bg-white/10" />
              <div className="space-y-3">
                <div className="h-6 w-48 rounded bg-white/15" />
                <div className="h-5 w-24 rounded-full bg-white/10" />
              </div>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-3 md:w-[420px]">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-white/10" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !student) {
    return (
      <div className="space-y-6">
        <Card className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-linear-to-br from-red-950/40 to-transparent shadow-2xl shadow-black/40 backdrop-blur-xl">
          <CardContent className="relative z-10 flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/20">
                <AlertTriangle className="h-5 w-5 text-red-300" />
              </div>
              <div>
                <div className="font-semibold text-red-100">
                  Unable to load student details
                </div>
                <p className="text-xs text-red-200/70">
                  The student might not exist or you might not have access.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="gap-2 rounded-xl border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
              >
                Retry
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => router.push("/teacher/students")}
                className="gap-2 rounded-xl border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusClassName =
    student.status === "active"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : student.status === "inactive"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
        : "border-rose-500/30 bg-rose-500/10 text-rose-300";

  const attendanceHistoryRows = student.recentAttendance.map((record) => ({
    _id: record.id,
    date: record.date,
    type: record.type,
    status: record.status,
    periodNumber: record.periodNumber,
  }));

  return (
    <div className="space-y-6">
      <div className="relative">
        <div
          className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-teal-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-10 top-10 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => router.push("/teacher/students")}
              className="h-10 w-10 shrink-0 rounded-xl border border-white/10 bg-white/5 transition-all duration-200 hover:border-teal-500/30 hover:bg-teal-500/10 hover:text-teal-300"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="bg-linear-to-r from-teal-200 via-cyan-200 to-sky-300 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent lg:text-4xl">
                  Student Profile
                </h1>
                <div
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize",
                    statusClassName
                  )}
                >
                  {student.status}
                </div>
              </div>
              <p className="text-sm text-white/60">
                Review student details with the same tabbed workflow as admin.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:mt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/teacher/students")}
              className="gap-2 rounded-xl border-white/10 bg-white/5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
            >
              <Users className="h-3.5 w-3.5" />
              All Students
            </Button>
          </div>
        </div>
      </div>

      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-teal-950/40 to-transparent shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-linear-to-br from-teal-500/15 via-cyan-500/10 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />

        <CardContent className="relative z-10 p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 border-2 border-white/20">
                <AvatarImage src={student.photoUrl || undefined} alt={student.fullName} />
                <AvatarFallback className="bg-linear-to-br from-slate-700 to-slate-900 text-lg font-bold text-slate-200">
                  {getInitials(student.fullName)}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-2">
                <div>
                  <h2 className="text-2xl font-bold text-white">{student.fullName}</h2>
                  <p className="text-sm text-white/60">
                    {student.classGroup?.label || "No class assignment"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="border border-white/10 bg-white/10 text-white/80">
                    Admission: {student.admissionNo || "Not set"}
                  </Badge>
                  <Badge className="border border-white/10 bg-white/10 text-white/80">
                    Grade: {student.grade?.name || "--"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-3 md:w-[430px]">
              <DetailStatCard
                label="Attendance Rate"
                value={
                  student.attendanceSummary.attendanceRate != null
                    ? `${student.attendanceSummary.attendanceRate}%`
                    : "--"
                }
                tone="indigo"
              />
              <DetailStatCard
                label="Academic Avg"
                value={
                  student.academicSummary.overallAverage != null
                    ? `${student.academicSummary.overallAverage}%`
                    : "--"
                }
                tone="emerald"
              />
              <DetailStatCard
                label="Guardians"
                value={`${student.guardians.length}`}
                tone="amber"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <TeacherStudentTabs value={activeTab} onChange={handleTabChange} />

      {activeTab === "overview" ? (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-indigo-500/20 text-indigo-200">
                    <GraduationCap className="h-4 w-4" />
                  </span>
                  Student Snapshot
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <span className="text-white/60">Admission No</span>
                  <span className="font-medium text-white">{student.admissionNo || "--"}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <span className="text-white/60">Grade</span>
                  <span className="font-medium text-white">{student.grade?.name || "--"}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <span className="text-white/60">Class</span>
                  <span className="font-medium text-white">{student.classGroup?.name || "--"}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <span className="text-white/60">Date of Birth</span>
                  <span className="font-medium text-white">{formatDate(student.dateOfBirth)}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <span className="text-white/60">Enrolled</span>
                  <span className="font-medium text-white">{formatDate(student.enrolledAt)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-emerald-500/20 text-emerald-200">
                    <Users className="h-4 w-4" />
                  </span>
                  Parents & Guardians
                </CardTitle>
              </CardHeader>
              <CardContent>
                {student.guardians.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/60">
                    No guardians linked yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {student.guardians.slice(0, 3).map((guardian) => (
                      <div
                        key={guardian.id}
                        className="rounded-xl border border-white/10 bg-white/5 p-3"
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10 border border-white/15">
                            <AvatarImage src={guardian.photoUrl || undefined} alt={guardian.fullName} />
                            <AvatarFallback className="bg-slate-800 text-slate-200">
                              {getInitials(guardian.fullName)}
                            </AvatarFallback>
                          </Avatar>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="truncate text-sm font-semibold text-white">
                                {guardian.fullName}
                              </div>
                              {guardian.isPrimary && (
                                <Badge className="border border-teal-500/30 bg-teal-500/15 text-[10px] text-teal-200">
                                  Primary
                                </Badge>
                              )}
                            </div>

                            <div className="mt-1 text-xs text-white/55">
                              {getRelationshipLabel(guardian.relationship)}
                            </div>

                            <div className="mt-2 space-y-1 text-xs text-white/60">
                              {guardian.email && (
                                <div className="flex items-center gap-1.5">
                                  <Mail className="h-3.5 w-3.5 text-white/40" />
                                  <span className="truncate">{guardian.email}</span>
                                </div>
                              )}
                              {guardian.phone && (
                                <div className="flex items-center gap-1.5">
                                  <Phone className="h-3.5 w-3.5 text-white/40" />
                                  <span>{guardian.phone}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
            <CardHeader className="sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-cyan-500/20 text-cyan-200">
                  <CalendarDays className="h-4 w-4" />
                </span>
                Recent Attendance
              </CardTitle>
              <div className="text-xs text-white/55">
                Last {student.recentAttendance.length} records
              </div>
            </CardHeader>
            <CardContent>
              <AttendanceHistory records={attendanceHistoryRows} />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "academics" ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <DetailStatCard
              label="Overall Average"
              value={
                student.academicSummary.overallAverage != null
                  ? `${student.academicSummary.overallAverage}%`
                  : "--"
              }
              tone="indigo"
            />
            <DetailStatCard
              label="Subjects"
              value={`${student.academicSummary.subjectsCount}`}
              tone="emerald"
            />
            <DetailStatCard
              label="Passed"
              value={`${student.academicSummary.passedCount}`}
              tone="amber"
            />
          </div>

          <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-cyan-500/20 text-cyan-200">
                  <GraduationCap className="h-4 w-4" />
                </span>
                Subject Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {student.subjectPerformance.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
                  No academic records available for this student yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {student.subjectPerformance.map((item) => (
                    <div
                      key={item.subjectId}
                      className="rounded-xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-white">
                            {item.subjectName}
                          </div>
                          <div className="mt-1 text-xs text-white/55">
                            Updated {formatDate(item.lastUpdated)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            className={cn(
                              "border",
                              item.isPassed
                                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-200"
                                : "border-rose-500/30 bg-rose-500/15 text-rose-200"
                            )}
                          >
                            {item.gradeLetter || (item.isPassed ? "PASS" : "AT RISK")}
                          </Badge>
                          <span className="text-lg font-semibold text-white">
                            {item.totalScore}%
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            item.totalScore >= 70
                              ? "bg-emerald-500"
                              : item.totalScore >= 50
                                ? "bg-amber-500"
                                : "bg-rose-500"
                          )}
                          style={{ width: `${Math.max(0, Math.min(100, item.totalScore))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "fees" ? (
        <InfoPlaceholder
          title="Fees & Accounts"
          description="This tab follows the admin detail layout. Detailed fee actions are limited to admin and bursar accounts."
        />
      ) : null}

      {activeTab === "behaviour" ? (
        <InfoPlaceholder
          title="Behaviour"
          description="Behaviour records will appear here when behaviour tracking is enabled for teacher view."
        />
      ) : null}

      {activeTab === "relationships" ? (
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-rose-500/20 text-rose-200">
                <Users className="h-4 w-4" />
              </span>
              Parents & Guardians
            </CardTitle>
          </CardHeader>
          <CardContent>
            {student.guardians.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
                No guardians linked yet.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {student.guardians.map((guardian) => (
                  <div
                    key={guardian.id}
                    className="rounded-xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-12 w-12 border border-white/15">
                        <AvatarImage src={guardian.photoUrl || undefined} alt={guardian.fullName} />
                        <AvatarFallback className="bg-slate-800 text-slate-200">
                          {getInitials(guardian.fullName)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-sm font-semibold text-white">
                            {guardian.fullName}
                          </div>
                          {guardian.isPrimary && (
                            <Badge className="border border-teal-500/30 bg-teal-500/15 text-[10px] text-teal-200">
                              Primary
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-white/55">
                          {getRelationshipLabel(guardian.relationship)}
                        </div>
                        <div className="mt-2 space-y-1 text-xs text-white/60">
                          {guardian.email && (
                            <div className="flex items-center gap-1.5">
                              <Mail className="h-3.5 w-3.5 text-white/40" />
                              <span className="truncate">{guardian.email}</span>
                            </div>
                          )}
                          {guardian.phone && (
                            <div className="flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5 text-white/40" />
                              <span>{guardian.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "activity" ? (
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-violet-500/20 text-violet-200">
                <Activity className="h-4 w-4" />
              </span>
              Activity Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            {student.recentActivity.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
                No activity logged yet.
              </div>
            ) : (
              <div className="space-y-3">
                {student.recentActivity.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {item.description}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge className="border border-violet-500/30 bg-violet-500/15 text-[10px] text-violet-200">
                            {prettifyActivityType(item.type)}
                          </Badge>
                          {item.user ? (
                            <span className="text-xs text-white/50">
                              by {item.user.firstName || ""} {item.user.lastName || ""}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="text-xs text-white/50">{formatDate(item.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
