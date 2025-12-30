// src/app/(app)/admin/teachers/page.tsx
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Upload } from "lucide-react";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  DEFAULT_TEACHERS_PAGE_SIZE,
  getInitialTeacherTab,
  getInitialTeacherView,
  type TeachersTabId,
  type TeachersViewMode,
  type TeachersSortBy,
  type TeachersSortOrder,
} from "@/constants/teachers";

import { useTeacherListData } from "@/hooks/admin/useTeachers";
import { TeachersQuickStatsSection } from "@/components/admin/teachers/TeachersQuickStatsSection";
import { TeachersTabsNav } from "@/components/admin/teachers/TeachersTabsNav";
import { TeachersToolbar } from "@/components/admin/teachers/TeachersToolbar";
import { TeachersTable } from "@/components/admin/teachers/TeachersTable";
import { TeachersCardGrid } from "@/components/admin/teachers/TeachersCardGrid";
import { TeachersPagination } from "@/components/admin/teachers/TeachersPagination";
import { TeachersBulkActionsBar } from "@/components/admin/teachers/TeachersBulkActionsBar";

function isTypingTarget(el: EventTarget | null) {
  if (!el || !(el as HTMLElement).tagName) return false;
  const tag = (el as HTMLElement).tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    (el as HTMLElement).isContentEditable
  );
}

export default function TeachersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = React.useState<TeachersTabId>(() =>
    getInitialTeacherTab(searchParams)
  );
  const [viewMode, setViewMode] = React.useState<TeachersViewMode>(() =>
    getInitialTeacherView(searchParams)
  );
  const [search, setSearch] = React.useState(searchParams.get("q") ?? "");
  const [page, setPage] = React.useState(
    Number(searchParams.get("page") ?? "1") || 1
  );

  const [pageSize] = React.useState(DEFAULT_TEACHERS_PAGE_SIZE);
  const [sortBy] = React.useState<TeachersSortBy>("name");
  const [sortOrder] = React.useState<TeachersSortOrder>("asc");

  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const debouncedSearch = useDebouncedValue(search, 400);

  // URL sync (same pattern as Students)
  React.useEffect(() => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    params.set("view", viewMode);
    if (debouncedSearch) params.set("q", debouncedSearch);
    params.set("page", String(page));
    router.replace(`/admin/teachers?${params.toString()}`);
  }, [tab, viewMode, debouncedSearch, page, router]);

  // Keyboard shortcuts: "/" focuses search
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "/" && !isTypingTarget(e.target)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const { teachers, pagination, isLoading, isError } = useTeacherListData({
    page,
    limit: pageSize,
    tab,
    sortBy,
    sortOrder,
    filters: { search: debouncedSearch || undefined },
  });

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  function handleTabChange(next: TeachersTabId) {
    setTab(next);
    setPage(1);
    clearSelection();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 text-3xl font-bold">Teachers</h1>
          <p className="text-sm text-muted-foreground">
            Manage staff profiles, subjects, and homeroom assignments.
          </p>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => alert("CSV import coming next")}
          >
            <Upload className="h-4 w-4" />
            Import
          </Button>
          <Button
            className="gap-2"
            onClick={() => router.push("/admin/teachers/create")}
          >
            <Plus className="h-4 w-4" />
            Add Teacher
          </Button>
        </div>
      </div>

      {/* Quick stats */}
      <TeachersQuickStatsSection />

      {/* Directory card */}
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader>
          <CardTitle>Teacher Directory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TeachersTabsNav value={tab} onChange={handleTabChange} />

          <TeachersToolbar
            search={search}
            onSearchChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onOpenFilters={() => alert("Advanced filters coming next")}
            onExportAll={() => alert("Export coming next")}
            searchInputRef={searchInputRef}
          />
        </CardContent>
      </Card>

      {/* Data */}
      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
              <p className="text-sm text-muted-foreground">Loading teachers…</p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <p className="text-sm text-red-300/80">Error loading teachers.</p>
            </div>
          ) : teachers.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <p className="text-sm font-medium text-muted-foreground">
                No teachers found
              </p>
              <p className="text-xs text-muted-foreground/80">
                Try adjusting your search or filters.
              </p>
            </div>
          ) : viewMode === "cards" ? (
            <TeachersCardGrid
              teachers={teachers}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
            />
          ) : (
            <TeachersTable
              teachers={teachers}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
            />
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      <TeachersPagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        onPageChange={(p) => {
          setPage(p);
          clearSelection();
        }}
      />

      {/* Bulk actions */}
      {selectedIds.length > 0 ? (
        <TeachersBulkActionsBar
          count={selectedIds.length}
          onClear={clearSelection}
        />
      ) : null}
    </div>
  );
}
