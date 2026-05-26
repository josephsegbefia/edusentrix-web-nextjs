"use client";

import * as React from "react";
import {
  CheckCircle2,
  Copy,
  ListChecks,
  Percent,
  Plus,
  Search,
  Trash2,
  CheckSquare,
} from "lucide-react";
import { useTeacherRubrics, type RubricSummary } from "@/hooks/teacher/useTeacherRubrics";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

type Criterion = {
  title: string;
  description?: string | null;
  maxScore: number;
  weight?: number | null;
};

type RubricEditorState = {
  id?: string;
  title: string;
  description: string;
  criteria: Criterion[];
};

const EMPTY_CRITERION: Criterion = {
  title: "",
  description: "",
  maxScore: 10,
  weight: null,
};

const EMPTY_RUBRIC: RubricEditorState = {
  title: "",
  description: "",
  criteria: [{ ...EMPTY_CRITERION }],
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

function toFiniteNumberOrDefault(value: string, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function toWeight(value: string): number | null {
  if (value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(100, parsed));
}

function rubricTotalScore(criteria: Criterion[]) {
  return criteria.reduce((sum, criterion) => sum + Number(criterion.maxScore || 0), 0);
}

function rubricTotalWeight(criteria: Criterion[]) {
  return criteria.reduce(
    (sum, criterion) => sum + (criterion.weight === null || criterion.weight === undefined ? 0 : criterion.weight),
    0
  );
}

export default function TeacherRubricsPage() {
  const busyToast = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canManageRubrics = can(permissions, PERMISSIONS.assignmentsCreate);
  const { data, isLoading, refetch } = useTeacherRubrics();
  const rubrics = React.useMemo(() => data?.data.rubrics ?? [], [data]);

  const [editor, setEditor] = React.useState<RubricEditorState | null>(null);
  const [search, setSearch] = React.useState("");

  const filteredRubrics = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rubrics;
    return rubrics.filter((rubric) => {
      const titleMatch = rubric.title.toLowerCase().includes(query);
      const descriptionMatch = (rubric.description || "").toLowerCase().includes(query);
      const criteriaMatch = rubric.criteria.some((criterion) =>
        `${criterion.title} ${criterion.description || ""}`.toLowerCase().includes(query)
      );
      return titleMatch || descriptionMatch || criteriaMatch;
    });
  }, [rubrics, search]);

  const stats = React.useMemo(() => {
    const total = rubrics.length;
    const totalCriteria = rubrics.reduce((sum, rubric) => sum + rubric.criteria.length, 0);
    const avgCriteria = total > 0 ? Number((totalCriteria / total).toFixed(1)) : 0;
    const weightedCount = rubrics.filter((rubric) =>
      rubric.criteria.some((criterion) => criterion.weight !== undefined && criterion.weight !== null)
    ).length;
    return { total, totalCriteria, avgCriteria, weightedCount };
  }, [rubrics]);

  const editorStats = React.useMemo(() => {
    if (!editor) return null;
    const criteriaCount = editor.criteria.length;
    const totalScore = rubricTotalScore(editor.criteria);
    const totalWeight = rubricTotalWeight(editor.criteria);
    return { criteriaCount, totalScore, totalWeight };
  }, [editor]);

  if (!canManageRubrics) {
    return (
      <WorkspacePageShell>
        <WorkspacePageHeader
          icon={CheckSquare}
          title="Rubrics"
          subtitle="Build reusable grading frameworks for assignments."
        />
        <GlassPanel className="p-8 text-center">
          <p className="text-white/70">You do not have permission to manage rubrics.</p>
        </GlassPanel>
      </WorkspacePageShell>
    );
  }

  const openCreate = () => setEditor({ ...EMPTY_RUBRIC, criteria: [{ ...EMPTY_CRITERION }] });

  const openEdit = (rubric: RubricSummary) =>
    setEditor({
      id: rubric.id,
      title: rubric.title,
      description: rubric.description || "",
      criteria: rubric.criteria.map((criterion) => ({
        title: criterion.title,
        description: criterion.description || "",
        maxScore: criterion.maxScore,
        weight: criterion.weight ?? null,
      })),
    });

  const duplicateRubric = (rubric: RubricSummary) =>
    setEditor({
      title: `${rubric.title} (Copy)`,
      description: rubric.description || "",
      criteria: rubric.criteria.map((criterion) => ({
        title: criterion.title,
        description: criterion.description || "",
        maxScore: criterion.maxScore,
        weight: criterion.weight ?? null,
      })),
    });

  const updateEditor = (patch: Partial<RubricEditorState>) => {
    setEditor((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const updateCriterion = (index: number, patch: Partial<Criterion>) => {
    setEditor((prev) => {
      if (!prev) return prev;
      const next = [...prev.criteria];
      next[index] = { ...next[index], ...patch };
      return { ...prev, criteria: next };
    });
  };

  const addCriterion = () => {
    setEditor((prev) =>
      prev
        ? {
            ...prev,
            criteria: [...prev.criteria, { ...EMPTY_CRITERION }],
          }
        : prev
    );
  };

  const removeCriterion = (index: number) => {
    setEditor((prev) => {
      if (!prev) return prev;
      if (prev.criteria.length <= 1) return prev;
      const next = [...prev.criteria];
      next.splice(index, 1);
      return { ...prev, criteria: next };
    });
  };

  const saveRubric = async () => {
    if (!editor) return;
    if (!editor.title.trim()) {
      busyToast.warning("Provide a rubric title.");
      return;
    }
    if (editor.criteria.some((criterion) => !criterion.title.trim())) {
      busyToast.warning("Fill in all rubric criteria titles.");
      return;
    }

    const payload = {
      title: editor.title.trim(),
      description: editor.description.trim() || null,
      criteria: editor.criteria.map((criterion) => ({
        title: criterion.title.trim(),
        description: (criterion.description || "").trim() || null,
        maxScore: Math.max(0, Number(criterion.maxScore || 0)),
        weight: criterion.weight ?? null,
      })),
    };

    const method = editor.id ? "PATCH" : "POST";
    const url = editor.id ? `/api/teacher/studio/rubrics/${editor.id}` : "/api/teacher/studio/rubrics";

    await busyToast.promise(
      fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(async (res) => {
        const response = await res.json();
        if (!res.ok) throw new Error(response?.error || "Failed to save rubric");
        return response;
      }),
      {
        loading: "Saving rubric...",
        success: "Rubric saved",
        error: "Failed to save rubric",
      }
    );

    setEditor(null);
    await refetch();
  };

  const deleteRubric = async (id: string) => {
    const decision = await confirm({
      title: "Delete rubric?",
      description: "This rubric will be permanently deleted. This action cannot be undone.",
      confirmLabel: "Delete rubric",
      intent: "destructive",
    });
    if (decision !== "confirm") return;

    await busyToast.promise(
      fetch(`/api/teacher/studio/rubrics/${id}`, { method: "DELETE" }).then(async (res) => {
        if (!res.ok) {
          const response = await res.json();
          throw new Error(response?.error || "Failed to delete rubric");
        }
        return res.json();
      }),
      {
        loading: "Deleting rubric...",
        success: "Rubric deleted",
        error: "Failed to delete rubric",
      }
    );
    await refetch();
  };

  return (
    <WorkspacePageShell>
      <WorkspacePageHeader
        icon={CheckSquare}
        title="Rubrics"
        subtitle="Build reusable, criteria-based grading frameworks for faster and more consistent feedback."
        badge={
          !isLoading ? (
            <span className="rounded-full border border-teal-400/30 bg-teal-500/15 px-3 py-1 text-xs font-medium text-teal-200">
              {stats.total} rubric{stats.total === 1 ? "" : "s"}
            </span>
          ) : undefined
        }
        actions={
          <Button onClick={openCreate} className={glassPrimaryButtonClass}>
            <Plus className="h-4 w-4" />
            New rubric
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge className="border border-white/10 bg-white/5 text-white/70">
          {stats.totalCriteria} criteria
        </Badge>
        <Badge className="border border-cyan-400/20 bg-cyan-500/15 text-cyan-200">
          {stats.avgCriteria} avg / rubric
        </Badge>
        <Badge className="border border-amber-400/20 bg-amber-500/15 text-amber-200">
          {stats.weightedCount} weighted
        </Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,430px)]">
        <div className="space-y-4">
          <Card className={glassPanelClass}>
            <CardHeader>
              <CardTitle className="text-lg">Rubric library</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search title, description, or criterion"
                  className={cn(glassInsetClass, "pl-9 text-white placeholder:text-white/35")}
                />
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <div key={idx} className={cn(glassInsetClass, "h-28 animate-pulse rounded-2xl")} />
                  ))}
                </div>
              ) : filteredRubrics.length === 0 ? (
                <div className={cn(glassInsetClass, "rounded-2xl p-8 text-center text-white/60")}>
                  {search.trim() ? "No rubrics match your search." : "No rubrics yet. Create your first rubric."}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {filteredRubrics.map((rubric) => {
                    const totalScore = rubricTotalScore(rubric.criteria);
                    const hasWeight = rubric.criteria.some(
                      (criterion) => criterion.weight !== undefined && criterion.weight !== null
                    );

                    return (
                      <Card
                        key={rubric.id}
                        className={cn(
                          glassPanelClass,
                          "transition hover:border-white/20 hover:-translate-y-0.5"
                        )}
                      >
                        <CardHeader className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <CardTitle className="text-lg text-white">{rubric.title}</CardTitle>
                            <Badge className="border border-teal-400/20 bg-teal-500/15 text-teal-200">
                              {rubric.criteria.length} criteria
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge className="bg-white/10 text-white/75">
                              <CheckCircle2 className="h-3 w-3" />
                              {totalScore} max pts
                            </Badge>
                            {hasWeight && (
                              <Badge className="bg-amber-500/20 text-amber-100">
                                <Percent className="h-3 w-3" />
                                Weighted
                              </Badge>
                            )}
                            <Badge className="bg-white/10 text-white/65">Created {formatDate(rubric.createdAt)}</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="line-clamp-2 text-sm text-white/65">{rubric.description || "No description."}</p>

                          <div className="space-y-1">
                            {rubric.criteria.slice(0, 3).map((criterion, index) => (
                              <div
                                key={`${rubric.id}-${criterion.title}-${index}`}
                                className={cn(glassInsetClass, "flex items-center justify-between rounded-lg px-3 py-2 text-xs")}
                              >
                                <span className="truncate text-white/70">{criterion.title}</span>
                                <span className="text-white/45">{criterion.maxScore} pts</span>
                              </div>
                            ))}
                            {rubric.criteria.length > 3 && (
                              <p className="text-xs text-white/45">
                                +{rubric.criteria.length - 3} more criteria
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2 pt-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(rubric)}
                              className="text-white/70 hover:bg-white/10"
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => duplicateRubric(rubric)}
                              className="text-white/70 hover:bg-white/10"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Duplicate
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteRubric(rubric.id)}
                              className="text-rose-200 hover:bg-rose-500/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 xl:sticky xl:top-4">
          <Card className={glassPanelClass}>
            <CardHeader>
              <CardTitle className="text-lg">
                {editor ? (editor.id ? "Edit rubric" : "Create rubric") : "Rubric builder"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!editor ? (
                <div className={cn(glassInsetClass, "space-y-4 rounded-2xl p-4")}>
                  <p className="text-sm text-white/65">
                    Start a rubric from scratch or open one from the library to edit.
                  </p>
                  <div className="space-y-2 text-xs text-white/50">
                    <p className="inline-flex items-center gap-2">
                      <ListChecks className="h-3.5 w-3.5" />
                      Define clear criteria and scoring
                    </p>
                    <p className="inline-flex items-center gap-2">
                      <Percent className="h-3.5 w-3.5" />
                      Use optional weights for advanced grading
                    </p>
                  </div>
                  <Button
                    onClick={openCreate}
                    className={cn("w-full", glassPrimaryButtonClass)}
                  >
                    <Plus className="h-4 w-4" />
                    New rubric
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className={cn(glassInsetClass, "rounded-xl p-3")}>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Criteria</p>
                      <p className="mt-1 text-lg font-semibold text-white">{editorStats?.criteriaCount || 0}</p>
                    </div>
                    <div className={cn(glassInsetClass, "rounded-xl p-3")}>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Total score</p>
                      <p className="mt-1 text-lg font-semibold text-white">{editorStats?.totalScore || 0}</p>
                    </div>
                    <div
                      className={cn(
                        cn(glassInsetClass, "rounded-xl p-3"),
                        editorStats && editorStats.totalWeight > 100 && "border-rose-400/40 bg-rose-500/10"
                      )}
                    >
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Weight sum</p>
                      <p className="mt-1 text-lg font-semibold text-white">{editorStats?.totalWeight || 0}%</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.2em] text-white/40">Title</label>
                    <Input
                      value={editor.title}
                      onChange={(event) => updateEditor({ title: event.target.value })}
                      placeholder="e.g. Science Practical Rubric"
                      className={cn(glassInsetClass, "text-white/85")}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.2em] text-white/40">Description</label>
                    <Textarea
                      value={editor.description}
                      onChange={(event) => updateEditor({ description: event.target.value })}
                      placeholder="Optional notes for this rubric"
                      className={cn(glassInsetClass, "min-h-[90px] text-white/85")}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs uppercase tracking-[0.2em] text-white/40">Criteria</label>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={addCriterion}
                        className="text-white/70 hover:bg-white/10"
                      >
                        <Plus className="h-4 w-4" />
                        Add criterion
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {editor.criteria.map((criterion, index) => (
                        <div
                          key={`criterion-${index}`}
                          className={cn(glassInsetClass, "grid grid-cols-1 gap-2 rounded-2xl p-3")}
                        >
                          <Input
                            value={criterion.title}
                            onChange={(event) => updateCriterion(index, { title: event.target.value })}
                            placeholder="Criterion title"
                            className={cn(glassInsetClass, "text-white/85")}
                          />
                          <Input
                            value={criterion.description || ""}
                            onChange={(event) => updateCriterion(index, { description: event.target.value })}
                            placeholder="Description"
                            className={cn(glassInsetClass, "text-white/75")}
                          />

                          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                            <Input
                              type="number"
                              min={0}
                              value={criterion.maxScore}
                              onChange={(event) =>
                                updateCriterion(index, {
                                  maxScore: Math.max(0, toFiniteNumberOrDefault(event.target.value, 0)),
                                })
                              }
                              placeholder="Max score"
                              className={cn(glassInsetClass, "text-white/85")}
                            />
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={criterion.weight ?? ""}
                              onChange={(event) =>
                                updateCriterion(index, {
                                  weight: toWeight(event.target.value),
                                })
                              }
                              placeholder="Weight %"
                              className={cn(glassInsetClass, "text-white/85")}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeCriterion(index)}
                              className="text-white/60 hover:bg-white/10"
                              disabled={editor.criteria.length <= 1}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setEditor(null)}
                      className={glassSecondaryButtonClass}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={saveRubric}
                      className={glassPrimaryButtonClass}
                    >
                      Save rubric
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      {confirmationDialog}
    </WorkspacePageShell>
  );
}
