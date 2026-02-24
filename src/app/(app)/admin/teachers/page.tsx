// src/app/(app)/admin/teachers/page.tsx
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Plus,
  Upload,
  Loader2,
  AlertCircle,
  Search,
  Users,
  X,
  Sparkles,
  ArrowRight,
  Command,
} from "lucide-react";

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
import { UpdateLeaveModal } from "@/components/modals/UpdateLeaveModal";
import { TeachersAdvancedFiltersDialog } from "@/components/admin/teachers/TeachersAdvancedFiltersDialog";
import {
  useCreateTeacher,
  useUpdateTeacher,
  useTeacher,
  useActivateTeacher,
  useDeactivateTeacher,
  useDeleteTeacher,
  useStartTeacherLeave,
  useUpdateTeacherLeave,
} from "@/hooks/admin/useTeachers";
import { useBusyToast } from "@/hooks/useBusyToast";
import { cn } from "@/lib/utils";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { notifyComingSoon } from "@/lib/ui/feature-notices";
import type { TeacherStatus } from "@/types/admin/teacher";
import { toast } from "sonner";

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

type StatusActionTarget = "inactive" | "on_leave" | "terminated";

type TeacherSearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  photoUrl: string | null;
  status: TeacherStatus;
};

const STATUS_ACTION_CONFIG: Record<
  StatusActionTarget,
  {
    ctaLabel: string;
    emptyStateDescription: string;
    modalTitle: string;
    modalDescription: string;
    searchPlaceholder: string;
    emptyMessage: string;
    actionLabel: string;
    actionClassName: string;
  }
> = {
  inactive: {
    ctaLabel: "Add an inactive teacher",
    emptyStateDescription:
      "Move an existing active or on-leave teacher into the inactive list.",
    modalTitle: "Add an Inactive Teacher",
    modalDescription:
      "Search active or on-leave teachers and set their status to inactive.",
    searchPlaceholder: "Search active or on-leave teachers...",
    emptyMessage: "No eligible teachers found for inactive status.",
    actionLabel: "Make Inactive",
    actionClassName:
      "border-slate-400/40 bg-slate-500/20 text-slate-100 hover:bg-slate-500/30",
  },
  on_leave: {
    ctaLabel: "Add a teacher on leave",
    emptyStateDescription:
      "Mark an existing active or inactive teacher as on leave.",
    modalTitle: "Add a Teacher On Leave",
    modalDescription:
      "Set a leave period, then search active or inactive teachers to mark on leave.",
    searchPlaceholder: "Search active or inactive teachers...",
    emptyMessage: "No eligible teachers found to place on leave.",
    actionLabel: "Start Leave",
    actionClassName:
      "border-amber-500/40 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30",
  },
  terminated: {
    ctaLabel: "Add a terminated teacher",
    emptyStateDescription:
      "Terminate an existing teacher to move them to this tab.",
    modalTitle: "Add a Terminated Teacher",
    modalDescription:
      "Search active, inactive, or on-leave teachers and terminate them.",
    searchPlaceholder: "Search teachers to terminate...",
    emptyMessage: "No eligible teachers found to terminate.",
    actionLabel: "Terminate",
    actionClassName:
      "border-rose-500/40 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30",
  },
};

const STATUS_LABELS: Record<TeacherStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  on_leave: "On Leave",
  terminated: "Terminated",
};

const STATUS_BADGE_STYLES: Record<TeacherStatus, string> = {
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  inactive: "border-slate-400/30 bg-slate-500/10 text-slate-300",
  on_leave: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  terminated: "border-rose-500/30 bg-rose-500/10 text-rose-300",
};

function isStatusActionTarget(tab: TeachersTabId): tab is StatusActionTarget {
  return tab === "inactive" || tab === "on_leave" || tab === "terminated";
}

function getTeacherInitials(fullName: string) {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function toDateInputValue(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateInputValue(dateValue: string) {
  const [y, m, d] = dateValue.split("-").map(Number);
  const parsed = new Date(y, (m || 1) - 1, d || 1);
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
  const [statusModalTarget, setStatusModalTarget] =
    React.useState<StatusActionTarget | null>(null);
  const [statusModalSearch, setStatusModalSearch] = React.useState("");
  const [statusActionTeacherId, setStatusActionTeacherId] = React.useState<
    string | null
  >(null);
  const [leaveStartDate, setLeaveStartDate] = React.useState<Date | null>(null);
  const [leaveEndDate, setLeaveEndDate] = React.useState<Date | null>(null);
  const [leaveReason, setLeaveReason] = React.useState("");
  const [updateLeaveTeacherId, setUpdateLeaveTeacherId] = React.useState<string | null>(null);

  const createTeacher = useCreateTeacher();
  const updateTeacher = useUpdateTeacher();
  const activateTeacher = useActivateTeacher();
  const deactivateTeacher = useDeactivateTeacher();
  const deleteTeacher = useDeleteTeacher();
  const startTeacherLeave = useStartTeacherLeave();
  const updateTeacherLeave = useUpdateTeacherLeave();
  const busy = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();

  const isChangingStatus =
    activateTeacher.isPending ||
    deactivateTeacher.isPending ||
    deleteTeacher.isPending;
  const isStatusModalActionPending =
    deactivateTeacher.isPending ||
    updateTeacher.isPending ||
    deleteTeacher.isPending ||
    startTeacherLeave.isPending ||
    updateTeacherLeave.isPending;

  React.useEffect(() => {
    const hasOverlayOpen =
      createOpen ||
      importOpen ||
      !!editTeacherId ||
      filtersOpen ||
      commandOpen ||
      !!statusModalTarget;

    if (!hasOverlayOpen) {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }
  }, [
    createOpen,
    importOpen,
    editTeacherId,
    filtersOpen,
    commandOpen,
    statusModalTarget,
  ]);

  const handleUpdateLeave = (teacherId: string) => {
    setUpdateLeaveTeacherId(teacherId);
  };

  const handleActivateTeacher = async (teacherId: string) => {
    const teacher = teachers.find((t) => t.id === teacherId);
    const isLeaveActivation = teacher?.status === "on_leave";

    if (isLeaveActivation) {
      const decision = await confirm({
        title: "End Leave and Activate Teacher?",
        description: `This will manually end leave for ${
          teacher?.fullName || "this teacher"
        } and set status to active.`,
        confirmLabel: "End Leave",
        cancelLabel: "Cancel",
        intent: "warning",
      });
      if (decision !== "confirm") return;
    }

    try {
      await busy.promise(activateTeacher.mutateAsync(teacherId), {
        loading: isLeaveActivation
          ? "Ending leave and activating teacher..."
          : "Activating teacher...",
        success: isLeaveActivation
          ? `${teacher?.fullName || "Teacher"} leave ended and activated`
          : `${teacher?.fullName || "Teacher"} activated successfully`,
        error: (e: Error) => e.message || "Failed to activate teacher",
      });
    } catch {
      // Error already handled by busy.promise
    }
  };

  const handleDeactivateTeacher = async (teacherId: string) => {
    const teacher = teachers.find((t) => t.id === teacherId);
    const decision = await confirm({
      title: "Deactivate Teacher?",
      description: `Are you sure you want to deactivate ${
        teacher?.fullName || "this teacher"
      }?`,
      confirmLabel: "Deactivate",
      cancelLabel: "Keep Active",
      intent: "warning",
    });
    if (decision !== "confirm") return;
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
    const decision = await confirm({
      title: "Terminate Teacher?",
      description: `Are you sure you want to terminate ${
        teacher?.fullName || "this teacher"
      }? This will set their status to "Terminated", deactivate active assignments, and remove homeroom assignments. This action cannot be undone.`,
      confirmLabel: "Terminate",
      cancelLabel: "Cancel",
      intent: "destructive",
    });
    if (decision !== "confirm") return;
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
  const debouncedStatusModalSearch = useDebouncedValue(statusModalSearch, 300);
  const statusModalConfig = statusModalTarget
    ? STATUS_ACTION_CONFIG[statusModalTarget]
    : null;

  const statusSearchStatuses = React.useMemo(() => {
    if (statusModalTarget === "inactive") return "active,on_leave";
    if (statusModalTarget === "on_leave") return "active,inactive";
    if (statusModalTarget === "terminated") return "active,inactive,on_leave";
    return "";
  }, [statusModalTarget]);

  const {
    data: statusSearchData,
    isLoading: isStatusSearchLoading,
    isError: isStatusSearchError,
  } = useQuery<{ success: true; data: TeacherSearchResult[] }>({
    queryKey: [
      "teachers",
      "status-modal-search",
      statusModalTarget,
      debouncedStatusModalSearch,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      const searchValue = debouncedStatusModalSearch.trim();
      if (searchValue) params.set("q", searchValue);
      params.set("limit", "20");
      if (statusSearchStatuses) params.set("statuses", statusSearchStatuses);

      const res = await fetch(`/api/admin/teachers/search?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const error = await res
          .json()
          .catch(() => ({ error: "Failed to search teachers" }));
        throw new Error(error.error || "Failed to search teachers");
      }
      return res.json();
    },
    enabled: !!statusModalTarget,
    staleTime: 20_000,
  });

  const statusSearchResults = statusSearchData?.data ?? [];

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

  const updateLeaveTeacher = updateLeaveTeacherId
    ? teachers.find((t) => t.id === updateLeaveTeacherId)
    : null;

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

  function openStatusModal(target: StatusActionTarget) {
    setStatusModalTarget(target);
    setStatusModalSearch("");
    setStatusActionTeacherId(null);
    if (target === "on_leave") {
      setLeaveStartDate(new Date());
      setLeaveEndDate(null);
    } else {
      setLeaveStartDate(null);
      setLeaveEndDate(null);
    }
    setLeaveReason("");
  }

  function closeStatusModal() {
    setStatusModalTarget(null);
    setStatusModalSearch("");
    setStatusActionTeacherId(null);
    setLeaveStartDate(null);
    setLeaveEndDate(null);
    setLeaveReason("");
  }

  async function handleStatusModalAction(teacher: TeacherSearchResult) {
    if (!statusModalTarget) return;

    setStatusActionTeacherId(teacher.id);

    try {
      if (statusModalTarget === "inactive") {
        const decision = await confirm({
          title: "Mark Teacher Inactive?",
          description: `Move ${teacher.fullName} from "${STATUS_LABELS[teacher.status]}" to "Inactive"?`,
          confirmLabel: "Make Inactive",
          cancelLabel: "Cancel",
          intent: "warning",
        });
        if (decision !== "confirm") return;

        await busy.promise(deactivateTeacher.mutateAsync(teacher.id), {
          loading: "Updating teacher status...",
          success: `${teacher.fullName} moved to inactive`,
          error: (e: Error) => e.message || "Failed to update teacher status",
        });
      } else if (statusModalTarget === "on_leave") {
        if (!leaveStartDate || !leaveEndDate) {
          toast.error("Select leave start and end dates.");
          return;
        }
        if (leaveEndDate < leaveStartDate) {
          toast.error("Leave end date must be on or after start date.");
          return;
        }

        const decision = await confirm({
          title: "Mark Teacher On Leave?",
          description: `Move ${teacher.fullName} from "${STATUS_LABELS[teacher.status]}" to "On Leave" from ${leaveStartDate!.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })} to ${leaveEndDate!.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })} (${leaveDurationDays} day${leaveDurationDays !== 1 ? "s" : ""})?`,
          confirmLabel: "Start Leave",
          cancelLabel: "Cancel",
          intent: "warning",
        });
        if (decision !== "confirm") return;

        await busy.promise(
          startTeacherLeave.mutateAsync({
            teacherId: teacher.id,
            startDate: toDateInputValue(leaveStartDate!),
            endDate: toDateInputValue(leaveEndDate!),
            reason: leaveReason.trim() || undefined,
          }),
          {
            loading: "Starting leave period...",
            success: `${teacher.fullName} is now on leave`,
            error: (e: Error) => e.message || "Failed to start leave period",
          }
        );
      } else {
        const decision = await confirm({
          title: "Terminate Teacher?",
          description: `Are you sure you want to terminate ${teacher.fullName}? This will set their status to "Terminated", deactivate active assignments, and remove homeroom assignments. This action cannot be undone.`,
          confirmLabel: "Terminate",
          cancelLabel: "Cancel",
          intent: "destructive",
        });
        if (decision !== "confirm") return;

        await busy.promise(deleteTeacher.mutateAsync(teacher.id), {
          loading: "Terminating teacher...",
          success: `${teacher.fullName} terminated successfully`,
          error: (e: Error) => e.message || "Failed to terminate teacher",
        });
      }

      closeStatusModal();
    } catch {
      // Error already handled by busy.promise
    } finally {
      setStatusActionTeacherId(null);
    }
  }

  const tabStatusActionConfig = isStatusActionTarget(tab)
    ? STATUS_ACTION_CONFIG[tab]
    : null;
  const isLeavePeriodValid =
    statusModalTarget !== "on_leave" ||
    (leaveStartDate != null && leaveEndDate != null && leaveEndDate >= leaveStartDate);

  const leaveDurationDays = React.useMemo(() => {
    if (!leaveStartDate || !leaveEndDate || leaveEndDate < leaveStartDate) return 0;
    const diff = leaveEndDate.getTime() - leaveStartDate.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  }, [leaveStartDate, leaveEndDate]);

  return (
    <div className="space-y-8">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 via-slate-950/95 to-black p-8 shadow-2xl shadow-black/40">
        {/* Background decorations */}
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-gradient-to-tr from-emerald-500/10 via-teal-500/5 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 shadow-lg shadow-indigo-500/10">
                <Users className="h-6 w-6 text-indigo-300" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-white">
                  Teachers
                </h1>
                <p className="text-sm text-white/60">
                  Staff management & directory
                </p>
              </div>
            </div>
            <p className="max-w-lg text-sm leading-relaxed text-white/50">
              Manage staff profiles, subjects, and homeroom assignments. Track
              performance, attendance, and professional development across your
              school.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="group gap-2 border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10 hover:text-white"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
              <span>Import CSV</span>
            </Button>
            <Button
              type="button"
              size="sm"
              className="group gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-600 hover:to-purple-700 hover:shadow-indigo-500/40"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
              <span>Add Teacher</span>
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

      {/* Quick stats */}
      <TeachersQuickStatsSection />

      {/* Teacher directory shell */}
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
        {/* Decorative elements */}
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/5 via-transparent to-transparent"
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
                  <Sparkles className="h-5 w-5 text-indigo-300" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-900 bg-emerald-400" />
              </div>
              <div className="space-y-0.5">
                <CardTitle className="text-lg font-semibold tracking-tight text-white">
                  Teacher Directory
                </CardTitle>
                <p className="text-xs text-white/50">
                  Search, filter, and manage staff profiles
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-300">
                {pagination?.total ?? 0} total
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative z-10 space-y-5 p-6">
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
            onExportAll={() => notifyComingSoon("Export all")}
            searchInputRef={searchInputRef}
          />
        </CardContent>
      </Card>

      {/* Data summary shell – cards/table + pagination */}
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
        {/* Decorative elements */}
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-purple-500/5 via-transparent to-transparent"
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
                  : `${pagination?.total ?? 0} teachers found`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors",
                  viewMode === "cards"
                    ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
                    : "border-white/10 bg-white/5 text-white/60"
                )}
              >
                {viewMode === "cards" ? "Cards" : "Table"} view
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium capitalize text-white/60">
                {tab === "all" ? "All teachers" : tab.replace("_", " ")}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative z-10 p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <div className="relative">
                <div className="h-12 w-12 animate-spin rounded-full border-2 border-indigo-500/20 border-t-indigo-500" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Users className="h-5 w-5 text-indigo-400/60" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white/80">
                  Loading teachers...
                </p>
                <p className="text-xs text-white/50">
                  Fetching your teacher directory
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
                  Failed to load teachers
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
          ) : teachers.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-white/10 to-white/5">
                  <Users className="h-10 w-10 text-white/30" />
                </div>
                <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-900 bg-indigo-500">
                  <Plus className="h-4 w-4 text-white" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-base font-medium text-white/80">
                  No teachers found
                </p>
                <p className="mt-1 max-w-xs text-sm text-white/50">
                  {search
                    ? "Try adjusting your search or filters to find what you're looking for"
                    : tabStatusActionConfig?.emptyStateDescription ||
                      "Get started by adding your first teacher to the directory"}
                </p>
              </div>
              {!search && (
                <Button
                  size="sm"
                  className="mt-2 gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-600 hover:to-purple-700"
                  onClick={() => {
                    if (tabStatusActionConfig && isStatusActionTarget(tab)) {
                      openStatusModal(tab);
                      return;
                    }
                    setCreateOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  {tabStatusActionConfig?.ctaLabel || "Add your first teacher"}
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Results summary bar */}
              <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-gradient-to-r from-white/5 to-transparent px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/20 text-[10px] font-bold text-indigo-300">
                    {teachers.length}
                  </span>
                  <span>
                    teacher{teachers.length === 1 ? "" : "s"} on page{" "}
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
                <TeachersCardGrid
                  teachers={teachers}
                  onView={(id) => {
                    router.push(`/admin/teachers/${id}`);
                  }}
                  onEdit={(id) => {
                    setEditTeacherId(id);
                  }}
                  onManageAccess={(id) => {
                    void id;
                    notifyComingSoon("Manage access");
                  }}
                  onSendMessage={(id) => {
                    void id;
                    notifyComingSoon("Send message");
                  }}
                  onActivate={handleActivateTeacher}
                  onUpdateLeave={handleUpdateLeave}
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
                    void id;
                    notifyComingSoon("Manage access");
                  }}
                  onSendMessage={(id) => {
                    void id;
                    notifyComingSoon("Send message");
                  }}
                  onActivate={handleActivateTeacher}
                  onDeactivate={handleDeactivateTeacher}
                  onDelete={handleDeleteTeacher}
                  onUpdateLeave={handleUpdateLeave}
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

      {/* Status Change Modal (Inactive / On Leave / Terminated tabs) */}
      {statusModalTarget && statusModalConfig ? (
        <TeacherModalShell
          open
          title={statusModalConfig.modalTitle}
          onClose={closeStatusModal}
        >
          <div className="space-y-5">
            <div className="space-y-3">
              <p className="text-sm text-white/70">
                {statusModalConfig.modalDescription}
              </p>
              {statusModalTarget === "on_leave" ? (
                <div className="space-y-4 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-amber-200/80">
                      Leave Period
                    </p>
                    {isLeavePeriodValid && leaveDurationDays > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-200">
                        {leaveDurationDays} day{leaveDurationDays !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-white/60">Start date</label>
                      <CustomDatePicker
                        value={leaveStartDate}
                        onChange={(date) => {
                          setLeaveStartDate(date);
                          if (date && leaveEndDate && leaveEndDate < date) {
                            setLeaveEndDate(null);
                          }
                        }}
                        minDate={new Date()}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-white/60">End date</label>
                      <CustomDatePicker
                        value={leaveEndDate}
                        onChange={(date) => setLeaveEndDate(date)}
                        minDate={leaveStartDate || new Date()}
                      />
                    </div>
                  </div>

                  {isLeavePeriodValid && leaveDurationDays > 0 && (
                    <div className="flex items-center gap-2 rounded-xl border border-amber-500/10 bg-amber-500/5 px-3 py-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20">
                        <span className="text-sm font-bold text-amber-200">{leaveDurationDays}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white/70">
                          {leaveStartDate!.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                          {" → "}
                          {leaveEndDate!.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/60">
                      Reason <span className="text-white/30">(optional)</span>
                    </label>
                    <Textarea
                      value={leaveReason}
                      onChange={(e) => setLeaveReason(e.target.value)}
                      placeholder="e.g., Medical leave, Personal leave, Professional development..."
                      className="min-h-[78px] rounded-xl border-white/15 bg-white/5 text-white placeholder:text-white/40"
                      maxLength={500}
                    />
                    {leaveReason.length > 0 && (
                      <p className="text-right text-[10px] text-white/30">{leaveReason.length}/500</p>
                    )}
                  </div>

                  {!isLeavePeriodValid && leaveStartDate && leaveEndDate ? (
                    <p className="text-xs text-red-300/80">
                      End date must be on or after the start date.
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <Input
                  value={statusModalSearch}
                  onChange={(e) => setStatusModalSearch(e.target.value)}
                  placeholder={statusModalConfig.searchPlaceholder}
                  className="h-11 border-white/15 bg-white/5 pl-9 text-white placeholder:text-white/40 focus-visible:ring-indigo-400"
                />
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              {isStatusSearchLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-white/60">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching teachers...
                </div>
              ) : isStatusSearchError ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                  <AlertCircle className="h-5 w-5 text-red-400/70" />
                  <p className="text-sm text-red-300/80">
                    Failed to search teachers. Try again.
                  </p>
                </div>
              ) : statusSearchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                  <Users className="h-6 w-6 text-white/30" />
                  <p className="text-sm text-white/60">
                    {statusModalConfig.emptyMessage}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {statusSearchResults.map((teacher) => {
                    const isUpdatingCurrentTeacher =
                      statusActionTeacherId === teacher.id &&
                      isStatusModalActionPending;

                    return (
                      <div
                        key={teacher.id}
                        className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border border-white/10">
                              <AvatarImage src={teacher.photoUrl ?? undefined} />
                              <AvatarFallback className="bg-white/10 text-xs text-white/80">
                                {getTeacherInitials(teacher.fullName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-white">
                                {teacher.fullName}
                              </p>
                              <p className="truncate text-xs text-white/55">
                                {teacher.email || "No email"}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 md:justify-end">
                          <span
                            className={cn(
                              "rounded-full border px-2 py-1 text-[10px] font-medium",
                              STATUS_BADGE_STYLES[teacher.status]
                            )}
                          >
                            {STATUS_LABELS[teacher.status]}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className={cn("gap-2", statusModalConfig.actionClassName)}
                            onClick={() => handleStatusModalAction(teacher)}
                            disabled={
                              isStatusModalActionPending ||
                              (statusModalTarget === "on_leave" &&
                                !isLeavePeriodValid)
                            }
                          >
                            {isUpdatingCurrentTeacher ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            {statusModalConfig.actionLabel}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </TeacherModalShell>
      ) : null}

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

      {/* Update Leave Modal */}
      {updateLeaveTeacher && (
        <UpdateLeaveModal
          open={!!updateLeaveTeacherId}
          onOpenChange={(open) => {
            if (!open) setUpdateLeaveTeacherId(null);
          }}
          teacherName={updateLeaveTeacher.fullName}
          initialStartDate={updateLeaveTeacher.leaveStartDate ?? null}
          initialEndDate={updateLeaveTeacher.leaveEndDate ?? null}
          initialReason={updateLeaveTeacher.leaveReason ?? null}
          onSubmit={async (payload) => {
            await busy.promise(
              updateTeacherLeave.mutateAsync({
                teacherId: updateLeaveTeacherId!,
                ...payload,
              }),
              {
                loading: "Updating leave dates...",
                success: "Leave dates updated successfully",
                error: (e: Error) => e.message || "Failed to update leave",
              }
            );
          }}
          isPending={updateTeacherLeave.isPending}
        />
      )}

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
        onImportTeachers={() => notifyComingSoon("CSV import shortcut")}
      />
      {confirmationDialog}
    </div>
  );
}
