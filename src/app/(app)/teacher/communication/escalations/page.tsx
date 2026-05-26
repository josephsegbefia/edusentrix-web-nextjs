"use client";

import * as React from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  CircleHelp,
  Clock3,
  HeartPulse,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  Search,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import {
  useTeacherEscalations,
  type EscalationSummary,
} from "@/hooks/teacher/useTeacherEscalations";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useClassRoster } from "@/hooks/teacher/useClassRoster";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useBusyToast } from "@/hooks/useBusyToast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { GlassPanel } from "@/components/ui/glass-panel";
import {
  glassInsetClass,
  glassPanelClass,
  glassPrimaryButtonClass,
  glassSecondaryButtonClass,
} from "@/lib/ui/glass-surfaces";

const NO_STUDENT_VALUE = "__no_student__";

const statusFilterOptions = [
  { value: "all", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "in_review", label: "In review" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
] as const;

const statusActionOptions = statusFilterOptions.filter(
  (option) => option.value !== "all"
) as Array<{ value: EscalationSummary["status"]; label: string }>;

const typeFilterOptions = [
  { value: "all", label: "All types" },
  { value: "discipline", label: "Discipline" },
  { value: "academic", label: "Academic" },
  { value: "welfare", label: "Welfare" },
  { value: "other", label: "Other" },
] as const;

const typeOptions = typeFilterOptions.filter(
  (option) => option.value !== "all"
) as Array<{ value: EscalationSummary["type"]; label: string }>;

const statusTone: Record<EscalationSummary["status"], string> = {
  open: "bg-rose-500/20 text-rose-100",
  in_review: "bg-amber-500/20 text-amber-100",
  resolved: "bg-emerald-500/20 text-emerald-100",
  closed: "bg-white/10 text-white/70",
};

const typeTone: Record<EscalationSummary["type"], string> = {
  discipline: "bg-rose-500/20 text-rose-100",
  academic: "bg-teal-500/20 text-teal-100",
  welfare: "bg-cyan-500/20 text-cyan-100",
  other: "bg-white/10 text-white/70",
};

const typeIcon: Record<EscalationSummary["type"], React.ComponentType<{ className?: string }>> = {
  discipline: ShieldAlert,
  academic: BookOpen,
  welfare: HeartPulse,
  other: CircleHelp,
};

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

function titleCase(input: string) {
  return input.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escalationMatchesSearch(escalation: EscalationSummary, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const studentText = escalation.student
    ? `${escalation.student.name} ${escalation.student.admissionNo ?? ""}`
    : "";

  return `${escalation.title} ${escalation.description} ${escalation.type} ${escalation.status} ${studentText}`
    .toLowerCase()
    .includes(normalized);
}

function EscalationCard({
  escalation,
  canEscalate,
  onStatusUpdate,
}: {
  escalation: EscalationSummary;
  canEscalate: boolean;
  onStatusUpdate: (id: string, nextStatus: EscalationSummary["status"]) => Promise<void>;
}) {
  const TypeIcon = typeIcon[escalation.type];

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
            <CardTitle className="text-lg text-white">{escalation.title}</CardTitle>
            <Badge className={cn("rounded-full px-2.5 py-0.5", statusTone[escalation.status])}>
              {titleCase(escalation.status)}
            </Badge>
            <Badge className={cn("rounded-full px-2.5 py-0.5", typeTone[escalation.type])}>
              <TypeIcon className="h-3.5 w-3.5" />
              {titleCase(escalation.type)}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-white/55">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" />
              Logged {formatDateTime(escalation.createdAt)}
            </span>

            {escalation.student ? (
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-3.5 w-3.5" />
                {escalation.student.name}
                {escalation.student.admissionNo ? ` (${escalation.student.admissionNo})` : ""}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-white/45">
                <UserRound className="h-3.5 w-3.5" />
                General escalation
              </span>
            )}

            {(escalation.status === "resolved" || escalation.status === "closed") &&
            escalation.resolvedAt ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-200/80">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Closed {formatDate(escalation.resolvedAt)}
              </span>
            ) : null}
          </div>
        </div>

        {canEscalate ? (
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
              {statusActionOptions.map((option) => (
                <PremiumDropdownMenuItem
                  key={option.value}
                  disabled={option.value === escalation.status}
                  onClick={() => void onStatusUpdate(escalation.id, option.value)}
                >
                  Mark {option.label}
                </PremiumDropdownMenuItem>
              ))}
            </PremiumDropdownMenuContent>
          </PremiumDropdownMenu>
        ) : null}
      </CardHeader>

      <CardContent>
        <p className="whitespace-pre-wrap text-sm text-white/70">{escalation.description}</p>
      </CardContent>
    </Card>
  );
}

export default function TeacherEscalationsPage() {
  const busyToast = useBusyToast();
  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canEscalate = can(permissions, PERMISSIONS.escalationsCreate);

  const [statusFilter, setStatusFilter] =
    React.useState<(typeof statusFilterOptions)[number]["value"]>("all");
  const [typeFilter, setTypeFilter] =
    React.useState<(typeof typeFilterOptions)[number]["value"]>("all");
  const [searchQuery, setSearchQuery] = React.useState("");

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useTeacherEscalations();

  const escalations = React.useMemo(() => data?.data.escalations ?? [], [data]);

  const filteredEscalations = React.useMemo(() => {
    return escalations.filter((escalation) => {
      const statusMatches = statusFilter === "all" || escalation.status === statusFilter;
      if (!statusMatches) return false;

      const typeMatches = typeFilter === "all" || escalation.type === typeFilter;
      if (!typeMatches) return false;

      return escalationMatchesSearch(escalation, searchQuery);
    });
  }, [escalations, searchQuery, statusFilter, typeFilter]);

  const stats = React.useMemo(() => {
    return {
      total: escalations.length,
      open: escalations.filter((item) => item.status === "open").length,
      inReview: escalations.filter((item) => item.status === "in_review").length,
      resolved: escalations.filter((item) => item.status === "resolved").length,
      closed: escalations.filter((item) => item.status === "closed").length,
    };
  }, [escalations]);

  const { data: classesData } = useTeacherClasses();
  const classOptions = React.useMemo(
    () =>
      (classesData?.data.classes || []).map((item) => ({
        id: item._id,
        name: item.name,
      })),
    [classesData]
  );

  const [createOpen, setCreateOpen] = React.useState(false);
  const [selectedClassId, setSelectedClassId] = React.useState("");
  const [selectedStudentId, setSelectedStudentId] = React.useState(NO_STUDENT_VALUE);
  const [type, setType] = React.useState<EscalationSummary["type"]>("academic");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");

  const { data: rosterData } = useClassRoster(createOpen ? selectedClassId : undefined);
  const roster = React.useMemo(() => rosterData?.data.students ?? [], [rosterData]);

  React.useEffect(() => {
    if (!selectedClassId && classOptions.length > 0) {
      setSelectedClassId(classOptions[0].id);
    }
  }, [classOptions, selectedClassId]);

  React.useEffect(() => {
    if (roster.length === 0) {
      setSelectedStudentId(NO_STUDENT_VALUE);
      return;
    }

    if (selectedStudentId === NO_STUDENT_VALUE) {
      return;
    }

    if (!roster.some((student) => student._id === selectedStudentId)) {
      setSelectedStudentId(NO_STUDENT_VALUE);
    }
  }, [roster, selectedStudentId]);

  const resetCreateForm = React.useCallback(() => {
    setSelectedStudentId(NO_STUDENT_VALUE);
    setType("academic");
    setTitle("");
    setDescription("");
  }, []);

  const openCreateDialog = () => {
    resetCreateForm();
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!title.trim() || !description.trim()) {
      busyToast.error("Title and description are required");
      return;
    }

    await busyToast.promise(
      fetch("/api/teacher/escalations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudentId === NO_STUDENT_VALUE ? undefined : selectedStudentId,
          type,
          title: title.trim(),
          description: description.trim(),
        }),
      }).then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(payload?.error || "Failed to create escalation");
        }
        return payload;
      }),
      {
        loading: "Creating escalation...",
        success: "Escalation logged",
        error: "Failed to create escalation",
      }
    );

    setCreateOpen(false);
    resetCreateForm();
    await refetch();
  };

  const handleStatusUpdate = async (
    id: string,
    nextStatus: EscalationSummary["status"]
  ) => {
    await busyToast.promise(
      fetch(`/api/teacher/escalations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      }).then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(payload?.error || "Failed to update escalation");
        }
        return payload;
      }),
      {
        loading: "Updating escalation...",
        success: "Escalation updated",
        error: "Failed to update escalation",
      }
    );
    await refetch();
  };

  const headerActions = (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        onClick={() => void refetch()}
        className={glassSecondaryButtonClass}
      >
        <RefreshCcw className="h-4 w-4" />
        Refresh
      </Button>
      {canEscalate ? (
        <Button onClick={openCreateDialog} className={glassPrimaryButtonClass}>
          <Plus className="h-4 w-4" />
          New escalation
        </Button>
      ) : null}
    </div>
  );

  return (
    <WorkspacePageShell>
      <WorkspacePageHeader
        icon={AlertTriangle}
        title="Escalations"
        subtitle="Formal incident records for issues that need counselor, pastoral, or school leadership follow-up beyond normal classroom handling."
        badge={
          !isLoading ? (
            <span className="rounded-full border border-teal-400/30 bg-teal-500/15 px-3 py-1 text-xs font-medium text-teal-200">
              {stats.total} escalation{stats.total === 1 ? "" : "s"}
            </span>
          ) : undefined
        }
        actions={headerActions}
      />

      <div className="flex flex-wrap gap-2">
        <Badge className="border border-rose-400/20 bg-rose-500/15 text-rose-200">
          {stats.open} open
        </Badge>
        <Badge className="border border-amber-400/20 bg-amber-500/15 text-amber-200">
          {stats.inReview} in review
        </Badge>
        <Badge className="border border-emerald-400/20 bg-emerald-500/15 text-emerald-200">
          {stats.resolved} resolved
        </Badge>
        <Badge className="border border-white/10 bg-white/5 text-white/70">
          {stats.closed} closed
        </Badge>
      </div>

      {!canEscalate && (
        <div className={cn(glassInsetClass, "rounded-xl px-3 py-2 text-xs text-white/60")}>
          You can view escalations, but creating and status updates are restricted.
        </div>
      )}

      <Card className={glassPanelClass}>
        <CardHeader>
          <CardTitle className="text-lg">What escalations are and how to use them</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          <div className={cn(glassInsetClass, "p-4")}>
            <h3 className="text-sm font-semibold text-white">What an escalation is</h3>
            <p className="mt-2 text-sm text-white/65">
              Use escalations to formally document incidents such as behavior concerns, academic
              risk, safeguarding or welfare concerns, and any situation that requires additional
              support from school leadership.
            </p>
          </div>
          <div className={cn(glassInsetClass, "p-4")}>
            <h3 className="text-sm font-semibold text-white">How to use this page</h3>
            <ol className="mt-2 space-y-1.5 text-sm text-white/65">
              <li>1. Click `New escalation` and choose a type.</li>
              <li>2. Link a student when relevant, or keep it as a general issue.</li>
              <li>3. Add a clear title and factual description of what happened.</li>
              <li>4. Track progress with statuses: Open, In review, Resolved, Closed.</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <Card className={glassPanelClass}>
        <CardHeader>
          <CardTitle className="text-lg">Filter escalations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <PremiumSelect
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as (typeof statusFilterOptions)[number]["value"])
              }
            >
              <PremiumSelectTrigger>
                <PremiumSelectValue placeholder="Filter status" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {statusFilterOptions.map((option) => (
                  <PremiumSelectItem key={option.value} value={option.value}>
                    {option.label}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>

            <PremiumSelect
              value={typeFilter}
              onValueChange={(value) =>
                setTypeFilter(value as (typeof typeFilterOptions)[number]["value"])
              }
            >
              <PremiumSelectTrigger>
                <PremiumSelectValue placeholder="Filter type" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {typeFilterOptions.map((option) => (
                  <PremiumSelectItem key={option.value} value={option.value}>
                    {option.label}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>

            <div className="relative xl:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <Input
                placeholder="Search title, student, description"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className={cn(glassInsetClass, "pl-9 text-white placeholder:text-white/35")}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setStatusFilter("all");
                setTypeFilter("all");
                setSearchQuery("");
              }}
              className={glassSecondaryButtonClass}
            >
              Reset filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className={cn(glassInsetClass, "rounded-2xl p-6")}>
              <div className="space-y-3">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <Card className="border border-red-500/30 bg-linear-to-br from-red-950/40 to-transparent p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-red-300/70" />
          <p className="text-sm text-red-100/80">Failed to load escalations. Please try again.</p>
          <div className="mt-4">
            <Button
              onClick={() => void refetch()}
              className="bg-red-500/20 text-red-100 hover:bg-red-500/30"
            >
              Retry
            </Button>
          </div>
        </Card>
      ) : filteredEscalations.length === 0 ? (
        <GlassPanel className="p-8 text-center">
          <p className="text-sm text-white/60">No escalations match your current filters.</p>
          {canEscalate && escalations.length === 0 ? (
            <Button onClick={openCreateDialog} className={cn("mt-4", glassPrimaryButtonClass)}>
              <Plus className="h-4 w-4" />
              New escalation
            </Button>
          ) : null}
        </GlassPanel>
      ) : (
        <div className="space-y-4">
          {filteredEscalations.map((escalation) => (
            <EscalationCard
              key={escalation.id}
              escalation={escalation}
              canEscalate={canEscalate}
              onStatusUpdate={handleStatusUpdate}
            />
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="border-white/10 bg-[#0f0f14] text-white">
          <DialogHeader>
            <DialogTitle className="text-lg">Log escalation</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className={cn(glassInsetClass, "p-3 text-xs text-white/65")}>
              Describe facts clearly: what happened, who was involved, and any action already
              taken in class.
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                  Class group
                </label>
                <PremiumSelect value={selectedClassId} onValueChange={setSelectedClassId}>
                  <PremiumSelectTrigger>
                    <PremiumSelectValue placeholder="Select class" />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    {classOptions.map((classOption) => (
                      <PremiumSelectItem key={classOption.id} value={classOption.id}>
                        {classOption.name}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                  Student (optional)
                </label>
                <PremiumSelect value={selectedStudentId} onValueChange={setSelectedStudentId}>
                  <PremiumSelectTrigger>
                    <PremiumSelectValue placeholder="Select student" />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    <PremiumSelectItem value={NO_STUDENT_VALUE}>
                      No specific student
                    </PremiumSelectItem>
                    {roster.map((student) => (
                      <PremiumSelectItem key={student._id} value={student._id}>
                        {student.firstName} {student.lastName}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                Type
              </label>
              <PremiumSelect
                value={type}
                onValueChange={(value) => setType(value as EscalationSummary["type"])}
              >
                <PremiumSelectTrigger>
                  <PremiumSelectValue placeholder="Select type" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  {typeOptions.map((option) => (
                    <PremiumSelectItem key={option.value} value={option.value}>
                      {option.label}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                Title
              </label>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Short escalation summary"
                className={cn(glassInsetClass, "text-white")}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                Description
              </label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Include timeline, observed impact, and interventions already attempted."
                className={cn(glassInsetClass, "min-h-[120px] text-white")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              className={glassSecondaryButtonClass}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleCreate()}
              disabled={!canEscalate}
              className={glassPrimaryButtonClass}
            >
              Log escalation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspacePageShell>
  );
}
