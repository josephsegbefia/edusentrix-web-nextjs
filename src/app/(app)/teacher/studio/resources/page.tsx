"use client";

import * as React from "react";
import {
  ExternalLink,
  Link2,
  Plus,
  Tag,
  Trash2,
  Pencil,
  BookOpen,
  Share2,
  Upload,
  X,
  Users,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuCheckboxItem,
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
import { DocumentUploader } from "@/components/upload/DocumentUploader";
import { cn } from "@/lib/utils";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";

type ResourceType = "link" | "pdf" | "video" | "image" | "doc" | "slides" | "other";
type ShareTargetType = "teacher" | "student" | "parent";

type ShareTarget = {
  id: string;
  type: ShareTargetType;
  name: string;
  avatarUrl: string | null;
  subtitle: string;
};

const RESOURCE_TYPES: Array<{ value: ResourceType | "all"; label: string }> = [
  { value: "all", label: "All types" },
  { value: "link", label: "Link" },
  { value: "pdf", label: "PDF" },
  { value: "video", label: "Video" },
  { value: "image", label: "Image" },
  { value: "doc", label: "Doc" },
  { value: "slides", label: "Slides" },
  { value: "other", label: "Other" },
];

const SHARE_TARGET_TYPES: Array<{ value: ShareTargetType; label: string }> = [
  { value: "teacher", label: "Teacher" },
  { value: "student", label: "Student" },
  { value: "parent", label: "Parent" },
];

const UPLOAD_RESOURCE_TYPES = new Set<ResourceType>(["pdf", "video", "image", "doc", "slides"]);

const TYPE_STYLES: Record<ResourceType, string> = {
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

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function parseTags(input: string) {
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function buildUploadResourceName(publicId: string, format?: string) {
  const baseName = publicId.split("/").pop() || "resource";
  return format ? `${baseName}.${format}` : baseName;
}

function inferTypeFromUpload(format?: string, mimeType?: string): ResourceType {
  const normalizedMime = (mimeType || "").toLowerCase();
  const normalizedExt = (format || "").toLowerCase();

  if (normalizedMime.startsWith("video/") || ["mp4", "webm", "mov", "avi", "mkv"].includes(normalizedExt)) {
    return "video";
  }
  if (normalizedMime.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif"].includes(normalizedExt)) {
    return "image";
  }
  if (normalizedMime.includes("presentation") || ["ppt", "pptx", "key"].includes(normalizedExt)) {
    return "slides";
  }
  if (normalizedMime.includes("pdf") || normalizedExt === "pdf") {
    return "pdf";
  }
  if (
    normalizedMime.includes("word") ||
    normalizedMime.includes("document") ||
    ["doc", "docx", "rtf"].includes(normalizedExt)
  ) {
    return "doc";
  }
  return "other";
}

function avatarFallback(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "?";
}

export default function TeacherResourcesPage() {
  const busyToast = useBusyToast();
  const { data: contextData } = useTeacherContext();
  const { data: classesData } = useTeacherClasses();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canView = can(permissions, PERMISSIONS.resourcesView);

  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [tagFilter, setTagFilter] = React.useState("");
  const [subjectFilter, setSubjectFilter] = React.useState("all");
  const [classFilter, setClassFilter] = React.useState("all");

  const { data, isLoading, refetch } = useTeacherResources(
    {
      search: search || undefined,
      type: typeFilter === "all" ? undefined : typeFilter,
      tag: tagFilter || undefined,
      subjectId: subjectFilter === "all" ? undefined : subjectFilter,
      classGroupId: classFilter === "all" ? undefined : classFilter,
    },
    canView
  );

  const resources = React.useMemo(() => data?.data.resources ?? [], [data]);

  const createMutation = useTeacherResourceCreate();
  const updateMutation = useTeacherResourceUpdate();
  const deleteMutation = useTeacherResourceDelete();

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<{
    title: string;
    description: string;
    url: string;
    type: ResourceType;
    tags: string;
    subjectId: string;
    classGroupIds: string[];
  }>({
    title: "",
    description: "",
    url: "",
    type: "link",
    tags: "",
    subjectId: "none",
    classGroupIds: [],
  });

  const [uploadModalOpen, setUploadModalOpen] = React.useState(false);
  const prevTypeRef = React.useRef<ResourceType>("link");

  const [metadataResourceId, setMetadataResourceId] = React.useState<string | null>(null);
  const metadataResource = React.useMemo(
    () => resources.find((resource) => resource.id === metadataResourceId) || null,
    [metadataResourceId, resources]
  );

  const [shareResourceId, setShareResourceId] = React.useState<string | null>(null);
  const shareResource = React.useMemo(
    () => resources.find((resource) => resource.id === shareResourceId) || null,
    [resources, shareResourceId]
  );
  const [shareTargetType, setShareTargetType] = React.useState<ShareTargetType>("teacher");
  const [shareQuery, setShareQuery] = React.useState("");
  const [shareClassGroupId, setShareClassGroupId] = React.useState("all");
  const [shareTargets, setShareTargets] = React.useState<ShareTarget[]>([]);
  const [shareLoading, setShareLoading] = React.useState(false);
  const [shareSubmittingId, setShareSubmittingId] = React.useState<string | null>(null);

  const schoolId = contextData?.data.school?._id || "";

  const classAssignments = React.useMemo(() => classesData?.data.classes ?? [], [classesData]);

  const subjectOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    classAssignments.forEach((item) => {
      if (item.subjectId && item.subjectName) {
        map.set(item.subjectId, item.subjectName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [classAssignments]);

  const classOptions = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; subjectIds: Set<string> }>();
    classAssignments.forEach((item) => {
      if (!item._id) return;
      const existing = map.get(item._id);
      if (existing) {
        if (item.subjectId) existing.subjectIds.add(item.subjectId);
        return;
      }

      map.set(item._id, {
        id: item._id,
        name: item.name,
        subjectIds: new Set(item.subjectId ? [item.subjectId] : []),
      });
    });
    return Array.from(map.values()).map((item) => ({
      id: item.id,
      name: item.name,
      subjectIds: Array.from(item.subjectIds),
    }));
  }, [classAssignments]);

  const formClassOptions = React.useMemo(() => {
    if (form.subjectId === "none") return classOptions;
    return classOptions.filter((item) => item.subjectIds.includes(form.subjectId));
  }, [classOptions, form.subjectId]);

  const toggleFormClassGroup = (id: string) => {
    setForm((prev) => {
      const next = new Set(prev.classGroupIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { ...prev, classGroupIds: Array.from(next) };
    });
  };

  const resetForm = React.useCallback(() => {
    setForm({
      title: "",
      description: "",
      url: "",
      type: "link",
      tags: "",
      subjectId: "none",
      classGroupIds: [],
    });
    setEditingId(null);
  }, []);

  const handleEdit = (resource: (typeof resources)[number]) => {
    setEditingId(resource.id);
    setForm({
      title: resource.title,
      description: resource.description || "",
      url: resource.url,
      type: resource.type,
      tags: resource.tags.join(", "),
      subjectId: resource.subject?.id || "none",
      classGroupIds: resource.classGroups.map((item) => item.id),
    });
  };

  React.useEffect(() => {
    const previousType = prevTypeRef.current;
    if (previousType === form.type) return;

    if (previousType === "link" && form.type !== "link" && UPLOAD_RESOURCE_TYPES.has(form.type)) {
      setForm((prev) => ({ ...prev, url: "" }));
      setUploadModalOpen(true);
    }

    prevTypeRef.current = form.type;
  }, [form.type, form.url]);

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      busyToast.warning("Title is required.");
      return;
    }
    if (!form.url.trim()) {
      busyToast.warning(form.type === "link" ? "Link is required." : "Upload a file first.");
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      url: form.url.trim(),
      type: form.type,
      tags: parseTags(form.tags),
      subjectId: form.subjectId === "none" ? null : form.subjectId,
      classGroupIds: form.classGroupIds,
    };

    if (editingId) {
      const result = await busyToast.promise(
        updateMutation.mutateAsync({ id: editingId, ...payload }),
        {
          loading: "Updating resource...",
          success: "Resource updated",
          error: "Failed to update resource",
        }
      );
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

  const fetchShareTargets = React.useCallback(async () => {
    if (!shareResourceId) {
      setShareTargets([]);
      return;
    }

    setShareLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("type", shareTargetType);
      if (shareQuery.trim()) params.set("q", shareQuery.trim());
      if (shareClassGroupId !== "all") params.set("classGroupId", shareClassGroupId);

      const response = await fetch(`/api/teacher/studio/resources/share-targets?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Failed to search targets");
      }

      setShareTargets(payload.data.targets || []);
    } catch (error) {
      setShareTargets([]);
      toast.error(error instanceof Error ? error.message : "Failed to load share targets");
    } finally {
      setShareLoading(false);
    }
  }, [shareClassGroupId, shareQuery, shareResourceId, shareTargetType]);

  React.useEffect(() => {
    if (!shareResourceId) return;
    const timeout = window.setTimeout(() => {
      void fetchShareTargets();
    }, 220);
    return () => window.clearTimeout(timeout);
  }, [fetchShareTargets, shareResourceId]);

  const handleShare = async (target: ShareTarget) => {
    if (!shareResourceId) return;

    setShareSubmittingId(target.id);
    try {
      const response = await fetch(`/api/teacher/studio/resources/${shareResourceId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: target.type,
          targetId: target.id,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Failed to share resource");
      }

      if (payload?.data?.alreadyShared) {
        toast.info("Already shared with this recipient.");
      } else {
        toast.success(`Shared with ${target.name}.`);
      }

      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to share resource");
    } finally {
      setShareSubmittingId(null);
    }
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
          <p className="text-sm text-white/60">
            Save and reuse links and files by subject, class, and tags.
          </p>
        </div>
        <Badge className="w-fit bg-indigo-500/20 text-indigo-200">{resources.length} saved</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
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
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Algebra recap video"
                className="border-white/10 bg-white/5 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Type</Label>
              <PremiumSelect
                value={form.type}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, type: value as ResourceType }))
                }
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

            {form.type === "link" ? (
              <div className="space-y-2">
                <Label className="text-white/70">Link</Label>
                <Input
                  value={form.url}
                  onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
                  placeholder="https://"
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-white/70">File</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => setUploadModalOpen(true)}
                    className="bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30"
                  >
                    <Upload className="h-4 w-4" />
                    {form.url ? "Replace upload" : "Upload file"}
                  </Button>
                  {form.url && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setForm((prev) => ({ ...prev, url: "" }))}
                      className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                    >
                      <X className="h-4 w-4" />
                      Clear
                    </Button>
                  )}
                </div>
                <Input
                  value={form.url}
                  readOnly
                  placeholder="Uploaded file URL will appear here"
                  className="border-white/10 bg-black/20 text-white/75"
                />
                <p className="text-xs text-white/45">
                  Link input is hidden for non-link types. Upload the file with UploadThing.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-white/70">Subject</Label>
              <PremiumSelect
                value={form.subjectId}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    subjectId: value,
                    classGroupIds:
                      value === "none"
                        ? prev.classGroupIds
                        : prev.classGroupIds.filter((id) =>
                            classOptions.some(
                              (option) => option.id === id && option.subjectIds.includes(value)
                            )
                          ),
                  }))
                }
              >
                <PremiumSelectTrigger>
                  <PremiumSelectValue placeholder="Select subject" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  <PremiumSelectItem value="none">No subject</PremiumSelectItem>
                  {subjectOptions.map((subject) => (
                    <PremiumSelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Classes</Label>
              <PremiumDropdownMenu>
                <PremiumDropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                  >
                    {form.classGroupIds.length > 0
                      ? `${form.classGroupIds.length} selected`
                      : "Select classes"}
                  </Button>
                </PremiumDropdownMenuTrigger>
                <PremiumDropdownMenuContent align="start" className="min-w-[240px]">
                  {formClassOptions.length === 0 && (
                    <PremiumDropdownMenuCheckboxItem checked={false} disabled>
                      No classes available
                    </PremiumDropdownMenuCheckboxItem>
                  )}
                  {formClassOptions.map((item) => (
                    <PremiumDropdownMenuCheckboxItem
                      key={item.id}
                      checked={form.classGroupIds.includes(item.id)}
                      onCheckedChange={() => toggleFormClassGroup(item.id)}
                    >
                      {item.name}
                    </PremiumDropdownMenuCheckboxItem>
                  ))}
                </PremiumDropdownMenuContent>
              </PremiumDropdownMenu>
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Optional quick note"
                className="min-h-[90px] border-white/10 bg-white/5 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Tags</Label>
              <Input
                value={form.tags}
                onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
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
          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-2 xl:grid-cols-5">
            <div>
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
            <div>
              <PremiumSelect value={subjectFilter} onValueChange={setSubjectFilter}>
                <PremiumSelectTrigger>
                  <PremiumSelectValue placeholder="Filter subject" />
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
            </div>
            <div>
              <PremiumSelect value={classFilter} onValueChange={setClassFilter}>
                <PremiumSelectTrigger>
                  <PremiumSelectValue placeholder="Filter class" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  <PremiumSelectItem value="all">All classes</PremiumSelectItem>
                  {classOptions.map((classGroup) => (
                    <PremiumSelectItem key={classGroup.id} value={classGroup.id}>
                      {classGroup.name}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
            </div>
            <div>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search resources"
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
            <div>
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
              No resources yet. Add your first resource to build a reusable library.
            </div>
          ) : (
            <div className="space-y-4">
              {resources.map((resource) => (
                <Card
                  key={resource.id}
                  onClick={() => setMetadataResourceId(resource.id)}
                  className="cursor-pointer border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur transition hover:border-white/20"
                >
                  <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg text-white">{resource.title}</CardTitle>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-white/50">
                        <span>{formatDate(resource.createdAt)}</span>
                        <Badge className={cn("rounded-full px-2.5 py-0.5", TYPE_STYLES[resource.type])}>
                          {resource.type.toUpperCase()}
                        </Badge>
                        {resource.subject && (
                          <Badge className="rounded-full bg-indigo-500/15 text-indigo-200">
                            {resource.subject.name}
                          </Badge>
                        )}
                        {resource.classGroups.slice(0, 2).map((classGroup) => (
                          <Badge key={classGroup.id} className="rounded-full bg-emerald-500/15 text-emerald-200">
                            {classGroup.name}
                          </Badge>
                        ))}
                        {resource.classGroups.length > 2 && (
                          <Badge className="rounded-full bg-white/10 text-white/70">
                            +{resource.classGroups.length - 2} classes
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                        onClick={(event) => {
                          event.stopPropagation();
                          setShareResourceId(resource.id);
                        }}
                      >
                        <Share2 className="h-4 w-4" />
                        Share
                      </Button>
                      <PremiumDropdownMenu>
                        <PremiumDropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <span className="sr-only">Actions</span>
                            <Link2 className="h-4 w-4" />
                          </Button>
                        </PremiumDropdownMenuTrigger>
                        <PremiumDropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                          <PremiumDropdownMenuItem asChild icon={<ExternalLink className="h-4 w-4" />}>
                            <a href={resource.url} target="_blank" rel="noreferrer">
                              Open resource
                            </a>
                          </PremiumDropdownMenuItem>
                          <PremiumDropdownMenuItem
                            icon={<Share2 className="h-4 w-4" />}
                            onClick={() => setShareResourceId(resource.id)}
                          >
                            Share
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
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {resource.description && <p className="text-sm text-white/70">{resource.description}</p>}
                    <div className="flex items-center gap-2 text-sm text-indigo-200">
                      <ExternalLink className="h-4 w-4" />
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate hover:text-indigo-100"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {resource.url}
                      </a>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/50">
                      <Users className="h-3.5 w-3.5" />
                      Shared with {resource.sharedWith.length}
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

      <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <DialogContent className="border-white/10 bg-neutral-950 text-white sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-white">Upload Resource File</DialogTitle>
            <DialogDescription className="text-white/60">
              Upload with UploadThing for {form.type.toUpperCase()} resources.
            </DialogDescription>
          </DialogHeader>
          {schoolId ? (
            <DocumentUploader
              schoolId={schoolId}
              category="teachers"
              maxSizeMB={64}
              label="Upload resource file"
              onUploaded={({ publicId, url, format, mimeType }) => {
                setForm((prev) => ({
                  ...prev,
                  url,
                  title: prev.title || buildUploadResourceName(publicId, format),
                  type: prev.type === "link" ? inferTypeFromUpload(format, mimeType) : prev.type,
                }));
                toast.success("Resource file uploaded.");
                setUploadModalOpen(false);
              }}
              onError={(message) => toast.error(message)}
            />
          ) : (
            <p className="text-sm text-white/55">School context unavailable for upload.</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(shareResourceId)}
        onOpenChange={(open) => {
          if (!open) {
            setShareResourceId(null);
            setShareQuery("");
            setShareTargets([]);
            setShareClassGroupId("all");
            setShareTargetType("teacher");
          }
        }}
      >
        <DialogContent className="border-white/10 bg-neutral-950 text-white sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Share Resource</DialogTitle>
            <DialogDescription className="text-white/60">
              {shareResource ? `Share “${shareResource.title}” by searching recipients.` : "Search recipients."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-3">
            <PremiumSelect value={shareTargetType} onValueChange={(value) => setShareTargetType(value as ShareTargetType)}>
              <PremiumSelectTrigger>
                <PremiumSelectValue placeholder="Recipient type" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {SHARE_TARGET_TYPES.map((item) => (
                  <PremiumSelectItem key={item.value} value={item.value}>
                    {item.label}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>

            <PremiumSelect value={shareClassGroupId} onValueChange={setShareClassGroupId}>
              <PremiumSelectTrigger>
                <PremiumSelectValue placeholder="Filter class" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="all">All classes</PremiumSelectItem>
                {classOptions.map((classGroup) => (
                  <PremiumSelectItem key={classGroup.id} value={classGroup.id}>
                    {classGroup.name}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>

            <Input
              value={shareQuery}
              onChange={(event) => setShareQuery(event.target.value)}
              placeholder="Search by name"
              className="border-white/10 bg-white/5 text-white"
            />
          </div>

          <div className="max-h-[360px] space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-3">
            {shareLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="h-12 animate-pulse rounded-xl border border-white/10 bg-white/5" />
                ))}
              </div>
            ) : shareTargets.length === 0 ? (
              <div className="py-8 text-center text-sm text-white/55">No recipients found.</div>
            ) : (
              shareTargets.map((target) => (
                <div
                  key={`${target.type}-${target.id}`}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 border border-white/10">
                      <AvatarImage src={target.avatarUrl || undefined} alt={target.name} />
                      <AvatarFallback className="bg-white/10 text-xs text-white/75">
                        {avatarFallback(target.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm text-white">{target.name}</p>
                      <p className="text-xs text-white/50">{target.subtitle}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      shareSubmittingId === target.id ||
                      Boolean(
                        shareResource?.sharedWith.some(
                          (entry) =>
                            entry.targetType === target.type && entry.targetId === target.id
                        )
                      )
                    }
                    onClick={() => void handleShare(target)}
                    className="bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30"
                  >
                    {shareSubmittingId === target.id
                      ? "Sharing..."
                      : shareResource?.sharedWith.some(
                            (entry) =>
                              entry.targetType === target.type && entry.targetId === target.id
                          )
                        ? "Shared"
                        : "Share"}
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(metadataResourceId)}
        onOpenChange={(open) => {
          if (!open) setMetadataResourceId(null);
        }}
      >
        <DialogContent className="border-white/10 bg-neutral-950 text-white sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Info className="h-4 w-4 text-indigo-200" />
              Resource metadata
            </DialogTitle>
            <DialogDescription className="text-white/60">
              {metadataResource ? metadataResource.title : "Resource details"}
            </DialogDescription>
          </DialogHeader>

          {!metadataResource ? (
            <p className="text-sm text-white/55">Resource no longer available.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Type</p>
                  <p className="mt-1.5 text-sm text-white">{metadataResource.type.toUpperCase()}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Date Added</p>
                  <p className="mt-1.5 text-sm text-white">{formatDateTime(metadataResource.createdAt)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Subject</p>
                  <p className="mt-1.5 text-sm text-white">{metadataResource.subject?.name || "Not set"}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Classes</p>
                  <p className="mt-1.5 text-sm text-white">
                    {metadataResource.classGroups.length > 0
                      ? metadataResource.classGroups.map((classGroup) => classGroup.name).join(", ")
                      : "Not set"}
                  </p>
                </div>
              </div>

              {metadataResource.description && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Description</p>
                  <p className="mt-1.5 text-sm text-white/80">{metadataResource.description}</p>
                </div>
              )}

              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">Resource URL</p>
                <a
                  href={metadataResource.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 block truncate text-sm text-indigo-200 hover:text-indigo-100"
                >
                  {metadataResource.url}
                </a>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">Shared With</p>
                {metadataResource.sharedWith.length === 0 ? (
                  <p className="mt-2 text-sm text-white/55">Not shared yet.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {metadataResource.sharedWith.map((entry) => (
                      <div
                        key={`${entry.targetType}-${entry.targetId}`}
                        className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 border border-white/10">
                            <AvatarImage src={entry.targetAvatarUrl || undefined} alt={entry.targetName} />
                            <AvatarFallback className="bg-white/10 text-xs text-white/70">
                              {avatarFallback(entry.targetName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm text-white">{entry.targetName}</p>
                            <p className="text-xs text-white/50">
                              {entry.targetSubtitle || entry.targetType} • {formatDateTime(entry.sharedAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {metadataResource.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {metadataResource.tags.map((tag) => (
                    <Badge key={tag} className="rounded-full bg-white/10 text-white/75">
                      <Tag className="h-3 w-3" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button asChild className="bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30">
                  <a href={metadataResource.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Open resource
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                  onClick={() => {
                    setMetadataResourceId(null);
                    handleEdit(metadataResource);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
