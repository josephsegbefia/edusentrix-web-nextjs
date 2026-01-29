"use client";

import * as React from "react";
import { BookOpen, Copy, Plus, Tag, Trash2, Pencil, CalendarDays } from "lucide-react";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useTeacherLessonNotes } from "@/hooks/teacher/useTeacherLessonNotes";
import { useTeacherLessonNoteCreate } from "@/hooks/teacher/useTeacherLessonNoteCreate";
import { useTeacherLessonNoteUpdate } from "@/hooks/teacher/useTeacherLessonNoteUpdate";
import { useTeacherLessonNoteDelete } from "@/hooks/teacher/useTeacherLessonNoteDelete";
import { useBusyToast } from "@/hooks/useBusyToast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { Textarea } from "@/components/ui/textarea";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuItem,
  PremiumDropdownMenuTrigger,
} from "@/components/ui/premium-dropdown-menu";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { cn } from "@/lib/utils";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
];

const RESOURCE_TYPES = [
  { value: "link", label: "Link" },
  { value: "pdf", label: "PDF" },
  { value: "video", label: "Video" },
  { value: "image", label: "Image" },
  { value: "doc", label: "Doc" },
  { value: "slides", label: "Slides" },
  { value: "other", label: "Other" },
];

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-amber-500/20 text-amber-200",
  published: "bg-emerald-500/20 text-emerald-200",
};

function getStartOfWeek(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatWeekLabel(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `Week of ${date.toLocaleDateString()}`;
}

function parseTags(input: string) {
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8);
}

type ResourceInput = {
  title: string;
  url: string;
  type: string;
};

export default function TeacherLessonNotesPage() {
  const busyToast = useBusyToast();
  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canView = can(permissions, PERMISSIONS.journalView);
  const canWrite = can(permissions, PERMISSIONS.journalWrite);

  const { data: classesData } = useTeacherClasses();

  const classOptions = React.useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        label: string;
        isHomeroom: boolean;
        subjects: Array<{ id: string; name: string }>;
      }
    >();

    (classesData?.data.classes || []).forEach((item) => {
      if (!item._id) return;
      if (!map.has(item._id)) {
        const label = `${item.gradeName ? item.gradeName + " " : ""}${item.name}`.trim();
        map.set(item._id, {
          id: item._id,
          label: label || item.name,
          isHomeroom: item.isHomeroom,
          subjects: [],
        });
      }
      const entry = map.get(item._id);
      if (!entry) return;
      if (item.subjectId && !entry.subjects.some((subject) => subject.id === item.subjectId)) {
        entry.subjects.push({ id: item.subjectId, name: item.subjectName });
      }
      entry.isHomeroom = entry.isHomeroom || item.isHomeroom;
    });

    return Array.from(map.values())
      .map((entry) => ({
        ...entry,
        subjects: entry.subjects.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [classesData]);

  const [selectedClassId, setSelectedClassId] = React.useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!selectedClassId && classOptions.length > 0) {
      setSelectedClassId(classOptions[0].id);
    }
  }, [classOptions, selectedClassId]);

  React.useEffect(() => {
    if (!selectedClassId) return;
    const selected = classOptions.find((option) => option.id === selectedClassId);
    if (!selected) return;
    if (selectedSubjectId && selected.subjects.some((subject) => subject.id === selectedSubjectId)) {
      return;
    }
    setSelectedSubjectId(selected.subjects[0]?.id ?? null);
  }, [selectedClassId, classOptions, selectedSubjectId]);

  const [statusFilter, setStatusFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [weekFilter, setWeekFilter] = React.useState<Date | null>(null);

  const { data: notesData, isLoading } = useTeacherLessonNotes(
    {
      classGroupId: selectedClassId || undefined,
      subjectId: selectedSubjectId || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      weekOf: weekFilter ? toDateInputValue(weekFilter) : undefined,
      search: search || undefined,
    },
    canView
  );

  const notes = notesData?.data.entries || [];
  const noClassesAssigned = classOptions.length === 0;

  const createMutation = useTeacherLessonNoteCreate();
  const updateMutation = useTeacherLessonNoteUpdate();
  const deleteMutation = useTeacherLessonNoteDelete();

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [weekOf, setWeekOf] = React.useState<Date | null>(() => getStartOfWeek(new Date()));
  const [topic, setTopic] = React.useState("");
  const [objectives, setObjectives] = React.useState("");
  const [content, setContent] = React.useState("");
  const [status, setStatus] = React.useState<"draft" | "published">("draft");
  const [tags, setTags] = React.useState("");
  const [resources, setResources] = React.useState<ResourceInput[]>([
    { title: "", url: "", type: "link" },
  ]);

  const resetForm = React.useCallback(() => {
    setEditingId(null);
    setWeekOf(getStartOfWeek(new Date()));
    setTopic("");
    setObjectives("");
    setContent("");
    setStatus("draft");
    setTags("");
    setResources([{ title: "", url: "", type: "link" }]);
  }, []);

  const handleEdit = (note: typeof notes[number]) => {
    setEditingId(note.id);
    setSelectedClassId(note.classGroupId);
    setSelectedSubjectId(note.subjectId || null);
    setWeekOf(note.weekOf ? new Date(note.weekOf) : getStartOfWeek(new Date()));
    setTopic(note.topic);
    setObjectives(note.objectives || "");
    setContent(note.content);
    setStatus(note.status);
    setTags(note.tags.join(", "));
    const mappedResources = note.resources.length
      ? note.resources.map((resource) => ({
          title: resource.title,
          url: resource.url,
          type: resource.type || "link",
        }))
      : [{ title: "", url: "", type: "link" }];
    setResources(mappedResources);
  };

  const handleDuplicate = async (note: typeof notes[number]) => {
    const baseWeek = note.weekOf ? new Date(note.weekOf) : new Date();
    const nextWeek = new Date(baseWeek);
    nextWeek.setDate(baseWeek.getDate() + 7);

    const payload = {
      classGroupId: note.classGroupId,
      subjectId: note.subjectId,
      weekOf: toDateInputValue(nextWeek),
      topic: note.topic,
      objectives: note.objectives || undefined,
      content: note.content,
      status: "draft" as const,
      resources: note.resources,
      tags: note.tags,
    };

    const result = await busyToast.promise(createMutation.mutateAsync(payload), {
      loading: "Duplicating note...",
      success: "Note copied to next week",
      error: "Failed to duplicate note",
    });

    if ((result as { queued?: boolean })?.queued) {
      busyToast.info("Saved offline", {
        description: "The duplicated note will sync when you're back online.",
      });
    }
  };

  const handleSubmit = async () => {
    if (!selectedClassId) {
      busyToast.warning("Select a class first.");
      return;
    }
    if (!weekOf) {
      busyToast.warning("Select the week for this note.");
      return;
    }
    if (!topic.trim() || !content.trim()) {
      busyToast.warning("Topic and lesson summary are required.");
      return;
    }

    const cleanedResources = resources
      .map((resource) => ({
        title: resource.title.trim(),
        url: resource.url.trim(),
        type: resource.type,
      }))
      .filter((resource) => resource.title && resource.url);

    const payload = {
      classGroupId: selectedClassId,
      subjectId: selectedSubjectId || undefined,
      weekOf: toDateInputValue(weekOf),
      topic: topic.trim(),
      objectives: objectives.trim() || undefined,
      content: content.trim(),
      status,
      resources: cleanedResources,
      tags: parseTags(tags),
    };

    if (editingId) {
      const result = await busyToast.promise(updateMutation.mutateAsync({ id: editingId, ...payload }), {
        loading: "Updating note...",
        success: "Lesson note updated",
        error: "Failed to update lesson note",
      });

      if ((result as { queued?: boolean })?.queued) {
        busyToast.info("Saved offline", {
          description: "The update will sync when you're back online.",
        });
      }
      resetForm();
      return;
    }

    const result = await busyToast.promise(createMutation.mutateAsync(payload), {
      loading: "Saving lesson note...",
      success: "Lesson note saved",
      error: "Failed to save lesson note",
    });

    if ((result as { queued?: boolean })?.queued) {
      busyToast.info("Saved offline", {
        description: "The note will sync when you're back online.",
      });
    }
    resetForm();
  };

  const handleDelete = async (id: string) => {
    await busyToast.promise(deleteMutation.mutateAsync(id), {
      loading: "Deleting note...",
      success: "Lesson note deleted",
      error: "Failed to delete lesson note",
    });
  };

  if (!canView) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Lesson Notes</h1>
          <p className="text-sm text-white/60">Lesson notes are currently locked.</p>
        </div>
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60">
                <BookOpen className="h-4 w-4" />
              </span>
              Lesson notes access required
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Lesson Notes</h1>
          <p className="text-sm text-white/60">
            Capture weekly lesson notes, objectives, and supporting resources.
          </p>
        </div>
        <Badge className="w-fit bg-indigo-500/20 text-indigo-200">
          {notes.length} notes
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="h-4 w-4 text-indigo-200" />
              {editingId ? "Edit lesson note" : "New lesson note"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {noClassesAssigned && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/60">
                No classes assigned yet. Lesson notes will unlock once classes are assigned.
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-white/70">Class</Label>
              <PremiumSelect
                value={selectedClassId || undefined}
                onValueChange={(value) => setSelectedClassId(value)}
              >
                <PremiumSelectTrigger>
                  <PremiumSelectValue placeholder="Select class" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  {classOptions.map((option) => (
                    <PremiumSelectItem key={option.id} value={option.id}>
                      {option.label}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Subject</Label>
              <PremiumSelect
                value={selectedSubjectId || undefined}
                onValueChange={(value) => setSelectedSubjectId(value)}
              >
                <PremiumSelectTrigger>
                  <PremiumSelectValue placeholder="Select subject" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  {(classOptions.find((option) => option.id === selectedClassId)?.subjects || []).map(
                    (subject) => (
                      <PremiumSelectItem key={subject.id} value={subject.id}>
                        {subject.name}
                      </PremiumSelectItem>
                    )
                  )}
                </PremiumSelectContent>
              </PremiumSelect>
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Week of</Label>
              <CustomDatePicker value={weekOf} onChange={setWeekOf} />
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Topic</Label>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Topic or lesson title"
                className="border-white/10 bg-white/5 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Objectives</Label>
              <Textarea
                rows={3}
                value={objectives}
                onChange={(e) => setObjectives(e.target.value)}
                placeholder="Learning goals (optional)"
                className="border-white/10 bg-white/5 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Lesson summary</Label>
              <Textarea
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Summary of lesson content"
                className="border-white/10 bg-white/5 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Status</Label>
              <PremiumSelect value={status} onValueChange={(value) => setStatus(value as "draft" | "published")}>
                <PremiumSelectTrigger>
                  <PremiumSelectValue placeholder="Status" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  {STATUS_OPTIONS.filter((opt) => opt.value !== "all").map((opt) => (
                    <PremiumSelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Resources</Label>
              <div className="space-y-3">
                {resources.map((resource, index) => (
                  <div key={index} className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
                    <Input
                      value={resource.title}
                      onChange={(e) => {
                        const next = [...resources];
                        next[index] = { ...next[index], title: e.target.value };
                        setResources(next);
                      }}
                      placeholder="Resource title"
                      className="border-white/10 bg-white/5 text-white"
                    />
                    <Input
                      value={resource.url}
                      onChange={(e) => {
                        const next = [...resources];
                        next[index] = { ...next[index], url: e.target.value };
                        setResources(next);
                      }}
                      placeholder="https://"
                      className="border-white/10 bg-white/5 text-white"
                    />
                    <PremiumSelect
                      value={resource.type}
                      onValueChange={(value) => {
                        const next = [...resources];
                        next[index] = { ...next[index], type: value };
                        setResources(next);
                      }}
                    >
                      <PremiumSelectTrigger>
                        <PremiumSelectValue placeholder="Type" />
                      </PremiumSelectTrigger>
                      <PremiumSelectContent>
                        {RESOURCE_TYPES.map((type) => (
                          <PremiumSelectItem key={type.value} value={type.value}>
                            {type.label}
                          </PremiumSelectItem>
                        ))}
                      </PremiumSelectContent>
                    </PremiumSelect>
                    {resources.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setResources(resources.filter((_, i) => i !== index))}
                        className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setResources([...resources, { title: "", url: "", type: "link" }])}
                  className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                >
                  Add resource
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Tags</Label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g. algebra, week 3"
                className="border-white/10 bg-white/5 text-white"
              />
              <p className="text-xs text-white/40">Separate tags with commas.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={handleSubmit}
                className="bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30"
                disabled={!canWrite || noClassesAssigned}
              >
                {editingId ? "Update" : "Save"}
              </Button>
              {editingId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                >
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center">
            <div className="min-w-[180px]">
              <PremiumSelect value={statusFilter} onValueChange={setStatusFilter}>
                <PremiumSelectTrigger>
                  <PremiumSelectValue placeholder="Filter status" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <PremiumSelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
            </div>
            <div className="flex-1">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes"
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
            <div className="min-w-[200px]">
              <CustomDatePicker value={weekFilter} onChange={setWeekFilter} placeholder="Filter week" />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
              ))}
            </div>
          ) : notes.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
              No lesson notes yet. Capture your first weekly note to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {notes.map((note) => (
                <Card
                  key={note.id}
                  className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur"
                >
                  <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg text-white">{note.topic}</CardTitle>
                      <div className="text-xs text-white/50">
                        {note.className}
                        {note.subjectName ? ` · ${note.subjectName}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={cn("rounded-full px-3 py-1 text-xs font-semibold", STATUS_STYLES[note.status])}>
                        {note.status}
                      </Badge>
                      <PremiumDropdownMenu>
                        <PremiumDropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                          >
                            <span className="sr-only">Actions</span>
                            <BookOpen className="h-4 w-4" />
                          </Button>
                        </PremiumDropdownMenuTrigger>
                        <PremiumDropdownMenuContent align="end">
                          <PremiumDropdownMenuItem
                            icon={<Pencil className="h-4 w-4" />}
                            onClick={() => handleEdit(note)}
                          >
                            Edit
                          </PremiumDropdownMenuItem>
                          <PremiumDropdownMenuItem
                            icon={<Copy className="h-4 w-4" />}
                            onClick={() => handleDuplicate(note)}
                          >
                            Duplicate to next week
                          </PremiumDropdownMenuItem>
                          <PremiumDropdownMenuItem
                            icon={<Trash2 className="h-4 w-4" />}
                            variant="destructive"
                            onClick={() => handleDelete(note.id)}
                          >
                            Delete
                          </PremiumDropdownMenuItem>
                        </PremiumDropdownMenuContent>
                      </PremiumDropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-white/50">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatWeekLabel(note.weekOf)}
                      </span>
                      {note.resources.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Plus className="h-3.5 w-3.5" />
                          {note.resources.length} resources
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-white/70 line-clamp-3">{note.content}</p>
                    {note.objectives && (
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/60">
                        <strong className="text-white/70">Objectives:</strong> {note.objectives}
                      </div>
                    )}
                    {note.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {note.tags.map((tag) => (
                          <Badge key={tag} className="flex items-center gap-1 bg-white/5 text-white/70">
                            <Tag className="h-3 w-3" />
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
