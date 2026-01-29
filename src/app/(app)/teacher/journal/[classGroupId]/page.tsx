"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, NotebookPen, RefreshCw } from "lucide-react";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useTeacherJournalEntries } from "@/hooks/teacher/useTeacherJournalEntries";
import { useTeacherJournalCreate } from "@/hooks/teacher/useTeacherJournalCreate";
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
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

function toParamDate(value: Date | null) {
  if (!value) return undefined;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function TeacherClassJournalPage() {
  const params = useParams<{ classGroupId: string }>();
  const classGroupId = params?.classGroupId;

  const busyToast = useBusyToast();
  const createMutation = useTeacherJournalCreate();
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
    enabled: canView && !!classGroupId,
  });

  const entries = journalQuery.data?.data.entries || [];

  const handleRefresh = React.useCallback(async () => {
    await busyToast.promise(journalQuery.refetch(), {
      loading: "Refreshing journal...",
      success: "Journal updated",
      error: "Failed to refresh journal",
    });
  }, [busyToast, journalQuery]);

  const handleCreateEntry = async () => {
    if (!classGroupId) return;
    if (!entryContent.trim()) return;
    if (!entryDate) return;

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button
            asChild
            variant="outline"
            className="mb-3 border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
          >
            <Link href="/teacher/journal">
              <ArrowLeft className="h-4 w-4" />
              Back to Journals
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold text-white">{className}</h1>
          <p className="text-sm text-white/60">
            Log lesson notes, homework, and reflections for this class.
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          variant="outline"
          className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
          disabled={journalQuery.isFetching}
        >
          <RefreshCw className={cn("h-4 w-4", journalQuery.isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

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
          {!canWrite && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
              You can view entries, but journal editing is locked for your role.
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input
              value={entryTitle}
              onChange={(event) => setEntryTitle(event.target.value)}
              placeholder="Lesson title (optional)"
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
            <PremiumSelect value={entryStatus} onValueChange={(v) => setEntryStatus(v as "draft" | "published")} disabled={!canWrite}>
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
            placeholder="Write lesson notes, homework reminders, or remarks"
            className="min-h-[140px] border-white/10 bg-white/5 text-white"
            disabled={!canWrite}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleCreateEntry}
              className="bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
              disabled={!canWrite || createMutation.isPending || !entryContent.trim()}
            >
              Save Entry
            </Button>
            <span className="text-xs text-white/50">
              Drafts can be updated later. Published entries are visible to your team.
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 lg:grid-cols-4">
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
      </div>

      {journalQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
          No journal entries yet. Start by adding a lesson note above.
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <Card
              key={entry.id}
              className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur"
            >
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-lg text-white">
                    {entry.title || "Lesson Journal"}
                  </CardTitle>
                  <div className="text-xs text-white/50">
                    {formatDate(entry.date)} · {entry.subjectName || "General"}
                  </div>
                </div>
                <Badge
                  className={cn(
                    entry.status === "published"
                      ? "bg-emerald-500/20 text-emerald-200"
                      : "bg-amber-500/20 text-amber-200"
                  )}
                >
                  {entry.status}
                </Badge>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-white/70 whitespace-pre-line">{entry.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
