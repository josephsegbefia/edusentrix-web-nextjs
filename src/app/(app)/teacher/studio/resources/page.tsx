"use client";

import * as React from "react";
import { ExternalLink, Link2, Plus, Tag, Trash2, Pencil, BookOpen } from "lucide-react";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useTeacherResources } from "@/hooks/teacher/useTeacherResources";
import { useTeacherResourceCreate } from "@/hooks/teacher/useTeacherResourceCreate";
import { useTeacherResourceUpdate } from "@/hooks/teacher/useTeacherResourceUpdate";
import { useTeacherResourceDelete } from "@/hooks/teacher/useTeacherResourceDelete";
import { useBusyToast } from "@/hooks/useBusyToast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

const RESOURCE_TYPES = [
  { value: "all", label: "All types" },
  { value: "link", label: "Link" },
  { value: "pdf", label: "PDF" },
  { value: "video", label: "Video" },
  { value: "image", label: "Image" },
  { value: "doc", label: "Doc" },
  { value: "slides", label: "Slides" },
  { value: "other", label: "Other" },
];

const TYPE_STYLES: Record<string, string> = {
  link: "bg-sky-500/20 text-sky-200",
  pdf: "bg-rose-500/20 text-rose-200",
  video: "bg-amber-500/20 text-amber-200",
  image: "bg-emerald-500/20 text-emerald-200",
  doc: "bg-indigo-500/20 text-indigo-200",
  slides: "bg-purple-500/20 text-purple-200",
  other: "bg-white/10 text-white/70",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

function parseTags(input: string) {
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export default function TeacherResourcesPage() {
  const busyToast = useBusyToast();
  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canView = can(permissions, PERMISSIONS.resourcesView);

  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [tagFilter, setTagFilter] = React.useState("");

  const { data, isLoading } = useTeacherResources(
    {
      search: search || undefined,
      type: typeFilter === "all" ? undefined : typeFilter,
      tag: tagFilter || undefined,
    },
    canView
  );

  const resources = data?.data.resources || [];

  const createMutation = useTeacherResourceCreate();
  const updateMutation = useTeacherResourceUpdate();
  const deleteMutation = useTeacherResourceDelete();

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    title: "",
    description: "",
    url: "",
    type: "link",
    tags: "",
  });

  const resetForm = React.useCallback(() => {
    setForm({ title: "", description: "", url: "", type: "link", tags: "" });
    setEditingId(null);
  }, []);

  const handleEdit = (resource: typeof resources[number]) => {
    setEditingId(resource.id);
    setForm({
      title: resource.title,
      description: resource.description || "",
      url: resource.url,
      type: resource.type,
      tags: resource.tags.join(", "),
    });
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.url.trim()) {
      busyToast.warning("Title and link are required.");
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      url: form.url.trim(),
      type: form.type as "link" | "pdf" | "video" | "image" | "doc" | "slides" | "other",
      tags: parseTags(form.tags),
    };

    if (editingId) {
      const result = await busyToast.promise(updateMutation.mutateAsync({ id: editingId, ...payload }), {
        loading: "Updating resource...",
        success: "Resource updated",
        error: "Failed to update resource",
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
      loading: "Saving resource...",
      success: "Resource saved",
      error: "Failed to save resource",
    });

    if ((result as { queued?: boolean })?.queued) {
      busyToast.info("Saved offline", {
        description: "The resource will sync when you're back online.",
      });
    }
    resetForm();
  };

  const handleDelete = async (id: string) => {
    await busyToast.promise(deleteMutation.mutateAsync(id), {
      loading: "Deleting resource...",
      success: "Resource removed",
      error: "Failed to delete resource",
    });
  };

  if (!canView) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Resources</h1>
          <p className="text-sm text-white/60">Resource access is currently locked.</p>
        </div>
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60">
                <BookOpen className="h-4 w-4" />
              </span>
              Resources access required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
              Ask an admin to grant resource permissions for your account.
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
          <h1 className="text-2xl font-semibold text-white">Resources</h1>
          <p className="text-sm text-white/60">Save and reuse lesson links, files, and references.</p>
        </div>
        <Badge className="w-fit bg-indigo-500/20 text-indigo-200">
          {resources.length} saved
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="h-4 w-4 text-indigo-200" />
              {editingId ? "Edit resource" : "New resource"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-white/70">Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Algebra recap video"
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">Link</Label>
              <Input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://"
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">Type</Label>
              <PremiumSelect
                value={form.type}
                onValueChange={(value) => setForm({ ...form, type: value })}
              >
                <PremiumSelectTrigger>
                  <PremiumSelectValue placeholder="Select type" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  {RESOURCE_TYPES.filter((type) => type.value !== "all").map((type) => (
                    <PremiumSelectItem key={type.value} value={type.value}>
                      {type.label}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional quick note"
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">Tags</Label>
              <Input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="e.g. algebra, revision"
                className="border-white/10 bg-white/5 text-white"
              />
              <p className="text-xs text-white/40">Separate tags with commas.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={handleSubmit}
                className="bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30"
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
            <div className="min-w-[160px]">
              <PremiumSelect value={typeFilter} onValueChange={setTypeFilter}>
                <PremiumSelectTrigger>
                  <PremiumSelectValue placeholder="Filter type" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  {RESOURCE_TYPES.map((type) => (
                    <PremiumSelectItem key={type.value} value={type.value}>
                      {type.label}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
            </div>
            <div className="flex-1">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search resources"
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
            <div className="min-w-[160px]">
              <Input
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                placeholder="Filter tag"
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
              ))}
            </div>
          ) : resources.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
              No resources yet. Add your first link to build a reusable library.
            </div>
          ) : (
            <div className="space-y-4">
              {resources.map((resource) => (
                <Card
                  key={resource.id}
                  className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur"
                >
                  <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg text-white">{resource.title}</CardTitle>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-white/50">
                        <span>{formatDate(resource.createdAt)}</span>
                        <Badge className={cn("rounded-full px-2.5 py-0.5", TYPE_STYLES[resource.type])}>
                          {resource.type.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                    <PremiumDropdownMenu>
                      <PremiumDropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                        >
                          <span className="sr-only">Actions</span>
                          <Link2 className="h-4 w-4" />
                        </Button>
                      </PremiumDropdownMenuTrigger>
                      <PremiumDropdownMenuContent align="end">
                        <PremiumDropdownMenuItem asChild icon={<ExternalLink className="h-4 w-4" />}>
                          <a href={resource.url} target="_blank" rel="noreferrer">
                            Open link
                          </a>
                        </PremiumDropdownMenuItem>
                        <PremiumDropdownMenuItem
                          icon={<Pencil className="h-4 w-4" />}
                          onClick={() => handleEdit(resource)}
                        >
                          Edit
                        </PremiumDropdownMenuItem>
                        <PremiumDropdownMenuItem
                          icon={<Trash2 className="h-4 w-4" />}
                          variant="destructive"
                          onClick={() => handleDelete(resource.id)}
                        >
                          Delete
                        </PremiumDropdownMenuItem>
                      </PremiumDropdownMenuContent>
                    </PremiumDropdownMenu>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {resource.description && (
                      <p className="text-sm text-white/70">{resource.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-sm text-indigo-200">
                      <ExternalLink className="h-4 w-4" />
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate hover:text-indigo-100"
                      >
                        {resource.url}
                      </a>
                    </div>
                    {resource.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {resource.tags.map((tag) => (
                          <Badge
                            key={tag}
                            className="flex items-center gap-1 rounded-full bg-white/5 text-white/70"
                          >
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
