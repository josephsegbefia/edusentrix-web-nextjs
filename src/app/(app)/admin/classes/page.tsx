// src/app/(app)/admin/classes/page.tsx
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Loader2,
  AlertCircle,
  School,
  BookOpen,
} from "lucide-react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useClasses, useTeachersForFilter, type ClassGroupDTO } from "@/hooks/admin/useClasses";
import { useGrades } from "@/hooks/admin/useGrades";
import { ClassesQuickStatsSection } from "@/components/admin/classes/ClassesQuickStatsSection";
import { ClassesToolbar } from "@/components/admin/classes/ClassesToolbar";
import { ClassesTable } from "@/components/admin/classes/ClassesTable";
import { AssignHomeroomModal } from "@/components/modals/AssignHomeroomModal";
import { AssignSubjectsToClassModal } from "@/components/modals/AssignSubjectsToClassModal";
import { BulkGradeSubjectAssignmentModal } from "@/components/modals/BulkGradeSubjectAssignmentModal";
import { cn } from "@/lib/utils";
import type { ClassesSortBy, ClassesSortOrder } from "@/constants/classes";

export default function ClassesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filters and search
  const [search, setSearch] = React.useState(searchParams.get("q") ?? "");
  const [gradeFilter, setGradeFilter] = React.useState<string | undefined>(
    searchParams.get("gradeId") || undefined
  );
  const [teacherFilter, setTeacherFilter] = React.useState<string | undefined>(
    searchParams.get("teacherId") || undefined
  );
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "inactive">(
    searchParams.get("status") === "active"
      ? "active"
      : searchParams.get("status") === "inactive"
      ? "inactive"
      : "all"
  );

  // Sorting
  const [sortBy, setSortBy] = React.useState<ClassesSortBy>("name");
  const [sortOrder, setSortOrder] = React.useState<ClassesSortOrder>("asc");

  // Selection
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  // Modals
  const [assignHomeroomModalOpen, setAssignHomeroomModalOpen] = React.useState(false);
  const [assignSubjectsModalOpen, setAssignSubjectsModalOpen] = React.useState(false);
  const [bulkAssignModalOpen, setBulkAssignModalOpen] = React.useState(false);
  const [selectedClass, setSelectedClass] = React.useState<ClassGroupDTO | null>(null);

  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const debouncedSearch = useDebouncedValue(search, 400);

  // Fetch data
  const { data: gradesData } = useGrades(true);
  const { data: teachersData } = useTeachersForFilter();

  const grades = gradesData?.data || [];
  const teachers = teachersData?.data || [];

  const { data, isLoading, isError } = useClasses({
    search: debouncedSearch || undefined,
    gradeId: gradeFilter,
    teacherId: teacherFilter,
    isActive: statusFilter === "all" ? undefined : statusFilter === "active",
    sortBy,
    sortOrder,
  });

  const classes = data?.data || [];
  const totalCount = data?.total ?? classes.length;

  // URL sync
  React.useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (gradeFilter) params.set("gradeId", gradeFilter);
    if (teacherFilter) params.set("teacherId", teacherFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);

    router.replace(`/admin/classes?${params.toString()}`);
  }, [debouncedSearch, gradeFilter, teacherFilter, statusFilter, router]);

  // Keyboard shortcuts
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping =
        tag === "input" ||
        tag === "textarea" ||
        (target && target.getAttribute("contenteditable") === "true");

      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select?.();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Handlers
  const handleSortChange = (column: ClassesSortBy) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  const handleToggleRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleToggleAllVisible = (visibleIds: string[]) => {
    const allSelected = visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...visibleIds])]);
    }
  };

  const handleAssignHomeroom = (classId: string) => {
    const classGroup = classes.find((c) => c.id === classId);
    if (classGroup) {
      setSelectedClass(classGroup);
      setAssignHomeroomModalOpen(true);
    }
  };

  const handleAssignSubjects = (classId: string) => {
    const classGroup = classes.find((c) => c.id === classId);
    if (classGroup) {
      setSelectedClass(classGroup);
      setAssignSubjectsModalOpen(true);
    }
  };

  const handleView = (classId: string) => {
    router.push(`/admin/classes/${classId}`);
  };

  const handleEdit = (classId: string) => {
    // TODO: Open edit modal
    console.log("Edit class:", classId);
  };

  const handleAddStudent = (classId: string) => {
    // Navigate to class detail with students tab
    router.push(`/admin/classes/${classId}?tab=students`);
  };

  const handleExport = () => {
    // TODO: Implement export
    console.log("Export classes");
  };

  return (
    <div className="space-y-8">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 via-slate-950/95 to-black p-8 shadow-2xl shadow-black/40">
        {/* Background decorations */}
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-emerald-500/20 via-green-500/10 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-gradient-to-tr from-lime-500/10 via-teal-500/5 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />

        <div className="relative">
          <div className="flex items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/20 to-green-500/20 shadow-lg shadow-emerald-500/10">
                  <School className="h-6 w-6 text-emerald-300" />
                </div>
                <div>
                  <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl bg-gradient-to-r from-emerald-300 to-green-400 bg-clip-text text-transparent">
                    Classes
                  </h1>
                  <p className="mt-1 text-sm text-white/70">
                    Manage classes, assign teachers, and organize students
                  </p>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setBulkAssignModalOpen(true)}
                className="gap-2 border-white/20 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
              >
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Bulk Assign Subjects</span>
              </Button>
              <Button
                onClick={() => {
                  // TODO: Open create class modal
                  console.log("Create class");
                }}
                className="group gap-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-green-700 hover:shadow-emerald-500/40"
              >
                <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
                <span>Add Class</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <ClassesQuickStatsSection />

      {/* Main Content Card */}
      <Card className="overflow-hidden border border-white/10 bg-neutral-950/60 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />

        <CardHeader className="border-b border-white/10 pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                <School className="h-4 w-4 text-emerald-300" />
              </span>
              Class Directory
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {/* Toolbar */}
          <div className="mb-6">
            <ClassesToolbar
              search={search}
              onSearchChange={setSearch}
              gradeFilter={gradeFilter}
              onGradeFilterChange={setGradeFilter}
              grades={grades}
              teacherFilter={teacherFilter}
              onTeacherFilterChange={setTeacherFilter}
              teachers={teachers}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              onExportAll={handleExport}
              searchInputRef={searchInputRef}
              totalCount={totalCount}
              filteredCount={classes.length}
            />
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              <p className="mt-3 text-sm text-white/50">Loading classes...</p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-16">
              <AlertCircle className="h-8 w-8 text-rose-400" />
              <p className="mt-3 text-sm font-medium text-white/70">
                Failed to load classes
              </p>
              <p className="mt-1 text-xs text-white/50">
                Please try refreshing the page
              </p>
            </div>
          ) : (
            <ClassesTable
              classes={classes}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={handleSortChange}
              selectedIds={selectedIds}
              onToggleRow={handleToggleRow}
              onToggleAllVisible={handleToggleAllVisible}
              onView={handleView}
              onEdit={handleEdit}
              onAssignHomeroom={handleAssignHomeroom}
              onAssignSubjects={handleAssignSubjects}
              onAddStudent={handleAddStudent}
            />
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      {selectedClass && (
        <>
          <AssignHomeroomModal
            open={assignHomeroomModalOpen}
            onOpenChange={(open) => {
              setAssignHomeroomModalOpen(open);
              if (!open) setSelectedClass(null);
            }}
            classGroup={selectedClass}
          />
          <AssignSubjectsToClassModal
            open={assignSubjectsModalOpen}
            onOpenChange={(open) => {
              setAssignSubjectsModalOpen(open);
              if (!open) setSelectedClass(null);
            }}
            classGroup={selectedClass}
          />
        </>
      )}

      {/* Bulk Assignment Modal */}
      <BulkGradeSubjectAssignmentModal
        open={bulkAssignModalOpen}
        onOpenChange={setBulkAssignModalOpen}
      />
    </div>
  );
}
