// src/app/(app)/admin/subjects/page.tsx
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  AlertCircle,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useSubjects } from "@/hooks/admin/useSubjects";
import { SubjectsQuickStatsSection } from "@/components/admin/subjects/SubjectsQuickStatsSection";
import { SubjectsToolbar, type SubjectsViewMode } from "@/components/admin/subjects/SubjectsToolbar";
import { SubjectsCardGrid } from "@/components/admin/subjects/SubjectsCardGrid";
import { SubjectsTable } from "@/components/admin/subjects/SubjectsTable";
import { AssignTeacherToSubjectModal } from "@/components/modals/AssignTeacherToSubjectModal";
import type { SubjectDTO } from "@/hooks/admin/useSubjects";
import { notifyComingSoon } from "@/lib/ui/feature-notices";
import { cn } from "@/lib/utils";

function getInitialView(sp: URLSearchParams): SubjectsViewMode {
  const v = sp.get("view");
  return v === "table" ? "table" : "cards";
}

export default function SubjectsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [viewMode, setViewMode] = React.useState<SubjectsViewMode>(() =>
    getInitialView(searchParams)
  );
  const [search, setSearch] = React.useState(searchParams.get("q") ?? "");
  const [activeFilter] = React.useState<boolean | undefined>(
    searchParams.get("isActive") === "true"
      ? true
      : searchParams.get("isActive") === "false"
      ? false
      : undefined
  );

  const [assignTeacherModalOpen, setAssignTeacherModalOpen] = React.useState(false);
  const [selectedSubject, setSelectedSubject] = React.useState<SubjectDTO | null>(null);
  const [selectedClassId, setSelectedClassId] = React.useState<string | undefined>();

  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const debouncedSearch = useDebouncedValue(search, 400);

  const { data, isLoading, isError } = useSubjects(debouncedSearch, activeFilter);

  const subjects = data?.data || [];
  const totalFiltered = subjects.length;

  // URL sync
  React.useEffect(() => {
    const params = new URLSearchParams();
    params.set("view", viewMode);
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (activeFilter !== undefined) params.set("isActive", String(activeFilter));

    router.replace(`/admin/subjects?${params.toString()}`);
  }, [viewMode, debouncedSearch, activeFilter, router]);

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

  const handleAssignToClasses = (subjectId: string) => {
    void subjectId;
    notifyComingSoon("Assign subject to classes");
  };

  const handleAssignTeachers = (subjectId: string, classGroupId?: string) => {
    const subject = subjects.find((s) => s.id === subjectId);
    if (subject) {
      setSelectedSubject(subject);
      setSelectedClassId(classGroupId);
      setAssignTeacherModalOpen(true);
    }
  };

  const handleView = (subjectId: string) => {
    router.push(`/admin/subjects/${subjectId}`);
  };

  const handleEdit = (subjectId: string) => {
    void subjectId;
    notifyComingSoon("Edit subject");
  };

  const handleExport = () => {
    notifyComingSoon("Export subjects");
  };

  const handleOpenFilters = () => {
    notifyComingSoon("Advanced filters");
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/90 via-slate-950/95 to-black p-5 shadow-2xl shadow-black/40 sm:rounded-3xl sm:p-8">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-linear-to-br from-blue-500/20 via-indigo-500/10 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-linear-to-tr from-sky-500/10 via-blue-500/5 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col gap-4 sm:gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-linear-to-br from-blue-500/20 to-indigo-500/20 shadow-lg shadow-blue-500/10 sm:h-12 sm:w-12 sm:rounded-2xl">
                <BookOpen className="h-5 w-5 text-blue-300 sm:h-6 sm:w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Subjects
                </h1>
                <p className="text-xs text-white/60 sm:text-sm">
                  Curriculum and teacher assignments
                </p>
              </div>
            </div>
            <p className="hidden max-w-lg text-sm leading-relaxed text-white/50 sm:block">
              Manage school subjects, class coverage, and teacher allocations
              from a single directory.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <Button
              onClick={() => {
                notifyComingSoon("Create subject");
              }}
              className="group h-9 gap-2 rounded-xl bg-linear-to-r from-blue-500 to-indigo-600 px-4 text-xs text-white shadow-lg shadow-blue-500/25 hover:from-blue-600 hover:to-indigo-700 sm:h-10 sm:text-sm"
            >
              <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
              <span>Add Subject</span>
            </Button>
          </div>
        </div>

        <div className="relative z-10 mt-4 hidden flex-wrap items-center gap-3 border-t border-white/10 pt-4 sm:mt-6 sm:flex">
          <span className="text-[11px] uppercase tracking-wider text-white/40">
            Shortcuts
          </span>
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/60">
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">
              /
            </kbd>
            <span>Focus search</span>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <SubjectsQuickStatsSection />

      {/* Subject directory shell */}
      <Card className="relative overflow-hidden rounded-xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl sm:rounded-2xl">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-blue-500/5 via-transparent to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
          aria-hidden="true"
        />

        <CardHeader className="relative z-10 border-b border-white/5 pb-0">
          <div className="flex flex-col gap-3 pb-3 sm:gap-4 sm:pb-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-linear-to-br from-white/10 to-white/5 shadow-inner shadow-white/5 sm:h-11 sm:w-11 sm:rounded-xl">
                  <Sparkles className="h-4 w-4 text-blue-300 sm:h-5 sm:w-5" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-900 bg-blue-400 sm:h-3 sm:w-3" />
              </div>
              <div className="space-y-0.5">
                <CardTitle className="text-base font-semibold tracking-tight text-white sm:text-lg">
                  Subject Directory
                </CardTitle>
                <p className="text-[11px] text-white/50 sm:text-xs">
                  Search, filter, and manage subjects
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[10px] font-medium text-blue-300">
                {totalFiltered} total
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative z-10 space-y-4 p-4 sm:space-y-5 sm:p-6">
          <SubjectsToolbar
            search={search}
            onSearchChange={setSearch}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onOpenFilters={handleOpenFilters}
            onExportAll={handleExport}
            searchInputRef={searchInputRef}
          />
        </CardContent>
      </Card>

      {/* Data summary shell */}
      <Card className="relative overflow-hidden rounded-xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl sm:rounded-2xl">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,var(--tw-gradient-stops))] from-cyan-500/5 via-transparent to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
          aria-hidden="true"
        />

        <CardHeader className="relative z-10 border-b border-white/5 pb-0">
          <div className="flex flex-col gap-3 pb-3 sm:pb-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                Directory Results
              </CardTitle>
              <p className="text-sm text-white/80">
                {isLoading ? "Loading..." : `${totalFiltered} subjects found`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors",
                  viewMode === "cards"
                    ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                    : "border-white/10 bg-white/5 text-white/60"
                )}
              >
                {viewMode === "cards" ? "Cards" : "Table"} view
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative z-10 p-4 sm:p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12 sm:py-16">
              <div className="relative">
                <div className="h-12 w-12 animate-spin rounded-full border-2 border-blue-500/20 border-t-blue-500" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-blue-400/60" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white/80">
                  Loading subjects...
                </p>
                <p className="text-xs text-white/50">
                  Fetching your subject directory
                </p>
              </div>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12 sm:py-16">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
                <AlertCircle className="h-7 w-7 text-red-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-red-300">
                  Failed to load subjects
                </p>
                <p className="text-xs text-red-300/60">
                  Please try refreshing the page
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
            </div>
          ) : subjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12 sm:py-16">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-linear-to-br from-white/10 to-white/5">
                  <BookOpen className="h-10 w-10 text-white/30" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-base font-medium text-white/80">
                  No subjects found
                </p>
                <p className="mt-1 max-w-xs text-sm text-white/50">
                  Try adjusting your search or create your first subject to get
                  started.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-5">
              <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-linear-to-r from-white/5 to-transparent px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2 text-xs text-white/70 sm:text-sm">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20 text-[9px] font-bold text-blue-300 sm:h-6 sm:w-6 sm:text-[10px]">
                    {subjects.length}
                  </span>
                  <span>
                    showing{" "}
                    <span className="font-medium text-white">
                      {subjects.length}
                    </span>{" "}
                    subject{subjects.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              {viewMode === "cards" ? (
                <SubjectsCardGrid
                  subjects={subjects}
                  onView={handleView}
                  onEdit={handleEdit}
                  onAssignToClasses={handleAssignToClasses}
                  onAssignTeachers={handleAssignTeachers}
                />
              ) : (
                <SubjectsTable
                  subjects={subjects}
                  onView={handleView}
                  onEdit={handleEdit}
                  onAssignToClasses={handleAssignToClasses}
                  onAssignTeachers={handleAssignTeachers}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      {selectedSubject && (
        <AssignTeacherToSubjectModal
          open={assignTeacherModalOpen}
          onOpenChange={(open) => {
            setAssignTeacherModalOpen(open);
            if (!open) {
              setSelectedSubject(null);
              setSelectedClassId(undefined);
            }
          }}
          subject={selectedSubject}
          initialClassGroupId={selectedClassId}
        />
      )}
    </div>
  );
}
