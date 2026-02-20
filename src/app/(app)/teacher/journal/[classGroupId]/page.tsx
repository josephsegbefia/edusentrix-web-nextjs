"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Edit3,
  FileText,
  MoreHorizontal,
  NotebookPen,
  RefreshCw,
  Search,
  Sparkles,
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
    <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur transition hover:border-white/20">
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
              <Badge className="bg-indigo-500/20 text-indigo-200">
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

  const { data: classesData } = useTeacherClasses();

  const classAssignments = React.useMemo(() => {
    return (classesData?.data.classes || []).filter((item) => item._id === classGroupId);
  }, [classesData, classGroupId]);

  const className = classAssignments[0]?.name || "Class Journal";
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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Class Journal</h1>
          <p className="text-sm text-white/60">Journal access is currently locked.</p>
        </div>
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60">
                <NotebookPen className="h-4 w-4" />
              </span>
              Journal access required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
              Ask an admin to grant journal permissions for your account.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!classGroupId || classAssignments.length === 0) {
    return (
      <div className="space-y-6">
        <Button
          asChild
          variant="outline"
          className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
        >
          <Link href="/teacher/journal">
            <ArrowLeft className="h-4 w-4" />
            Back to Journals
          </Link>
        </Button>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/60">
          This class is not available in your assignments.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border border-white/10 bg-linear-to-br from-indigo-500/15 via-white/5 to-emerald-500/10 shadow-2xl shadow-black/35 backdrop-blur">
        <CardContent className="grid gap-5 p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="space-y-3">
            <Badge className="w-fit bg-white/10 text-white/80">
              <Sparkles className="h-3.5 w-3.5" />
              Class recordbook
            </Badge>
            <div>
              <h1 className="text-2xl font-semibold text-white">{className} Journal</h1>
              <p className="text-sm text-white/65">
                Capture lesson delivery, tasks, and follow-up actions in a chronological class log.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-white/10 text-white/80">{stats.total} entries</Badge>
              <Badge className="bg-amber-500/20 text-amber-100">{stats.drafts} drafts</Badge>
              <Badge className="bg-emerald-500/20 text-emerald-100">{stats.published} published</Badge>
              <Badge className="bg-indigo-500/20 text-indigo-100">
                Last update {formatDateTime(stats.latest)}
              </Badge>
            </div>
          </div>

          <div className="flex flex-col gap-2 lg:items-end">
            <Button
              asChild
              variant="outline"
              className="border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
            >
              <Link href="/teacher/journal">
                <ArrowLeft className="h-4 w-4" />
                Back to Journals
              </Link>
            </Button>
            <Button
              onClick={handleRefresh}
              variant="outline"
              className="border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
              disabled={journalQuery.isFetching}
            >
              <RefreshCw className={cn("h-4 w-4", journalQuery.isFetching && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-indigo-500/20 text-indigo-200">
              <NotebookPen className="h-4 w-4" />
            </span>
            New Journal Entry
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canWrite ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
              You can view entries, but journal editing is locked for your role.
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input
              value={entryTitle}
              onChange={(event) => setEntryTitle(event.target.value)}
              placeholder="Entry title (optional)"
              className="border-white/10 bg-white/5 text-white"
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
            className="min-h-[140px] border-white/10 bg-white/5 text-white"
            disabled={!canWrite}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => void handleCreateEntry()}
              className="bg-emerald-500/25 text-emerald-100 hover:bg-emerald-500/35"
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

      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
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
                className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-white/35"
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
              className="border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
            >
              Reset filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {journalQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Card key={idx} className="border border-white/10 bg-white/5 p-6">
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
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
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
                className="border-white/10 bg-white/5 text-white"
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
              className="min-h-[140px] border-white/10 bg-white/5 text-white"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeEditDialog}
              className="border-white/10 text-white/60"
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleUpdateEntry()}
              disabled={updateMutation.isPending || !editContent.trim()}
              className="bg-indigo-500/25 text-indigo-100 hover:bg-indigo-500/35"
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
    </div>
  );
}
