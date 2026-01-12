"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  DEFAULT_STUDENTS_PAGE_SIZE,
  STUDENTS_PAGE_SIZE_OPTIONS,
  type StudentsTabId,
  type StudentsSortBy,
  type StudentsSortOrder,
} from "@/constants/students";
import { useStudentListData } from "@/hooks/admin/useStudents";
import { StudentsTabsNav } from "@/components/admin/students/StudentsTabsNav";
import { StudentsToolbar } from "@/components/admin/students/StudentsToolbar";
import type { StudentsViewMode } from "@/components/admin/students/StudentsViewToggle";
import { StudentsQuickStatsSection } from "@/components/admin/students/StudentsQuickStatsSection";
import {
  Plus,
  Upload,
  Loader2,
  AlertCircle,
  GraduationCap,
  Sparkles,
  ArrowRight,
  Command,
} from "lucide-react";
import { StudentsCardGrid } from "@/components/admin/students/StudentsCardGrid";
import { StudentsTable } from "@/components/admin/students/StudentsTable";
import { StudentsPagination } from "@/components/admin/students/StudentsPagination";
import { StudentsBulkActionsBar } from "@/components/admin/students/StudentsBulkActionsBar";
import { StudentsCommandPalette } from "@/components/admin/students/StudentsCommandPalette";
import { useExportStudents } from "@/hooks/admin/useExportStudents";
import { cn } from "@/lib/utils";

function getInitialTab(sp: URLSearchParams): StudentsTabId {
  const tab = sp.get("tab");
  if (
    tab === "by-class" ||
    tab === "fee-defaulters" ||
    tab === "top-performers" ||
    tab === "recent"
  ) {
    return tab;
  }
  return "all";
}

function getInitialView(sp: URLSearchParams): StudentsViewMode {
  const v = sp.get("view");
  return v === "table" ? "table" : "cards";
}

export default function StudentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = React.useState<StudentsTabId>(() =>
    getInitialTab(searchParams)
  );
  const [viewMode, setViewMode] = React.useState<StudentsViewMode>(() =>
    getInitialView(searchParams)
  );
  const [search, setSearch] = React.useState(searchParams.get("q") ?? "");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_STUDENTS_PAGE_SIZE);

  const [sortBy, setSortBy] = React.useState<StudentsSortBy>("name");
  const [sortOrder, setSortOrder] = React.useState<StudentsSortOrder>("asc");

  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [commandOpen, setCommandOpen] = React.useState(false);

  const searchInputRef = React.useRef<HTMLInputElement | null>(null);

  const debouncedSearch = useDebouncedValue(search, 400);

  const { exportStudents, isExporting } = useExportStudents();

  React.useEffect(() => {
    if (!commandOpen) {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }
  }, [commandOpen]);

  React.useEffect(() => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    params.set("view", viewMode);
    if (debouncedSearch) params.set("q", debouncedSearch);
    params.set("page", String(page));

    router.replace(`/admin/students?${params.toString()}`);
  }, [tab, viewMode, debouncedSearch, page, router]);

  // Reset sort + selection when tab changes (e.g., "recent" should default to latest)
  React.useEffect(() => {
    if (tab === "recent") {
      setSortBy("createdAt");
      setSortOrder("desc");
    } else {
      setSortBy("name");
      setSortOrder("asc");
    }
    setPage(1);
    setSelectedIds([]);
  }, [tab]);

  // Keyboard shortcuts: "/" to focus search, Cmd/Ctrl+K for command palette
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping =
        tag === "input" ||
        tag === "textarea" ||
        (target && target.getAttribute("contenteditable") === "true");

      // "/" focuses search when not already typing
      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select?.();
        }
        return;
      }

      // Cmd/Ctrl + K opens command palette
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const { students, pagination, isLoading, isError } = useStudentListData({
    page,
    limit: pageSize,
    tab,
    sortBy,
    sortOrder,
    filters: {
      search: debouncedSearch || undefined,
    },
  });

  function handleTabChange(next: StudentsTabId) {
    setTab(next);
    setPage(1);
  }

  function handleSearchChange(next: string) {
    setSearch(next);
    setPage(1);
    setSelectedIds([]);
  }

  function handleViewModeChange(next: StudentsViewMode) {
    setViewMode(next);
  }

  function handleSortChange(column: StudentsSortBy) {
    setSortBy((prevSortBy) => {
      if (prevSortBy === column) {
        setSortOrder((prevOrder) => (prevOrder === "asc" ? "desc" : "asc"));
        return prevSortBy;
      } else {
        setSortOrder("asc");
        return column;
      }
    });
    setPage(1);
  }

  function handleToggleRow(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleToggleAllVisible(visibleIds: string[]) {
    setSelectedIds((prev) => {
      const allVisibleSelected =
        visibleIds.length > 0 && visibleIds.every((id) => prev.includes(id));

      if (allVisibleSelected) {
        // Deselect all visible
        return prev.filter((id) => !visibleIds.includes(id));
      }

      // Select all visible (merge with current selection)
      const set = new Set(prev);
      visibleIds.forEach((id) => set.add(id));
      return Array.from(set);
    });
  }

  function handleChangePage(nextPage: number) {
    setPage(nextPage);
    setSelectedIds([]);
  }

  function handleChangePageSize(nextSize: number) {
    setPageSize(nextSize);
    setPage(1);
    setSelectedIds([]);
  }

  // Phase 8: Bulk actions handlers – API wiring will come later
  function handleClearSelection() {
    setSelectedIds([]);
  }

  function handleBulkAssignClass() {
    console.log("Bulk assign class for students: ", selectedIds);
    // TODO: open bulk assign class modal
  }

  function handleBulkSendMessage() {
    console.log("Bulk message parents for students: ", selectedIds);
    // TODO: open bulk message dialog
  }

  function handleBulkExportSelected() {
    if (!selectedIds.length) return;
    exportStudents({
      format: "csv",
      tab,
      sortBy,
      sortOrder,
      filters: { search: debouncedSearch || undefined },
      selectedIds,
    });
  }

  function handleBulkChangeStatus() {
    console.log("Bulk change status for students: ", selectedIds);
    // TODO: open status change modal (active/inactive/withdrawn)
  }

  function handleBulkMarkFeesCleared() {
    console.log("Bulk mark fees cleared for students: ", selectedIds);
    // TODO: integrate with fees system when available
  }

  // Phase 9: export current list with filters (all rows in current filter, not just current page)
  function handleExportAll() {
    exportStudents({
      format: "csv",
      tab,
      sortBy,
      sortOrder,
      filters: { search: debouncedSearch || undefined },
    });
  }

  function handleGoToTabFromPalette(nextTab: StudentsTabId) {
    setTab(nextTab);
    setCommandOpen(false);
  }

  function handleCreateStudent() {
    // TODO Phase 10: open CreateStudent modal/wizard
    console.log("Open create student flow");
  }

  function handleImportStudents() {
    // TODO Phase 9: open import CSV dialog
    console.log("Open import students dialog");
  }

  return (
    <div className="space-y-8">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 via-slate-950/95 to-black p-8 shadow-2xl shadow-black/40">
        {/* Background decorations */}
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-teal-500/20 via-cyan-500/10 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-gradient-to-tr from-sky-500/10 via-blue-500/5 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-teal-500/20 to-cyan-500/20 shadow-lg shadow-teal-500/10">
                <GraduationCap className="h-6 w-6 text-teal-300" />
              </div>
        <div>
                <h1 className="text-3xl font-bold tracking-tight text-white">
                  Students
                </h1>
                <p className="text-sm text-white/60">
                  Enrollment & academic records
                </p>
              </div>
            </div>
            <p className="max-w-lg text-sm leading-relaxed text-white/50">
              Manage enrollment, class assignments, and academic records. Track
              performance, fees, and student progress across your school.
          </p>
        </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
              className="group gap-2 border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10 hover:text-white"
            onClick={handleImportStudents}
          >
              <Upload className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
              <span>Import CSV</span>
          </Button>
          <Button
            type="button"
            size="sm"
              className="group gap-2 bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/25 hover:from-teal-600 hover:to-cyan-700 hover:shadow-teal-500/40"
            onClick={handleCreateStudent}
          >
              <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
            <span>Add Student</span>
              <ArrowRight className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:translate-x-0.5" />
          </Button>
          </div>
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="relative z-10 mt-6 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
          <span className="text-[11px] uppercase tracking-wider text-white/40">
            Shortcuts
          </span>
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/60">
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">
              /
            </kbd>
            <span>Focus search</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/60">
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">
              <Command className="inline h-2.5 w-2.5" />K
            </kbd>
            <span>Command palette</span>
          </div>
        </div>
      </div>

      {/* Quick stats dashboard */}
      <StudentsQuickStatsSection />

      {/* Student directory shell */}
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
        {/* Decorative elements */}
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-500/5 via-transparent to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
          aria-hidden="true"
        />

        <CardHeader className="relative z-10 border-b border-white/5 pb-0">
          <div className="flex flex-col gap-4 pb-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 shadow-inner shadow-white/5">
                  <Sparkles className="h-5 w-5 text-teal-300" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-900 bg-emerald-400" />
              </div>
              <div className="space-y-0.5">
                <CardTitle className="text-lg font-semibold tracking-tight text-white">
                  Student Directory
                </CardTitle>
                <p className="text-xs text-white/50">
                  Search, filter, and manage student records
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-[10px] font-medium text-teal-300">
                {pagination?.total ?? 0} total
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative z-10 space-y-5 p-6">
          <StudentsTabsNav value={tab} onChange={handleTabChange} />
          <StudentsToolbar
            search={search}
            onSearchChange={handleSearchChange}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            onOpenFilters={() => {
              // Phase 4: show advanced filters panel
            }}
            onExportAll={handleExportAll}
            exportingAll={isExporting}
            searchInputRef={searchInputRef}
          />
        </CardContent>
      </Card>

      {/* Data summary shell – cards/table + pagination */}
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
        {/* Decorative elements */}
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-cyan-500/5 via-transparent to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
          aria-hidden="true"
        />

        <CardHeader className="relative z-10 border-b border-white/5 pb-0">
          <div className="flex flex-col gap-3 pb-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                Directory Results
              </CardTitle>
              <p className="text-sm text-white/80">
                {isLoading
                  ? "Loading..."
                  : `${pagination?.total ?? 0} students found`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors",
                  viewMode === "cards"
                    ? "border-teal-500/30 bg-teal-500/10 text-teal-300"
                    : "border-white/10 bg-white/5 text-white/60"
                )}
              >
                {viewMode === "cards" ? "Cards" : "Table"} view
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium capitalize text-white/60">
                {tab === "all" ? "All students" : tab.replace("-", " ")}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative z-10 p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <div className="relative">
                <div className="h-12 w-12 animate-spin rounded-full border-2 border-teal-500/20 border-t-teal-500" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <GraduationCap className="h-5 w-5 text-teal-400/60" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white/80">
                Loading students...
              </p>
                <p className="text-xs text-white/50">
                  Fetching your student directory
                </p>
              </div>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
                <AlertCircle className="h-7 w-7 text-red-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-red-300">
                  Failed to load students
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
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-white/10 to-white/5">
                  <GraduationCap className="h-10 w-10 text-white/30" />
                </div>
                <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-900 bg-teal-500">
                  <Plus className="h-4 w-4 text-white" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-base font-medium text-white/80">
                No students found
              </p>
                <p className="mt-1 max-w-xs text-sm text-white/50">
                {search
                    ? "Try adjusting your search or filters to find what you're looking for"
                    : "Get started by adding your first student to the directory"}
                </p>
              </div>
              {!search && (
                <Button
                  size="sm"
                  className="mt-2 gap-2 bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/25 hover:from-teal-600 hover:to-cyan-700"
                  onClick={handleCreateStudent}
                >
                  <Plus className="h-4 w-4" />
                  Add your first student
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Results summary bar */}
              <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-gradient-to-r from-white/5 to-transparent px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-500/20 text-[10px] font-bold text-teal-300">
                    {students.length}
                  </span>
                  <span>
                    student{students.length === 1 ? "" : "s"} on page{" "}
                    <span className="font-medium text-white">
                    {pagination.page}
                  </span>{" "}
                    of{" "}
                    <span className="font-medium text-white">
                      {pagination.totalPages}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-white/50">
                  <span>
                    Total:{" "}
                    <span className="font-medium text-white/70">
                      {pagination.total}
                    </span>{" "}
                    records
                  </span>
                </div>
              </div>

              {viewMode === "cards" ? (
                <StudentsCardGrid
                  students={students}
                  onView={(id) => {
                    // Later: /admin/students/[id] detail page
                    router.push(`/admin/students/${id}`);
                  }}
                  onEdit={(id) => {
                    // TODO: open edit student modal
                    console.log("Edit student", id);
                  }}
                  onAssignClass={(id) => {
                    // TODO: open assign/change class flow
                    console.log("Assign class for", id);
                  }}
                  onRecordPayment={(id) => {
                    // TODO: open record payment modal
                    console.log("Record payment for", id);
                  }}
                  onSendMessage={(id) => {
                    // TODO: open message parent dialog
                    console.log("Message parent for", id);
                  }}
                />
              ) : (
                <StudentsTable
                  students={students}
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSortChange={handleSortChange}
                  selectedIds={selectedIds}
                  onToggleRow={handleToggleRow}
                  onToggleAllVisible={handleToggleAllVisible}
                  onView={(id) => {
                    router.push(`/admin/students/${id}`);
                  }}
                  onEdit={(id) => {
                    // TODO: open edit student modal
                    console.log("Edit student", id);
                  }}
                  onAssignClass={(id) => {
                    // TODO: open assign/change class flow
                    console.log("Assign class for", id);
                  }}
                  onRecordPayment={(id) => {
                    // TODO: open record payment modal
                    console.log("Record payment for", id);
                  }}
                  onSendMessage={(id) => {
                    // TODO: open message parent dialog
                    console.log("Message parent for", id);
                  }}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phase 7+: Pagination component will be plugged here */}
      {!isLoading &&
        !isError &&
        pagination.total > 0 &&
        pagination.totalPages > 0 && (
          <StudentsPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            pageSize={pageSize}
            pageSizeOptions={STUDENTS_PAGE_SIZE_OPTIONS}
            onChangePage={handleChangePage}
            onChangePageSize={handleChangePageSize}
          />
        )}

      {/* Phase 8: Bulk actions toolbar */}
      {selectedIds.length > 0 && (
        <StudentsBulkActionsBar
          selectedCount={selectedIds.length}
          onClearSelection={handleClearSelection}
          onAssignClass={handleBulkAssignClass}
          onSendMessage={handleBulkSendMessage}
          onExportSelected={handleBulkExportSelected}
          onChangeStatus={handleBulkChangeStatus}
          onMarkFeesCleared={handleBulkMarkFeesCleared}
        />
      )}

      {/* Phase 9: Command palette for power actions */}
      <StudentsCommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onFocusSearch={() => {
          if (searchInputRef.current) {
            searchInputRef.current.focus();
            searchInputRef.current.select?.();
          }
        }}
        onGoToTab={handleGoToTabFromPalette}
        onCreateStudent={handleCreateStudent}
        onImportStudents={handleImportStudents}
      />
    </div>
  );
}
