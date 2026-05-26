"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Edit3,
  FileText,
  MoreHorizontal,
  NotebookPen,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import {
  useTeacherJournalEntries,
  type TeacherJournalEntry,
} from "@/hooks/teacher/useTeacherJournalEntries";
import { useTeacherJournalCreate } from "@/hooks/teacher/useTeacherJournalCreate";
import { useTeacherJournalUpdate } from "@/hooks/teacher/useTeacherJournalUpdate";
import { useTeacherJournalDelete } from "@/hooks/teacher/useTeacherJournalDelete";
import { useBusyToast } from "@/hooks/useBusyToast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuItem,
  PremiumDropdownMenuTrigger,
} from "@/components/ui/premium-dropdown-menu";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { Badge } from "@/components/ui/badge";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
import { TeacherLessonWeekPlansPanel } from "@/components/lessons/TeacherLessonWeekPlansPanel";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { GlassPanel } from "@/components/ui/glass-panel";
import {
  glassInsetClass,
  glassPanelClass,
  glassPrimaryButtonClass,
  glassSecondaryButtonClass,
} from "@/lib/ui/glass-surfaces";

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toParamDate(value: Date | null) {
  if (!value) return undefined;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function JournalEntryCard({
  entry,
  canWrite,
  onEdit,
  onDelete,
}: {
  entry: TeacherJournalEntry;
  canWrite: boolean;
  onEdit: (entry: TeacherJournalEntry) => void;
  onDelete: (entry: TeacherJournalEntry) => void;
}) {
  return (
    <Card
      className={cn(
        glassPanelClass,
        "transition hover:border-white/20 hover:-translate-y-0.5"
      )}
    >
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg text-white">{entry.title || "Journal entry"}</CardTitle>
            <Badge
              className={cn(
                entry.status === "published"
                  ? "bg-emerald-500/20 text-emerald-200"
                  : "bg-amber-500/20 text-amber-200"
              )}
            >
              {entry.status === "published" ? "Published" : "Draft"}
            </Badge>
            {entry.attachments.length > 0 ? (
              <Badge className="border border-teal-400/20 bg-teal-500/15 text-teal-200">
                {entry.attachments.length} attachment{entry.attachments.length > 1 ? "s" : ""}
              </Badge>
            ) : null}
          </div>
          <div className="text-xs text-white/50">
            {formatDate(entry.date)} · {entry.subjectName || "General"} · Updated{" "}
            {formatDateTime(entry.updatedAt || entry.createdAt)}
          </div>
        </div>

        {canWrite ? (
          <PremiumDropdownMenu>
            <PremiumDropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </PremiumDropdownMenuTrigger>
            <PremiumDropdownMenuContent align="end">
              <PremiumDropdownMenuItem onClick={() => onEdit(entry)} icon={<Edit3 className="h-4 w-4" />}>
                Edit entry
              </PremiumDropdownMenuItem>
              <PremiumDropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(entry)}
                icon={<Trash2 className="h-4 w-4" />}
              >
                Delete entry
              </PremiumDropdownMenuItem>
            </PremiumDropdownMenuContent>
          </PremiumDropdownMenu>
        ) : null}
      </CardHeader>

      <CardContent>
        <p className="whitespace-pre-line text-sm text-white/70">{entry.content}</p>
      </CardContent>
    </Card>
  );
}

export default function TeacherClassJournalPage() {
  const params = useParams<{ classGroupId: string }>();
  const classGroupId = params?.classGroupId;

  const busyToast = useBusyToast();
  const createMutation = useTeacherJournalCreate();
  const updateMutation = useTeacherJournalUpdate();
  const deleteMutation = useTeacherJournalDelete();

  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canView = can(permissions, PERMISSIONS.journalView);
  const canWrite = can(permissions, PERMISSIONS.journalWrite);
  const canViewLessons = can(permissions, PERMISSIONS.lessonsRead);

  const { data: classesData } = useTeacherClasses();

  const classAssignments = React.useMemo(() => {
    return (classesData?.data.classes || []).filter((item) => item._id === classGroupId);
  }, [classesData, classGroupId]);

  const className = classAssignments[0]?.name || "Class Journal";
  const classLabelMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const item of classAssignments) {
      if (!item._id) continue;
      map.set(
        item._id,
        `${item.gradeName ? `${item.gradeName} ` : ""}${item.name}`.trim() || item.name,
      );
    }
    return map;
  }, [classAssignments]);
  const subjectOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    classAssignments.forEach((item) => {
      if (item.subjectId) map.set(item.subjectId, item.subjectName);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [classAssignments]);

  const [subjectFilter, setSubjectFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [startDate, setStartDate] = React.useState<Date | null>(null);
  const [endDate, setEndDate] = React.useState<Date | null>(null);
  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(search.trim());

  const [entryTitle, setEntryTitle] = React.useState("");
  const [entryContent, setEntryContent] = React.useState("");
  const [entryDate, setEntryDate] = React.useState<Date | null>(new Date());
  const [entryStatus, setEntryStatus] = React.useState<"draft" | "published">("draft");
  const [entrySubjectId, setEntrySubjectId] = React.useState("all");

  React.useEffect(() => {
    if (subjectFilter !== "all") {
      setEntrySubjectId(subjectFilter);
    }
  }, [subjectFilter]);

  const journalQuery = useTeacherJournalEntries({
    classGroupId,
    subjectId: subjectFilter !== "all" ? subjectFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    startDate: toParamDate(startDate),
    endDate: toParamDate(endDate),
    search: deferredSearch || undefined,
    enabled: canView && !!classGroupId,
  });

  const entries = React.useMemo(() => journalQuery.data?.data.entries ?? [], [journalQuery.data]);

  const stats = React.useMemo(() => {
    return {
      total: entries.length,
      drafts: entries.filter((entry) => entry.status === "draft").length,
      published: entries.filter((entry) => entry.status === "published").length,
      latest: entries[0]?.updatedAt || entries[0]?.createdAt || null,
    };
  }, [entries]);

  const handleRefresh = React.useCallback(async () => {
    await busyToast.promise(journalQuery.refetch(), {
      loading: "Refreshing journal...",
      success: "Journal updated",
      error: "Failed to refresh journal",
    });
  }, [busyToast, journalQuery]);

  const handleCreateEntry = async () => {
    if (!classGroupId || !entryDate) return;
    if (!entryContent.trim()) {
      busyToast.error("Entry content is required");
      return;
    }

    const result = await busyToast.promise(
      createMutation.mutateAsync({
        classGroupId,
        subjectId: entrySubjectId !== "all" ? entrySubjectId : null,
        date: entryDate.toISOString(),
        title: entryTitle.trim() || null,
        content: entryContent.trim(),
        status: entryStatus,
      }),
      {
        loading: "Saving journal entry...",
        success: entryStatus === "published" ? "Entry published" : "Draft saved",
        error: "Failed to save entry",
      }
    );

    if ((result as { queued?: boolean })?.queued) {
      busyToast.info("Saved offline", {
        description: "Journal entry will sync when you're back online.",
      });
    }

    setEntryTitle("");
    setEntryContent("");
    setEntryStatus("draft");
    setEntryDate(new Date());
  };

  const [editingEntry, setEditingEntry] = React.useState<TeacherJournalEntry | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const [editContent, setEditContent] = React.useState("");
  const [editDate, setEditDate] = React.useState<Date | null>(new Date());
  const [editStatus, setEditStatus] = React.useState<"draft" | "published">("draft");
  const [editSubjectId, setEditSubjectId] = React.useState("all");

  const openEditDialog = (entry: TeacherJournalEntry) => {
    setEditingEntry(entry);
    setEditTitle(entry.title || "");
    setEditContent(entry.content);
    setEditStatus(entry.status);
    setEditSubjectId(entry.subjectId || "all");

    const parsedDate = entry.date ? new Date(entry.date) : new Date();
    setEditDate(Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate);
  };

  const closeEditDialog = () => {
    setEditingEntry(null);
  };

  const handleUpdateEntry = async () => {
    if (!editingEntry || !editDate) return;
    if (!editContent.trim()) {
      busyToast.error("Entry content is required");
      return;
    }

    const result = await busyToast.promise(
      updateMutation.mutateAsync({
        id: editingEntry.id,
        subjectId: editSubjectId !== "all" ? editSubjectId : null,
        date: editDate.toISOString(),
        title: editTitle.trim() || null,
        content: editContent.trim(),
        status: editStatus,
      }),
      {
        loading: "Updating entry...",
        success: "Entry updated",
        error: "Failed to update entry",
      }
    );

    if ((result as { queued?: boolean })?.queued) {
      busyToast.info("Saved offline", {
        description: "Entry update will sync when you're back online.",
      });
    }

    closeEditDialog();
  };

  const [entryToDelete, setEntryToDelete] = React.useState<TeacherJournalEntry | null>(null);

  const handleDeleteEntry = async () => {
    if (!entryToDelete) return;

    await busyToast.promise(deleteMutation.mutateAsync(entryToDelete.id), {
      loading: "Deleting entry...",
      success: "Entry deleted",
      error: "Failed to delete entry",
    });

    setEntryToDelete(null);
  };

  if (!canView) {
    return (
      <WorkspacePageShell>
        <WorkspacePageHeader
          icon={NotebookPen}
          title="Class journal"
          subtitle="Capture lesson delivery and follow-up actions."
          backHref="/teacher/journal"
          backLabel="Back to journals"
        />
        <GlassPanel className="p-8 text-center">
          <p className="text-sm text-white/70">Journal access is currently locked.</p>
          <p className="mt-2 text-xs text-white/50">
            Ask an admin to grant journal permissions for your account.
          </p>
        </GlassPanel>
      </WorkspacePageShell>
    );
  }

  if (!classGroupId || classAssignments.length === 0) {
    return (
      <WorkspacePageShell>
        <WorkspacePageHeader
          icon={NotebookPen}
          title="Class journal"
          subtitle="This class is not available in your assignments."
          backHref="/teacher/journal"
          backLabel="Back to journals"
        />
        <GlassPanel className="p-6 text-center">
          <p className="text-sm text-white/60">
            This class is not available in your assignments.
          </p>
        </GlassPanel>
      </WorkspacePageShell>
    );
  }

  const refreshAction = (
    <Button
      onClick={handleRefresh}
      variant="outline"
      className={glassSecondaryButtonClass}
      disabled={journalQuery.isFetching}
    >
      <RefreshCw className={cn("h-4 w-4", journalQuery.isFetching && "animate-spin")} />
      Refresh
    </Button>
  );

  return (
    <WorkspacePageShell>
      <WorkspacePageHeader
        icon={NotebookPen}
        title={`${className} journal`}
        subtitle="Capture lesson delivery, tasks, and follow-up actions in a chronological class log."
        backHref="/teacher/journal"
        backLabel="Back to journals"
        badge={
          !journalQuery.isLoading ? (
            <span className="rounded-full border border-teal-400/30 bg-teal-500/15 px-3 py-1 text-xs font-medium text-teal-200">
              {stats.total} entr{stats.total === 1 ? "y" : "ies"}
            </span>
          ) : undefined
        }
        actions={refreshAction}
      />

      <div className="flex flex-wrap gap-2">
        <Badge className="border border-amber-400/20 bg-amber-500/15 text-amber-200">
          {stats.drafts} drafts
        </Badge>
        <Badge className="border border-emerald-400/20 bg-emerald-500/15 text-emerald-200">
          {stats.published} published
        </Badge>
        <Badge className="border border-white/10 bg-white/5 text-white/70">
          Last update {formatDateTime(stats.latest)}
        </Badge>
      </div>

      {canViewLessons && classGroupId ? (
        <TeacherLessonWeekPlansPanel
          classGroupId={classGroupId}
          classLabelMap={classLabelMap}
        />
      ) : null}

      <Card className={glassPanelClass}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-teal-400/30 bg-teal-500/20 text-teal-100">
              <NotebookPen className="h-4 w-4" />
            </span>
            New journal entry
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canWrite ? (
            <div className={cn(glassInsetClass, "rounded-2xl p-4 text-sm text-white/60")}>
              You can view entries, but journal editing is locked for your role.
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input
              value={entryTitle}
              onChange={(event) => setEntryTitle(event.target.value)}
              placeholder="Entry title (optional)"
              className={cn(glassInsetClass, "text-white")}
              disabled={!canWrite}
            />
            <PremiumSelect
              value={entrySubjectId}
              onValueChange={setEntrySubjectId}
              disabled={!canWrite}
            >
              <PremiumSelectTrigger>
                <PremiumSelectValue placeholder="Select subject" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="all">General</PremiumSelectItem>
                {subjectOptions.map((subject) => (
                  <PremiumSelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>

            <CustomDatePicker
              value={entryDate}
              onChange={setEntryDate}
              placeholder="Entry date"
              label="Date"
              className="md:col-span-1"
              disabled={!canWrite}
            />
            <PremiumSelect
              value={entryStatus}
              onValueChange={(value) => setEntryStatus(value as "draft" | "published")}
              disabled={!canWrite}
            >
              <PremiumSelectTrigger>
                <PremiumSelectValue placeholder="Status" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="draft">Draft</PremiumSelectItem>
                <PremiumSelectItem value="published">Published</PremiumSelectItem>
              </PremiumSelectContent>
            </PremiumSelect>
          </div>

          <Textarea
            value={entryContent}
            onChange={(event) => setEntryContent(event.target.value)}
            placeholder="Write what happened in class, assigned tasks, and next steps."
            className={cn(glassInsetClass, "min-h-[140px] text-white")}
            disabled={!canWrite}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => void handleCreateEntry()}
              className={glassPrimaryButtonClass}
              disabled={!canWrite || createMutation.isPending || !entryContent.trim()}
            >
              Save Entry
            </Button>
            <span className="text-xs text-white/50">
              Draft entries stay editable. Published entries remain in your timeline.
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className={glassPanelClass}>
        <CardHeader>
          <CardTitle className="text-lg">Filter entries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
            <PremiumSelect value={subjectFilter} onValueChange={setSubjectFilter}>
              <PremiumSelectTrigger>
                <PremiumSelectValue placeholder="All subjects" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="all">All subjects</PremiumSelectItem>
                {subjectOptions.map((subject) => (
                  <PremiumSelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>

            <PremiumSelect value={statusFilter} onValueChange={setStatusFilter}>
              <PremiumSelectTrigger>
                <PremiumSelectValue placeholder="All statuses" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="all">All statuses</PremiumSelectItem>
                <PremiumSelectItem value="draft">Draft</PremiumSelectItem>
                <PremiumSelectItem value="published">Published</PremiumSelectItem>
              </PremiumSelectContent>
            </PremiumSelect>

            <CustomDatePicker
              value={startDate}
              onChange={setStartDate}
              placeholder="Start date"
              label="Start"
            />
            <CustomDatePicker
              value={endDate}
              onChange={setEndDate}
              placeholder="End date"
              label="End"
            />

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search entries"
                className={cn(glassInsetClass, "pl-9 text-white placeholder:text-white/35")}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setSubjectFilter("all");
                setStatusFilter("all");
                setStartDate(null);
                setEndDate(null);
                setSearch("");
              }}
              className={glassSecondaryButtonClass}
            >
              Reset filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {journalQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Card key={idx} className={cn(glassPanelClass, "p-6")}>
              <div className="space-y-3">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-16 w-full" />
              </div>
            </Card>
          ))}
        </div>
      ) : journalQuery.error ? (
        <Card className="border border-red-500/30 bg-linear-to-br from-red-950/40 to-transparent p-8 text-center">
          <FileText className="mx-auto mb-3 h-10 w-10 text-red-300/70" />
          <p className="text-sm text-red-100/80">Failed to load journal entries. Please refresh.</p>
        </Card>
      ) : entries.length === 0 ? (
        <div className={cn(glassInsetClass, "rounded-2xl p-8 text-center text-white/60")}>
          No journal entries yet. Start with your first class record above.
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <JournalEntryCard
              key={entry.id}
              entry={entry}
              canWrite={canWrite}
              onEdit={openEditDialog}
              onDelete={(selectedEntry) => setEntryToDelete(selectedEntry)}
            />
          ))}
        </div>
      )}

      <Dialog
        open={!!editingEntry}
        onOpenChange={(open) => {
          if (!open) closeEditDialog();
        }}
      >
        <DialogContent className="border-white/10 bg-[#0f0f14] text-white">
          <DialogHeader>
            <DialogTitle className="text-lg">Edit journal entry</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                placeholder="Entry title (optional)"
                className={cn(glassInsetClass, "text-white")}
              />
              <PremiumSelect value={editSubjectId} onValueChange={setEditSubjectId}>
                <PremiumSelectTrigger>
                  <PremiumSelectValue placeholder="Select subject" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  <PremiumSelectItem value="all">General</PremiumSelectItem>
                  {subjectOptions.map((subject) => (
                    <PremiumSelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>

              <CustomDatePicker
                value={editDate}
                onChange={setEditDate}
                placeholder="Entry date"
                label="Date"
                className="md:col-span-1"
              />
              <PremiumSelect
                value={editStatus}
                onValueChange={(value) => setEditStatus(value as "draft" | "published")}
              >
                <PremiumSelectTrigger>
                  <PremiumSelectValue placeholder="Status" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  <PremiumSelectItem value="draft">Draft</PremiumSelectItem>
                  <PremiumSelectItem value="published">Published</PremiumSelectItem>
                </PremiumSelectContent>
              </PremiumSelect>
            </div>

            <Textarea
              value={editContent}
              onChange={(event) => setEditContent(event.target.value)}
              placeholder="Update your journal note..."
              className={cn(glassInsetClass, "min-h-[140px] text-white")}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeEditDialog}
              className={glassSecondaryButtonClass}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleUpdateEntry()}
              disabled={updateMutation.isPending || !editContent.trim()}
              className={glassPrimaryButtonClass}
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={!!entryToDelete}
        onOpenChange={(open) => {
          if (!open) setEntryToDelete(null);
        }}
        title="Delete journal entry?"
        description="This action cannot be undone."
        confirmLabel={deleteMutation.isPending ? "Deleting..." : "Delete"}
        cancelLabel="Cancel"
        intent="destructive"
        onCancel={() => setEntryToDelete(null)}
        onConfirm={() => void handleDeleteEntry()}
      />
    </WorkspacePageShell>
  );
}
