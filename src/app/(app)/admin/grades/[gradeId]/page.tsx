"use client";

import * as React from "react";
import { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronLeft,
  Plus,
  School,
  Users,
  BookOpen,
  Loader2,
  AlertCircle,
  UserCheck,
  GraduationCap,
  Calendar,
  FileDown,
  Search,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  UserPlus,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { useGrades, useGradeOverview, useGradeTeachers } from "@/hooks/admin/useGrades";
import {
  useClasses,
  useCreateClass,
  type ClassGroupDTO,
} from "@/hooks/admin/useClasses";
import { ResponsiveModal } from "@/components/modals/ResponsiveModal";
import CreateClassModal from "@/components/modals/CreateClassModal";
import { BulkGradeSubjectAssignmentModal } from "@/components/modals/BulkGradeSubjectAssignmentModal";
import { ClassDistributionList } from "@/components/admin/students/ClassDistributionList";
import { GradeDetailTabs, type GradeDetailTabId } from "@/components/admin/grades/GradeDetailTabs";
import { GradeFeesSection } from "@/components/admin/grades/GradeFeesSection";
import { useBusyToast } from "@/hooks/useBusyToast";
import type { CreateClassInput } from "@/components/modals/CreateClassModal";
import { cn } from "@/lib/utils";
import { notifyComingSoon } from "@/lib/ui/feature-notices";

type ClassSortBy = "class" | "students" | "capacity" | "homeroom" | "subjects" | "status";

function StatCard({
  label,
  value,
  icon,
  tone,
  loading,
  subtitle,
  href,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone: "teal" | "rose" | "amber" | "emerald";
  loading?: boolean;
  subtitle?: string;
  href?: string;
}) {
  const config: Record<string, { border: string; bg: string; iconBg: string; iconColor: string; valueColor: string }> = {
    teal: { border: "border-teal-500/30", bg: "from-teal-500/10 via-teal-500/5 to-transparent", iconBg: "from-teal-500/20 to-teal-600/20", iconColor: "text-teal-300", valueColor: "text-teal-100" },
    emerald: { border: "border-emerald-500/30", bg: "from-emerald-500/10 via-emerald-500/5 to-transparent", iconBg: "from-emerald-500/20 to-emerald-600/20", iconColor: "text-emerald-300", valueColor: "text-emerald-100" },
    rose: { border: "border-rose-500/30", bg: "from-rose-500/10 via-rose-500/5 to-transparent", iconBg: "from-rose-500/20 to-rose-600/20", iconColor: "text-rose-300", valueColor: "text-rose-100" },
    amber: { border: "border-amber-500/30", bg: "from-amber-500/10 via-amber-500/5 to-transparent", iconBg: "from-amber-500/20 to-amber-600/20", iconColor: "text-amber-300", valueColor: "text-amber-100" },
  };
  const c = config[tone];
  const content = (
    <div className={cn("group relative overflow-hidden rounded-2xl border bg-linear-to-br p-5 shadow-xl shadow-black/30 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1", c.border, c.bg)}>
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-white/50">{label}</p>
          <p className={cn("text-3xl font-bold tracking-tight tabular-nums", c.valueColor)}>
            {loading ? <span className="inline-block h-8 w-12 animate-pulse rounded bg-white/10" /> : typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {subtitle && <p className="text-[11px] text-white/40">{subtitle}</p>}
        </div>
        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-linear-to-br", c.iconBg)}>
          <span className={c.iconColor}>{icon}</span>
        </div>
      </div>
    </div>
  );
  if (href) {
    return <Link href={href} className="block">{content}</Link>;
  }
  return content;
}

function SortableHeader({
  label,
  column,
  sortBy,
  sortOrder,
  onSort,
}: {
  label: string;
  column: ClassSortBy;
  sortBy: ClassSortBy;
  sortOrder: "asc" | "desc";
  onSort: (col: ClassSortBy) => void;
}) {
  const isActive = sortBy === column;
  const Icon = !isActive ? ArrowUpDown : sortOrder === "asc" ? ChevronUp : ChevronDown;
  return (
    <button type="button" onClick={() => onSort(column)} className="inline-flex items-center gap-1 text-xs font-medium text-white/60 hover:text-white">
      {label}
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function getInitialTab(sp: URLSearchParams | null): GradeDetailTabId {
  if (!sp) return "overview";
  const raw = sp.get("tab");
  if (
    raw === "overview" ||
    raw === "fees" ||
    raw === "students" ||
    raw === "timetable" ||
    raw === "export"
  ) {
    return raw;
  }
  return "overview";
}

function GradeDetailContent() {
  const params = useParams<{ gradeId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const gradeId = params?.gradeId;

  const [activeTab, setActiveTab] = React.useState<GradeDetailTabId>(() =>
    getInitialTab(searchParams)
  );
  const [showCreateClass, setShowCreateClass] = React.useState(false);
  const [creatingClass, setCreatingClass] = React.useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = React.useState(false);
  const [classSearch, setClassSearch] = React.useState("");
  const [classSortBy, setClassSortBy] = React.useState<ClassSortBy>("class");
  const [classSortOrder, setClassSortOrder] = React.useState<"asc" | "desc">("asc");
  const [selectedClassIds, setSelectedClassIds] = React.useState<string[]>([]);

  const busy = useBusyToast();
  const createClassMutation = useCreateClass();

  const { data: gradesData, isLoading: gradesLoading, isError: gradesError } = useGrades(undefined, true);
  const { data: overviewData, isLoading: overviewLoading } = useGradeOverview(gradeId ?? undefined);
  const { data: classesData, isLoading: classesLoading, isError: classesError } = useClasses({
    gradeId: gradeId ?? undefined,
    isActive: true,
  });
  const { data: teachersData, isLoading: teachersLoading } = useGradeTeachers(gradeId ?? undefined);

  const grades = gradesData?.data ?? [];
  const grade = grades.find((g) => g.id === gradeId);
  const overview = overviewData?.data;
  const classes = classesData?.data ?? [];
  const teachers = teachersData?.data ?? [];

  const filteredClasses = React.useMemo(() => {
    let list = [...classes];
    if (classSearch.trim()) {
      const q = classSearch.toLowerCase();
      list = list.filter(
        (c) =>
          c.fullLabel.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          (c.homeroomTeacher?.fullName?.toLowerCase().includes(q) ?? false)
      );
    }
    list.sort((a, b) => {
      let cmp = 0;
      switch (classSortBy) {
        case "class":
          cmp = a.fullLabel.localeCompare(b.fullLabel);
          break;
        case "students":
          cmp = a.studentCount - b.studentCount;
          break;
        case "capacity":
          cmp = (a.capacity ?? 0) - (b.capacity ?? 0);
          break;
        case "homeroom":
          cmp = (a.homeroomTeacher ? 1 : 0) - (b.homeroomTeacher ? 1 : 0);
          break;
        case "subjects":
          cmp = a.subjectCount - b.subjectCount;
          break;
        case "status":
          cmp = (a.isActive ? 1 : 0) - (b.isActive ? 1 : 0);
          break;
      }
      return classSortOrder === "asc" ? cmp : -cmp;
    });
    return list;
  }, [classes, classSearch, classSortBy, classSortOrder]);

  // Sync tab → URL (use only stable primitives to keep deps array size constant)
  React.useEffect(() => {
    if (!gradeId) return;
    const current = new URLSearchParams(searchParams.toString());
    current.set("tab", activeTab);
    const qs = current.toString();
    router.replace(
      qs
        ? `/admin/grades/${encodeURIComponent(gradeId)}?${qs}`
        : `/admin/grades/${encodeURIComponent(gradeId)}`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, gradeId]);

  const handleClassSort = (col: ClassSortBy) => {
    setClassSortBy((prev) => {
      if (prev === col) {
        setClassSortOrder((o) => (o === "asc" ? "desc" : "asc"));
      } else {
        setClassSortOrder("asc");
      }
      return col;
    });
  };

  async function handleCreateClassSubmit(payload: CreateClassInput) {
    setCreatingClass(true);
    try {
      await busy.promise(
        createClassMutation.mutateAsync({
          gradeId: payload.gradeId,
          name: payload.name,
          subjectIds: payload.subjectIds,
          capacity: payload.capacity ?? undefined,
        }),
        { loading: "Creating class…", success: "Class created", error: "Could not create class" }
      );
      setShowCreateClass(false);
    } catch {
      throw new Error("Failed");
    } finally {
      setCreatingClass(false);
    }
  }

  if (!gradeId) {
    return (
      <div className="space-y-6">
        <Card className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-linear-to-br from-red-950/40 via-slate-950/60 to-black shadow-2xl shadow-black/40">
          <CardContent className="relative z-10 flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/20">
                <AlertCircle className="h-5 w-5 text-red-300" />
              </div>
              <div>
                <div className="font-semibold text-red-100">Missing grade identifier</div>
                <p className="text-xs text-red-200/70">The grade ID was not provided.</p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => router.push("/admin/grades")} className="border-white/10">
              Back to Grades
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (gradesError || (!gradesLoading && !grade)) {
    return (
      <div className="space-y-6">
        <Card className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-linear-to-br from-red-950/40 via-slate-950/60 to-black shadow-2xl shadow-black/40">
          <CardContent className="relative z-10 flex flex-col items-center justify-center gap-4 py-16">
            <AlertCircle className="h-12 w-12 text-red-400" />
            <div className="text-center">
              <p className="font-semibold text-red-100">Grade not found</p>
              <p className="text-sm text-red-200/70">The grade you&apos;re looking for doesn&apos;t exist or was removed.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => router.push("/admin/grades")} className="border-white/10">
              Back to Grades
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const gradeName = grade?.name ?? "Grade";
  const stats = overview?.stats;
  const totalCapacity = stats?.totalCapacity ?? 0;
  const capacityLabel = totalCapacity > 0 ? `${overview?.stats.totalStudents ?? 0}/${totalCapacity}` : "—";

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Breadcrumb & Header */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/90 via-slate-950/95 to-black p-5 shadow-2xl shadow-black/40 sm:rounded-3xl sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-linear-to-br from-teal-500/20 via-cyan-500/10 to-transparent blur-3xl" aria-hidden="true" />
        <div className="relative z-10 space-y-4">
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/admin/grades" className="text-white/60 hover:text-teal-300 transition-colors">
              Grades
            </Link>
            <span className="text-white/40">/</span>
            <span className="text-white font-medium">{gradeName}</span>
          </nav>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-linear-to-br from-teal-500/20 to-cyan-500/20 shadow-lg shadow-teal-500/10 sm:h-12 sm:w-12 sm:rounded-2xl">
                <School className="h-5 w-5 text-teal-300 sm:h-6 sm:w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{gradeName}</h1>
                <p className="text-xs text-white/60 sm:text-sm">
                  {grade?.code ? `${grade.code} • ` : ""}
                  {grade?.stage ?? "—"}
                  {overview?.currentPeriod && (
                    <span className="ml-2">
                      <Badge variant="outline" className="border-teal-500/30 bg-teal-500/10 text-teal-300 text-[10px]">
                        {overview.currentPeriod.yearLabel} • {overview.currentPeriod.term}
                      </Badge>
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setBulkAssignOpen(true)} className="gap-2 border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white">
                <BookOpen className="h-4 w-4" />
                Assign Subjects to Grade
              </Button>
              <Button type="button" size="sm" onClick={() => setShowCreateClass(true)} className="gap-2 bg-linear-to-r from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/25 hover:from-teal-600 hover:to-cyan-700">
                <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
                Add Class
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Total Students"
          value={stats?.totalStudents ?? 0}
          icon={<GraduationCap className="h-5 w-5" />}
          tone="teal"
          loading={overviewLoading}
        />
        <StatCard
          label="Classes"
          value={stats?.totalClasses ?? 0}
          icon={<School className="h-5 w-5" />}
          tone="emerald"
          loading={overviewLoading}
        />
        <StatCard
          label="Avg Class Size"
          value={stats?.avgClassSize ?? 0}
          icon={<Users className="h-5 w-5" />}
          tone="amber"
          loading={overviewLoading}
        />
        <StatCard
          label="Capacity"
          value={capacityLabel}
          icon={<School className="h-5 w-5" />}
          tone="emerald"
          loading={overviewLoading}
          subtitle={totalCapacity > 0 ? "filled / total" : undefined}
        />
        <StatCard
          label="Fee Defaulters"
          value={overview?.feeDefaultersCount ?? 0}
          icon={<AlertCircle className="h-5 w-5" />}
          tone="rose"
          loading={overviewLoading}
          href={overview && overview.feeDefaultersCount > 0 ? `/admin/students?gradeId=${gradeId}&tab=fee-defaulters` : undefined}
        />
      </section>

      {/* Coverage alerts */}
      {overview && (overview.stats.classesWithoutHomeroom > 0 || overview.stats.subjectsWithoutTeacher > 0) && (
        <div className="flex flex-wrap gap-3">
          {overview.stats.classesWithoutHomeroom > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-medium text-amber-200">
                {overview.stats.classesWithoutHomeroom} class{overview.stats.classesWithoutHomeroom !== 1 ? "es" : ""} without homeroom
              </span>
            </div>
          )}
          {overview.stats.subjectsWithoutTeacher > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5">
              <AlertCircle className="h-4 w-4 text-rose-400" />
              <span className="text-sm font-medium text-rose-200">
                {overview.stats.subjectsWithoutTeacher} subject assignment{overview.stats.subjectsWithoutTeacher !== 1 ? "s" : ""} without teacher
              </span>
            </div>
          )}
        </div>
      )}

      {/* Tabs (styled like student detail) */}
      <GradeDetailTabs value={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      {activeTab === "overview" && (
        <>
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Subject overview card */}
        <Card className="relative overflow-hidden rounded-xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 lg:col-span-1">
          <CardHeader className="relative z-10 border-b border-white/5">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
              <BookOpen className="h-5 w-5 text-teal-300" />
              Subject Overview
            </CardTitle>
            <p className="text-xs text-white/50">Which classes have each subject, gaps</p>
          </CardHeader>
          <CardContent className="relative z-10 p-4 sm:p-6">
            {overviewLoading ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <Loader2 className="h-6 w-6 animate-spin text-teal-400" />
                <p className="text-xs text-white/50">Loading subjects…</p>
              </div>
            ) : !overview?.subjects?.length ? (
              <p className="text-sm text-white/50">No subjects assigned to classes in this grade yet.</p>
            ) : (
              <ul className="space-y-3">
                {overview.subjects.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <span className="text-sm font-medium text-white truncate">{s.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-teal-300">{s.classesWithSubject}/{overview?.stats.totalClasses ?? 0}</span>
                      {s.classesWithoutSubject > 0 && (
                        <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-300 text-[10px]">
                          {s.classesWithoutSubject} gap{s.classesWithoutSubject !== 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Class distribution */}
        <div className="lg:col-span-2">
          <ClassDistributionList distribution={overview?.classDistribution ?? undefined} loading={overviewLoading} />
        </div>
      </div>

      {/* Class comparison table */}
      <Card className="relative overflow-hidden rounded-xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 sm:rounded-2xl">
        <CardHeader className="relative z-10 border-b border-white/5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
              <School className="h-5 w-5 text-teal-300" />
              Classes
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <Input
                  placeholder="Search classes…"
                  value={classSearch}
                  onChange={(e) => setClassSearch(e.target.value)}
                  className="w-48 pl-8 border-white/10 bg-white/5 text-white text-sm"
                />
              </div>
              {(selectedClassIds.length > 0) && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setBulkAssignOpen(true)} className="gap-1.5 border-white/10">
                    <BookOpen className="h-3.5 w-3.5" />
                    Bulk assign subjects
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => notifyComingSoon("Bulk assign homeroom")} className="gap-1.5 border-white/10">
                    <UserPlus className="h-3.5 w-3.5" />
                    Bulk assign homeroom
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative z-10 p-4 sm:p-6">
          {classesLoading ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
              <p className="text-sm text-white/50">Loading classes…</p>
            </div>
          ) : classesError ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
              <AlertCircle className="h-8 w-8 text-rose-400" />
              <p className="text-sm text-white/70">Failed to load classes</p>
            </div>
          ) : filteredClasses.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
                <School className="h-8 w-8 text-white/30" />
              </div>
              <p className="text-sm font-medium text-white/80">No classes yet</p>
              <p className="text-xs text-white/50">{classSearch ? "No classes match your search." : "Add your first class to this grade"}</p>
              {!classSearch && (
                <Button size="sm" onClick={() => setShowCreateClass(true)} className="gap-2 bg-linear-to-r from-teal-500 to-cyan-600">
                  <Plus className="h-4 w-4" />
                  Add Class
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="w-10 px-4 py-3">
                      <Checkbox
                        checked={filteredClasses.length > 0 && filteredClasses.every((c) => selectedClassIds.includes(c.id))}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedClassIds(filteredClasses.map((c) => c.id));
                          else setSelectedClassIds([]);
                        }}
                        className="border-white/30"
                        aria-label="Select all"
                      />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <SortableHeader label="Class" column="class" sortBy={classSortBy} sortOrder={classSortOrder} onSort={handleClassSort} />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <SortableHeader label="Students" column="students" sortBy={classSortBy} sortOrder={classSortOrder} onSort={handleClassSort} />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <SortableHeader label="Capacity" column="capacity" sortBy={classSortBy} sortOrder={classSortOrder} onSort={handleClassSort} />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <SortableHeader label="Homeroom" column="homeroom" sortBy={classSortBy} sortOrder={classSortOrder} onSort={handleClassSort} />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <SortableHeader label="Subjects" column="subjects" sortBy={classSortBy} sortOrder={classSortOrder} onSort={handleClassSort} />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <SortableHeader label="Status" column="status" sortBy={classSortBy} sortOrder={classSortOrder} onSort={handleClassSort} />
                    </th>
                    <th className="px-4 py-3 text-right text-xs text-white/50">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClasses.map((cls) => (
                    <tr
                      key={cls.id}
                      className={cn(
                        "border-b border-white/5 transition-colors hover:bg-white/5 cursor-pointer",
                        selectedClassIds.includes(cls.id) && "bg-teal-500/10"
                      )}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("button, [role='checkbox'], a")) return;
                        router.push(`/admin/classes/${cls.id}`);
                      }}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedClassIds.includes(cls.id)}
                          onCheckedChange={(checked) => {
                            setSelectedClassIds((prev) =>
                              checked ? [...prev, cls.id] : prev.filter((id) => id !== cls.id)
                            );
                          }}
                          className="border-white/30"
                          aria-label={`Select ${cls.fullLabel}`}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-white">{cls.fullLabel}</td>
                      <td className="px-4 py-3 text-white/80">{cls.studentCount}</td>
                      <td className="px-4 py-3 text-white/80">{cls.capacity ?? "—"}</td>
                      <td className="px-4 py-3 text-white/80">{cls.homeroomTeacher?.fullName ?? "—"}</td>
                      <td className="px-4 py-3 text-white/80">{cls.subjectCount}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={cls.isActive ? "border-emerald-500/40 text-emerald-300" : "border-amber-500/40 text-amber-300"}>
                          {cls.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/admin/classes/${cls.id}`}>View</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Teachers section */}
      <Card className="relative overflow-hidden rounded-xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 sm:rounded-2xl">
        <CardHeader className="relative z-10 border-b border-white/5">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
            <UserCheck className="h-5 w-5 text-teal-300" />
            Teachers
          </CardTitle>
          <p className="text-xs text-white/50">Homeroom and subject teachers for classes in this grade</p>
        </CardHeader>
        <CardContent className="relative z-10 p-4 sm:p-6">
          {teachersLoading ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
              <p className="text-sm text-white/50">Loading teachers…</p>
            </div>
          ) : teachers.length === 0 ? (
            <p className="text-sm text-white/50">No teachers assigned yet. Assign homeroom and subject teachers from individual class pages.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {teachers.map((t) => (
                <Link
                  key={t.id}
                  href={`/admin/teachers/${t.id}`}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5",
                    "text-sm text-white/90 hover:border-teal-500/30 hover:bg-teal-500/10 hover:text-teal-200",
                    "transition-colors"
                  )}
                >
                  <Users className="h-4 w-4 text-teal-300" />
                  <span>{t.fullName}</span>
                  {t.roles.length > 0 && (
                    <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[10px] text-teal-300">
                      {t.roles.includes("homeroom") && t.roles.includes("subject") ? "Homeroom & Subject" : t.roles.includes("homeroom") ? "Homeroom" : "Subject"}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
        </>
      )}

      {activeTab === "fees" && (
        <GradeFeesSection gradeId={gradeId} gradeName={gradeName} />
      )}

      {activeTab === "students" && (
        <Card className="overflow-hidden rounded-xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black">
          <CardContent className="flex flex-col items-center justify-center gap-6 py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10">
              <Users className="h-8 w-8 text-cyan-300" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-white">View students in {gradeName}</h3>
              <p className="mt-1 text-sm text-white/60">
                Browse, search, and manage all students in this grade
              </p>
            </div>
            <Button asChild size="lg" className="gap-2 bg-linear-to-r from-cyan-500 to-teal-600 text-white hover:from-cyan-600 hover:to-teal-700">
              <Link href={`/admin/students?gradeId=${gradeId}`}>
                View all students
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {activeTab === "timetable" && (
        <Card className="overflow-hidden rounded-xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black">
          <CardContent className="flex flex-col items-center justify-center gap-6 py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
              <Calendar className="h-8 w-8 text-amber-300" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-white">View timetable for {gradeName}</h3>
              <p className="mt-1 text-sm text-white/60">
                See the weekly schedule for classes in this grade
              </p>
            </div>
            <Button asChild size="lg" className="gap-2 bg-linear-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700">
              <Link href={`/admin/timetable?gradeId=${gradeId}`}>
                View timetable
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {activeTab === "export" && (
        <Card className="overflow-hidden rounded-xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black">
          <CardContent className="flex flex-col items-center justify-center gap-6 py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/10">
              <FileDown className="h-8 w-8 text-violet-300" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-white">Export class list</h3>
              <p className="mt-1 text-sm text-white/60">
                Download student lists for classes in this grade
              </p>
            </div>
            <Button
              variant="outline"
              size="lg"
              className="gap-2 border-white/10"
              onClick={() => notifyComingSoon("Export class list")}
            >
              Coming soon
            </Button>
          </CardContent>
        </Card>
      )}

      <ResponsiveModal open={showCreateClass} onClose={() => setShowCreateClass(false)} title="Add New Class">
        <CreateClassModal gradeId={gradeId} gradeName={gradeName} onClose={() => setShowCreateClass(false)} onSubmit={handleCreateClassSubmit} isLoading={creatingClass} />
      </ResponsiveModal>

      <BulkGradeSubjectAssignmentModal open={bulkAssignOpen} onOpenChange={setBulkAssignOpen} initialGradeId={gradeId} />
    </div>
  );
}

export default function GradeDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/90 via-slate-950/95 to-black p-8">
            <div className="h-10 w-64 animate-pulse rounded-lg bg-white/10" />
            <div className="mt-2 h-4 w-48 animate-pulse rounded bg-white/5" />
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
            ))}
          </div>
        </div>
      }
    >
      <GradeDetailContent />
    </Suspense>
  );
}
