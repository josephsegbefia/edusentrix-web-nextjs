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
} from "lucide-react";
import { StudentsCardGrid } from "@/components/admin/students/StudentsCardGrid";
import { StudentsTable } from "@/components/admin/students/StudentsTable";
import { StudentsPagination } from "@/components/admin/students/StudentsPagination";
import { StudentsBulkActionsBar } from "@/components/admin/students/StudentsBulkActionsBar";
import { StudentsCommandPalette } from "@/components/admin/students/StudentsCommandPalette";
import { useExportStudents } from "@/hooks/admin/useExportStudents";

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 text-3xl font-bold">Students</h1>
          <p className="text-muted">
            Manage enrollment, class assignment, and academic records across the
            school
          </p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="hidden md:inline-flex"
            onClick={handleImportStudents}
          >
            <Upload className="h-4 w-4" />
            <span>Import Students</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCreateStudent}
          >
            <Plus className="h-4 w-4" />
            <span>Add Student</span>
          </Button>
        </div>
      </div>

      {/* Quick stats dashboard */}
      <StudentsQuickStatsSection />

      {/* Student directory shell */}
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/60 shadow-2xl shadow-black/30 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/10 via-transparent to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -top-24 right-0 h-56 w-56 rounded-full bg-primary/10 blur-3xl"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10 pb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                <GraduationCap className="h-5 w-5 text-white/80" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold text-white">
                  Student Directory
                </CardTitle>
                <p className="text-xs text-white/60">
                  Search, filter, and manage student records in one place.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                Focus search: /
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                Command palette: Ctrl/Cmd+K
              </span>
            </div>
          </div>
          <div className="mt-4 h-px bg-white/10" />
        </CardHeader>
        <CardContent className="relative z-10 space-y-4 pb-6">
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

      {/* Data summary shell – cards/table + pagination will go below in next phases */}
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/60 shadow-2xl shadow-black/30 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/10 via-transparent to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 left-0 h-56 w-56 rounded-full bg-muted/10 blur-3xl"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10 pb-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-white/80">
                Directory Results
              </CardTitle>
              <p className="text-xs text-white/60">
                Live results based on your current filters and sorting.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                View: {viewMode === "cards" ? "Cards" : "Table"}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                Tab: {tab}
              </span>
            </div>
          </div>
          <div className="mt-4 h-px bg-white/10" />
        </CardHeader>
        <CardContent className="relative z-10 pt-2 pb-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
              <p className="text-sm text-muted-foreground">
                Loading students...
              </p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <AlertCircle className="h-8 w-8 text-red-400/60" />
              <p className="text-sm text-red-300/80">
                There was a problem loading students.
              </p>
            </div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <GraduationCap className="h-12 w-12 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                No students found
              </p>
              <p className="text-xs text-muted-foreground/80">
                {search
                  ? "Try adjusting your search or filters"
                  : "Get started by adding your first student"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70 md:flex-row md:items-center md:justify-between">
                <div>
                  Showing{" "}
                  <span className="font-semibold text-white">
                    {students.length} student{students.length === 1 ? "" : "s"}
                  </span>{" "}
                  on page{" "}
                  <span className="font-semibold text-white">
                    {pagination.page}
                  </span>{" "}
                  of {pagination.totalPages}
                </div>
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1">
                    View:{" "}
                    <span className="font-medium">
                      {viewMode === "cards" ? "Cards" : "Table"}
                    </span>
                  </span>
                  <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1">
                    Tab: <span className="font-medium">{tab}</span>
                  </span>
                </div>
              </div>
              {/* Phase 5+: Student cards grid will be rendered here */}
              {/* Phase 6+: Student table view will be rendered here */}
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
