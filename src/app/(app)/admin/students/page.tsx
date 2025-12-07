"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  DEFAULT_STUDENTS_PAGE_SIZE,
  type StudentsTabId,
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

  const debouncedSearch = useDebouncedValue(search, 400);

  React.useEffect(() => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    params.set("view", viewMode);
    if (debouncedSearch) params.set("q", debouncedSearch);
    params.set("page", String(page));

    router.replace(`/admin/students?${params.toString()}`);
  }, [tab, viewMode, debouncedSearch, page, router]);

  const { students, pagination, isLoading, isError } = useStudentListData({
    page,
    limit: DEFAULT_STUDENTS_PAGE_SIZE,
    tab,
    sortBy: tab === "recent" ? "createdAt" : "name",
    sortOrder: tab === "recent" ? "desc" : "asc",
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
  }

  function handleViewModeChange(next: StudentsViewMode) {
    setViewMode(next);
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
            onClick={() => {
              // TODO Phase 9: open import CSV dialog
            }}
          >
            <Upload className="h-4 w-4" />
            <span>Import Students</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              // TODO Phase 10: open CreateStudent modal/wizard
            }}
          >
            <Plus className="h-4 w-4" />
            <span>Add Student</span>
          </Button>
        </div>
      </div>

      {/* Quick stats dashboard */}
      <StudentsQuickStatsSection />

      {/* Student directory shell */}
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/5 via-primary/2 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10 pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-white/80">
            Student Directory
          </CardTitle>
        </CardHeader>
        <CardContent className="relative z-10 space-y-4">
          <StudentsTabsNav value={tab} onChange={handleTabChange} />
          <StudentsToolbar
            search={search}
            onSearchChange={handleSearchChange}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            onOpenFilters={() => {
              // Phase 4: show advanced filters panel
            }}
          />
        </CardContent>
      </Card>

      {/* Data summary shell – cards/table + pagination will go below in next phases */}
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-muted/10 via-muted/5 to-transparent"
          aria-hidden="true"
        />
        <CardContent className="relative z-10 py-8">
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
              <div className="flex items-center justify-between text-sm">
                <div className="text-muted-foreground">
                  Showing{" "}
                  <span className="font-semibold text-foreground">
                    {students.length} student{students.length === 1 ? "" : "s"}
                  </span>{" "}
                  on page{" "}
                  <span className="font-semibold text-foreground">
                    {pagination.page}
                  </span>{" "}
                  of {pagination.totalPages}
                </div>
                <div className="hidden items-center gap-2 text-xs text-muted-foreground/80 md:flex">
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
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-muted-foreground/80">
                  Table view coming soon.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phase 7+: Pagination component will be plugged here */}
    </div>
  );
}
