// src/app/(app)/admin/subjects/page.tsx
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Loader2,
  AlertCircle,
  BookOpen,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useSubjects } from "@/hooks/admin/useSubjects";
import { SubjectsQuickStatsSection } from "@/components/admin/subjects/SubjectsQuickStatsSection";
import { SubjectsToolbar, type SubjectsViewMode } from "@/components/admin/subjects/SubjectsToolbar";
import { SubjectsCardGrid } from "@/components/admin/subjects/SubjectsCardGrid";
import { SubjectsTable } from "@/components/admin/subjects/SubjectsTable";
import { useBusyToast } from "@/hooks/useBusyToast";
import { cn } from "@/lib/utils";
import { AssignTeacherToSubjectModal } from "@/components/modals/AssignTeacherToSubjectModal";
import type { SubjectDTO } from "@/hooks/admin/useSubjects";

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
  const [activeFilter, setActiveFilter] = React.useState<boolean | undefined>(
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
  const busy = useBusyToast();

  const { data, isLoading, isError } = useSubjects(debouncedSearch, activeFilter);

  const subjects = data?.data || [];

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
    // TODO: Create a separate modal for bulk assigning to classes
    console.log("Assign subject to classes:", subjectId);
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
    // TODO: Open edit modal
    console.log("Edit subject:", subjectId);
  };

  const handleExport = () => {
    // TODO: Implement export
    console.log("Export subjects");
  };

  const handleOpenFilters = () => {
    // TODO: Open filters dialog
    console.log("Open filters");
  };

  return (
    <div className="space-y-8">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 via-slate-950/95 to-black p-8 shadow-2xl shadow-black/40">
        {/* Background decorations */}
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-rose-500/20 via-pink-500/10 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-gradient-to-tr from-fuchsia-500/10 via-violet-500/5 to-transparent blur-3xl"
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
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-rose-500/20 to-pink-500/20 shadow-lg shadow-rose-500/10">
                  <BookOpen className="h-6 w-6 text-rose-300" />
                </div>
                <div>
                  <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-gradient-to-r from-rose-300 to-pink-400">
                    Subjects
                  </h1>
                  <p className="mt-1 text-sm text-white/70">
                    Manage curriculum subjects and teacher assignments
                  </p>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <Button
                onClick={() => {
                  // TODO: Open create subject modal
                  console.log("Create subject");
                }}
                className="group gap-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/25 hover:from-rose-600 hover:to-pink-700 hover:shadow-rose-500/40"
              >
                <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
                <span>Add Subject</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <SubjectsQuickStatsSection />

      {/* Main Content Card */}
      <Card className="overflow-hidden border border-white/10 bg-neutral-950/60 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-rose-500/50 to-transparent" />

        <CardHeader className="border-b border-white/10 pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10">
                <BookOpen className="h-4 w-4 text-rose-300" />
              </span>
              Subject Directory
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {/* Toolbar */}
          <div className="mb-6">
            <SubjectsToolbar
              search={search}
              onSearchChange={setSearch}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onOpenFilters={handleOpenFilters}
              onExportAll={handleExport}
              searchInputRef={searchInputRef}
            />
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-rose-400" />
              <p className="mt-3 text-sm text-white/50">Loading subjects...</p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-16">
              <AlertCircle className="h-8 w-8 text-rose-400" />
              <p className="mt-3 text-sm font-medium text-white/70">
                Failed to load subjects
              </p>
              <p className="mt-1 text-xs text-white/50">
                Please try refreshing the page
              </p>
            </div>
          ) : viewMode === "cards" ? (
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
