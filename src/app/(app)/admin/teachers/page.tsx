/* eslint-disable @typescript-eslint/no-unused-vars */
// src/app/(app)/admin/teachers/page.tsx
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Upload, Loader2, AlertCircle, Users, X } from "lucide-react";

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
import { TeachersCommandPalette } from "@/components/admin/teachers/TeachersCommandPalette";

import CreateTeacherModal from "@/components/modals/CreateTeacherModal";
import EditTeacherModal from "@/components/modals/EditTeacherModal";
import { ImportTeachersCSVModal } from "@/components/modals/ImportTeachersCSVModal";
import { TeachersAdvancedFiltersDialog } from "@/components/admin/teachers/TeachersAdvancedFiltersDialog";
import {
  useCreateTeacher,
  useUpdateTeacher,
  useTeacher,
  useActivateTeacher,
  useDeactivateTeacher,
  useDeleteTeacher,
} from "@/hooks/admin/useTeachers";
import { useBusyToast } from "@/hooks/useBusyToast";

function isTypingTarget(el: EventTarget | null) {
  if (!el || !(el as HTMLElement).tagName) return false;
  const tag = (el as HTMLElement).tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    (el as HTMLElement).isContentEditable
  );
}

function TeacherModalShell({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      />
      <div className="relative z-10 flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-[860px] overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 text-white shadow-2xl shadow-black/40">
          <div className="px-6 pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h1 className="text-lg font-semibold">{title}</h1>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-5 h-px bg-white/10" />
          </div>
          <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
            {children}
          </div>
        </div>
      </div>
    </div>
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

  const [sortBy, setSortBy] = React.useState<TeachersSortBy>(
    (searchParams.get("sortBy") as TeachersSortBy) || "name"
  );
  const [sortOrder, setSortOrder] = React.useState<TeachersSortOrder>(
    (searchParams.get("sortOrder") as TeachersSortOrder) || "asc"
  );

  // filters (URL-synced)
  const [filters, setFilters] = React.useState(() => ({
    subjectId: searchParams.get("subjectId") ?? "",
    classGroupId: searchParams.get("classGroupId") ?? "",
    department: searchParams.get("department") ?? "",
  }));

  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [editTeacherId, setEditTeacherId] = React.useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [commandOpen, setCommandOpen] = React.useState(false);

  const createTeacher = useCreateTeacher();
  const updateTeacher = useUpdateTeacher();
  const activateTeacher = useActivateTeacher();
  const deactivateTeacher = useDeactivateTeacher();
  const deleteTeacher = useDeleteTeacher();
  const busy = useBusyToast();

  const isChangingStatus =
    activateTeacher.isPending ||
    deactivateTeacher.isPending ||
    deleteTeacher.isPending;

  React.useEffect(() => {
    const hasOverlayOpen =
      createOpen ||
      importOpen ||
      !!editTeacherId ||
      filtersOpen ||
      commandOpen;

    if (!hasOverlayOpen) {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }
  }, [createOpen, importOpen, editTeacherId, filtersOpen, commandOpen]);

  const handleActivateTeacher = async (teacherId: string) => {
    const teacher = teachers.find((t) => t.id === teacherId);
    try {
      await busy.promise(activateTeacher.mutateAsync(teacherId), {
        loading: "Activating teacher...",
        success: `${teacher?.fullName || "Teacher"} activated successfully`,
        error: (e: Error) => e.message || "Failed to activate teacher",
      });
    } catch {
      // Error already handled by busy.promise
    }
  };

  const handleDeactivateTeacher = async (teacherId: string) => {
    const teacher = teachers.find((t) => t.id === teacherId);
    if (
      !confirm(
        `Are you sure you want to deactivate ${
          teacher?.fullName || "this teacher"
        }?`
      )
    )
      return;
    try {
      await busy.promise(deactivateTeacher.mutateAsync(teacherId), {
        loading: "Deactivating teacher...",
        success: `${teacher?.fullName || "Teacher"} deactivated successfully`,
        error: (e: Error) => e.message || "Failed to deactivate teacher",
      });
    } catch {
      // Error already handled by busy.promise
    }
  };

  const handleDeleteTeacher = async (teacherId: string) => {
    const teacher = teachers.find((t) => t.id === teacherId);
    if (
      !confirm(
        `Are you sure you want to terminate ${
          teacher?.fullName || "this teacher"
        }?\n\nThis will:\n• Set their status to "Terminated"\n• Deactivate all their active assignments\n• Remove them as homeroom teacher (if applicable)\n\nThis action cannot be undone.`
      )
    )
      return;
    try {
      await busy.promise(deleteTeacher.mutateAsync(teacherId), {
        loading: "Terminating teacher...",
        success: `${teacher?.fullName || "Teacher"} terminated successfully`,
        error: (e: Error) => e.message || "Failed to terminate teacher",
      });
    } catch {
      // Error already handled by busy.promise
    }
  };

  // Fetch teacher detail when editing
  const { data: editTeacherData, isLoading: editTeacherLoading } = useTeacher(
    editTeacherId ?? ""
  );
  const editTeacher = editTeacherData?.data;

  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const debouncedSearch = useDebouncedValue(search, 400);

  // URL sync
  React.useEffect(() => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    params.set("view", viewMode);
    if (debouncedSearch) params.set("q", debouncedSearch);
    params.set("page", String(page));
    params.set("sortBy", sortBy);
    params.set("sortOrder", sortOrder);

    if (filters.subjectId) params.set("subjectId", filters.subjectId);
    if (filters.classGroupId) params.set("classGroupId", filters.classGroupId);
    if (filters.department) params.set("department", filters.department);

    router.replace(`/admin/teachers?${params.toString()}`);
  }, [
    tab,
    viewMode,
    debouncedSearch,
    page,
    sortBy,
    sortOrder,
    filters,
    router,
  ]);

  // Keyboard shortcuts: "/" focuses search, Cmd/Ctrl+K opens command palette
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "/" && !isTypingTarget(e.target)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((v) => !v);
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
    filters: {
      search: debouncedSearch || undefined,
      subjectId: filters.subjectId || undefined,
      classGroupId: filters.classGroupId || undefined,
      department: filters.department || undefined,
    },
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
          <p className="text-muted">
            Manage staff profiles, subjects, and homeroom assignments across the
            school
          </p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="hidden md:inline-flex"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="h-4 w-4" />
            <span>Import Teachers</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" />
            <span>Add Teacher</span>
          </Button>
        </div>
      </div>

      {/* Quick stats */}
      <TeachersQuickStatsSection />

      {/* Teacher directory shell */}
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
                <Users className="h-5 w-5 text-white/80" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold text-white">
                  Teacher Directory
                </CardTitle>
                <p className="text-xs text-white/60">
                  Search, filter, and manage staff profiles in one place.
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
          <TeachersTabsNav value={tab} onChange={handleTabChange} />
          <TeachersToolbar
            search={search}
            onSearchChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onOpenFilters={() => setFiltersOpen(true)}
            onExportAll={() => alert("Export coming next")}
            searchInputRef={searchInputRef}
          />
        </CardContent>
      </Card>

      {/* Data summary shell – cards/table + pagination */}
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
                Loading teachers...
              </p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <AlertCircle className="h-8 w-8 text-red-400/60" />
              <p className="text-sm text-red-300/80">
                There was a problem loading teachers.
              </p>
            </div>
          ) : teachers.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Users className="h-12 w-12 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                No teachers found
              </p>
              <p className="text-xs text-muted-foreground/80">
                {search
                  ? "Try adjusting your search or filters"
                  : "Get started by adding your first teacher"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70 md:flex-row md:items-center md:justify-between">
                <div>
                  Showing{" "}
                  <span className="font-semibold text-white">
                    {teachers.length} teacher{teachers.length === 1 ? "" : "s"}
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
              {viewMode === "cards" ? (
                <TeachersCardGrid
                  teachers={teachers}
                  onView={(id) => {
                    router.push(`/admin/teachers/${id}`);
                  }}
                  onEdit={(id) => {
                    setEditTeacherId(id);
                  }}
                  onManageAccess={(id) => {
                    // TODO: open manage access modal
                    console.log("Manage access for", id);
                  }}
                  onSendMessage={(id) => {
                    // TODO: open send message dialog
                    console.log("Send message to", id);
                  }}
                />
              ) : (
                <TeachersTable
                  teachers={teachers}
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSortChange={(column) => {
                    setSortBy((prevSortBy) => {
                      if (prevSortBy === column) {
                        setSortOrder((prevOrder) =>
                          prevOrder === "asc" ? "desc" : "asc"
                        );
                        return prevSortBy;
                      } else {
                        setSortOrder("asc");
                        return column;
                      }
                    });
                    setPage(1);
                  }}
                  selectedIds={selectedIds}
                  onToggleRow={toggleSelect}
                  onToggleAllVisible={(visibleIds) => {
                    setSelectedIds((prev) => {
                      const allVisibleSelected =
                        visibleIds.length > 0 &&
                        visibleIds.every((id) => prev.includes(id));

                      if (allVisibleSelected) {
                        // Deselect all visible
                        return prev.filter((id) => !visibleIds.includes(id));
                      }

                      // Select all visible (merge with current selection)
                      const set = new Set(prev);
                      visibleIds.forEach((id) => set.add(id));
                      return Array.from(set);
                    });
                  }}
                  onView={(id) => {
                    router.push(`/admin/teachers/${id}`);
                  }}
                  onEdit={(id) => {
                    setEditTeacherId(id);
                  }}
                  onManageAccess={(id) => {
                    // TODO: open manage access modal
                    console.log("Manage access for", id);
                  }}
                  onSendMessage={(id) => {
                    // TODO: open send message dialog
                    console.log("Send message to", id);
                  }}
                  onActivate={handleActivateTeacher}
                  onDeactivate={handleDeactivateTeacher}
                  onDelete={handleDeleteTeacher}
                  isChangingStatus={isChangingStatus}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!isLoading &&
        !isError &&
        pagination.total > 0 &&
        pagination.totalPages > 0 && (
          <TeachersPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={(p) => {
              setPage(p);
              clearSelection();
            }}
          />
        )}

      {/* Bulk actions */}
      {selectedIds.length > 0 ? (
        <TeachersBulkActionsBar
          count={selectedIds.length}
          selectedIds={selectedIds}
          onClear={clearSelection}
        />
      ) : null}

      {/* Import Teachers */}
      <ImportTeachersCSVModal open={importOpen} onOpenChange={setImportOpen} />

      {/* Create Teacher */}
      <TeacherModalShell
        open={createOpen}
        title="Create Teacher"
        onClose={() => setCreateOpen(false)}
      >
        <CreateTeacherModal
          onClose={() => {
            setCreateOpen(false);
            clearSelection();
          }}
          onSubmit={async (payload) => {
            await createTeacher.mutateAsync(payload);
          }}
          isLoading={createTeacher.isPending}
        />
      </TeacherModalShell>

      {/* Edit Teacher */}
      {editTeacherId ? (
        editTeacherLoading ? (
          <TeacherModalShell
            open
            title="Edit Teacher"
            onClose={() => setEditTeacherId(null)}
          >
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-white/70" />
              <p className="text-sm text-white/60">Loading teacher...</p>
            </div>
          </TeacherModalShell>
        ) : editTeacher ? (
          <EditTeacherModal
            open={!!editTeacherId}
            onOpenChange={(open) => {
              if (!open) setEditTeacherId(null);
            }}
            teacher={editTeacher}
            onSubmit={async (payload) => {
              await busy.promise(
                updateTeacher.mutateAsync({
                  teacherId: editTeacherId!,
                  payload,
                }),
                {
                  loading: "Updating teacher...",
                  success: "Teacher updated successfully",
                  error: "Failed to update teacher",
                }
              );
            }}
            isLoading={updateTeacher.isPending}
          />
        ) : (
          <TeacherModalShell
            open
            title="Edit Teacher"
            onClose={() => setEditTeacherId(null)}
          >
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <AlertCircle className="h-8 w-8 text-red-400/60" />
              <p className="text-sm text-red-300/80">Teacher not found</p>
            </div>
          </TeacherModalShell>
        )
      ) : null}

      {/* Filters */}
      <TeachersAdvancedFiltersDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        value={filters}
        onChange={(next) => {
          setFilters(next);
          setPage(1);
          clearSelection();
        }}
        onClear={() => {
          setFilters({ subjectId: "", classGroupId: "", department: "" });
          setPage(1);
          clearSelection();
        }}
      />

      {/* Command Palette */}
      <TeachersCommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onFocusSearch={() => {
          if (searchInputRef.current) {
            searchInputRef.current.focus();
            searchInputRef.current.select?.();
          }
        }}
        onGoToTab={handleTabChange}
        onCreateTeacher={() => setCreateOpen(true)}
        onImportTeachers={() => alert("CSV import coming next")}
      />
    </div>
  );
}
