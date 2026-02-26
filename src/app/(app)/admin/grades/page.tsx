"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  DEFAULT_GRADES_PAGE_SIZE,
  GRADES_PAGE_SIZE_OPTIONS,
  type GradesSortBy,
  type GradesSortOrder,
} from "@/constants/grades";
import { useGrades, type GradeDTO } from "@/hooks/admin/useGrades";
import type { GradesViewMode } from "@/components/admin/grades/GradesViewToggle";
import {
  GraduationCap,
  AlertCircle,
  Sparkles,
  Command,
} from "lucide-react";
import { GradesToolbar } from "@/components/admin/grades/GradesToolbar";
import { GradesQuickStatsSection } from "@/components/admin/grades/GradesQuickStatsSection";
import { GradesCardGrid } from "@/components/admin/grades/GradesCardGrid";
import { GradesTable } from "@/components/admin/grades/GradesTable";
import { GradesPagination } from "@/components/admin/grades/GradesPagination";
import { GradesCommandPalette } from "@/components/admin/grades/GradesCommandPalette";
import { GradesFiltersPanel, type GradesFilters } from "@/components/admin/grades/GradesFiltersPanel";
import { cn } from "@/lib/utils";
import { notifyComingSoon } from "@/lib/ui/feature-notices";

function getInitialView(sp: URLSearchParams): GradesViewMode {
  const v = sp.get("view");
  return v === "table" ? "table" : "cards";
}

export default function GradesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [viewMode, setViewMode] = React.useState<GradesViewMode>(() =>
    getInitialView(searchParams)
  );
  const [search, setSearch] = React.useState(searchParams.get("q") ?? "");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_GRADES_PAGE_SIZE);
  const [sortBy, setSortBy] = React.useState<GradesSortBy>("order");
  const [sortOrder, setSortOrder] = React.useState<GradesSortOrder>("asc");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [advancedFilters, setAdvancedFilters] = React.useState<GradesFilters>({});

  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const debouncedSearch = useDebouncedValue(search, 400);

  const { data, isLoading, isError } = useGrades(undefined, true);
  const allGrades = data?.data ?? [];

  React.useEffect(() => {
    if (!commandOpen) {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }
  }, [commandOpen]);

  React.useEffect(() => {
    const params = new URLSearchParams();
    params.set("view", viewMode);
    if (debouncedSearch) params.set("q", debouncedSearch);
    params.set("page", String(page));
    router.replace(`/admin/grades?${params.toString()}`);
  }, [viewMode, debouncedSearch, page, router]);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        (target && target.getAttribute("contenteditable") === "true");

      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select?.();
        }
        return;
      }

      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Filter and sort grades (client-side)
  const filteredGrades = React.useMemo(() => {
    let list = [...allGrades];

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          (g.code?.toLowerCase().includes(q) ?? false) ||
          g.stage.toLowerCase().includes(q)
      );
    }

    if (advancedFilters.stage) {
      list = list.filter((g) => g.stage === advancedFilters.stage);
    }
    if (advancedFilters.isActive !== undefined) {
      list = list.filter((g) => g.isActive === advancedFilters.isActive);
    }

    const mult = sortOrder === "desc" ? -1 : 1;
    list.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name) * mult;
        case "code":
          return (a.code ?? "").localeCompare(b.code ?? "") * mult;
        case "stage":
          return a.stage.localeCompare(b.stage) * mult;
        case "classCount":
          return ((a.classCount ?? 0) - (b.classCount ?? 0)) * mult;
        case "studentCount":
          return ((a.studentCount ?? 0) - (b.studentCount ?? 0)) * mult;
        case "order":
        default:
          return (a.order - b.order) * mult;
      }
    });

    return list;
  }, [allGrades, debouncedSearch, advancedFilters, sortBy, sortOrder]);

  const totalFiltered = filteredGrades.length;
  const paginatedGrades = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredGrades.slice(start, start + pageSize);
  }, [filteredGrades, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));

  const activeFilterCount = Object.values(advancedFilters).filter(
    (v) => v !== undefined && v !== "" && v !== "all"
  ).length;

  function handleSearchChange(next: string) {
    setSearch(next);
    setPage(1);
    setSelectedIds([]);
  }

  function handleViewModeChange(next: GradesViewMode) {
    setViewMode(next);
  }

  function handleSortChange(column: GradesSortBy) {
    setSortBy((prev) => {
      if (prev === column) {
        setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortOrder("asc");
      return column;
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
        return prev.filter((id) => !visibleIds.includes(id));
      }
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

  function handleApplyFilters(newFilters: GradesFilters) {
    setAdvancedFilters(newFilters);
    setPage(1);
    setSelectedIds([]);
  }

  function handleExportAll() {
    notifyComingSoon("Export grades");
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Premium Header - blue/indigo theme */}
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
                <GraduationCap className="h-5 w-5 text-blue-300 sm:h-6 sm:w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Grades
                </h1>
                <p className="text-xs text-white/60 sm:text-sm">
                  Grades contain classes
                </p>
              </div>
            </div>
            <p className="hidden max-w-lg text-sm leading-relaxed text-white/50 sm:block">
              Manage grade levels and their classes. Each grade groups classes
              together. Navigate to a grade to add classes and assign subjects.
            </p>
          </div>
        </div>

        {/* Keyboard shortcuts hint */}
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
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/60">
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">
              <Command className="inline h-2.5 w-2.5" />K
            </kbd>
            <span>Command palette</span>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <GradesQuickStatsSection />

      {/* Grades directory shell */}
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
                  Grade Directory
                </CardTitle>
                <p className="text-[11px] text-white/50 sm:text-xs">
                  Search, filter, and manage grades
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[10px] font-medium text-blue-300">
                {totalFiltered} total
              </span>
              {activeFilterCount > 0 && (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-medium text-amber-300">
                  {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative z-10 space-y-4 p-4 sm:space-y-5 sm:p-6">
          <GradesToolbar
            search={search}
            onSearchChange={handleSearchChange}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            onOpenFilters={() => setFiltersOpen((prev) => !prev)}
            onExportAll={handleExportAll}
            searchInputRef={searchInputRef}
            activeFilterCount={activeFilterCount}
            stageFilter={advancedFilters.stage}
            onStageFilterChange={(s) =>
              setAdvancedFilters((prev) => ({ ...prev, stage: s }))
            }
            statusFilter={
              advancedFilters.isActive === undefined
                ? "all"
                : advancedFilters.isActive
                ? "active"
                : "inactive"
            }
            onStatusFilterChange={(s) =>
              setAdvancedFilters((prev) => ({
                ...prev,
                isActive:
                  s === "all" ? undefined : s === "active",
              }))
            }
          />

          <GradesFiltersPanel
            open={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            filters={advancedFilters}
            onApply={handleApplyFilters}
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
                {isLoading
                  ? "Loading..."
                  : `${totalFiltered} grades found`}
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
                  <GraduationCap className="h-5 w-5 text-blue-400/60" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white/80">
                  Loading grades...
                </p>
                <p className="text-xs text-white/50">
                  Fetching your grade directory
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
                  Failed to load grades
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
          ) : paginatedGrades.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12 sm:py-16">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-linear-to-br from-white/10 to-white/5">
                  <GraduationCap className="h-10 w-10 text-white/30" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-base font-medium text-white/80">
                  No grades found
                </p>
                <p className="mt-1 max-w-xs text-sm text-white/50">
                  {search || activeFilterCount > 0
                    ? "Try adjusting your search or filters to find what you're looking for"
                    : "Grades are typically configured in curriculum settings"}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-5">
              <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-linear-to-r from-white/5 to-transparent px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2 text-xs text-white/70 sm:text-sm">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20 text-[9px] font-bold text-blue-300 sm:h-6 sm:w-6 sm:text-[10px]">
                    {paginatedGrades.length}
                  </span>
                  <span>
                    grade{paginatedGrades.length === 1 ? "" : "s"} on page{" "}
                    <span className="font-medium text-white">{page}</span> of{" "}
                    <span className="font-medium text-white">{totalPages}</span>
                  </span>
                </div>
              </div>

              {viewMode === "cards" ? (
                <GradesCardGrid
                  grades={paginatedGrades}
                  onView={(id) => router.push(`/admin/grades/${id}`)}
                  onEdit={(id) => {
                    void id;
                    notifyComingSoon("Edit grade");
                  }}
                />
              ) : (
                <GradesTable
                  grades={paginatedGrades}
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSortChange={handleSortChange}
                  selectedIds={selectedIds}
                  onToggleRow={handleToggleRow}
                  onToggleAllVisible={handleToggleAllVisible}
                  onView={(id) => router.push(`/admin/grades/${id}`)}
                  onEdit={(id) => {
                    void id;
                    notifyComingSoon("Edit grade");
                  }}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!isLoading &&
        !isError &&
        totalFiltered > 0 &&
        totalPages > 0 && (
          <GradesPagination
            page={page}
            totalPages={totalPages}
            total={totalFiltered}
            pageSize={pageSize}
            pageSizeOptions={GRADES_PAGE_SIZE_OPTIONS}
            onChangePage={handleChangePage}
            onChangePageSize={handleChangePageSize}
          />
        )}

      {/* Command palette */}
      <GradesCommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onFocusSearch={() => {
          if (searchInputRef.current) {
            searchInputRef.current.focus();
            searchInputRef.current.select?.();
          }
        }}
      />
    </div>
  );
}
