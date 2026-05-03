"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookMarked,
  Check,
  ChevronLeft,
  ChevronRight,
  Layers3,
  Loader2,
  Plus,
  Trash2,
  TreeDeciduous,
} from "lucide-react";
import { toast } from "sonner";
import {
  CURRICULUM_PROFILES,
  type CurriculumCode,
} from "@/constants/curriculum-profiles";
import { curriculumProgrammeLabel } from "@/lib/curricula/programme-label";
import { useAdminCurriculumPatch } from "@/hooks/admin/useAdminCurricula";
import {
  useAdminCurriculumNodes,
  useAdminCurriculumNodeCreate,
  useAdminCurriculumNodeDelete,
  useAdminCurriculumSubjectCreate,
  useAdminCurriculumSubjectDelete,
  useAdminCurriculumSubjects,
  type AdminCurriculumNodeRow,
  type AdminCurriculumSubjectRow,
} from "@/hooks/admin/useAdminCurriculumFramework";
import type { AdminCurriculumRow } from "@/hooks/admin/useAdminCurricula";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

const STEPS = [
  { id: "overview", label: "Overview" },
  { id: "subjects", label: "Subjects" },
  { id: "structure", label: "Structure" },
  { id: "review", label: "Review" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

const PROGRAMME_ENTRIES = Object.entries(CURRICULUM_PROFILES) as [
  CurriculumCode,
  (typeof CURRICULUM_PROFILES)["ghana_nacca"],
][];

const KIND_LABELS: Record<AdminCurriculumNodeRow["kind"], string> = {
  strand: "Strand",
  sub_strand: "Sub-strand",
  topic: "Topic",
  sub_topic: "Sub-topic",
  objective: "Objective",
};

const glassPanel =
  "relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/35 backdrop-blur-xl";

function PanelChrome() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-cyan-500/8 via-transparent to-transparent"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
        aria-hidden="true"
      />
    </>
  );
}

function groupNodesByParent(nodes: AdminCurriculumNodeRow[]) {
  const map = new Map<string | null, AdminCurriculumNodeRow[]>();
  for (const n of nodes) {
    const k = n.parentNodeId;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(n);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.order - b.order);
  }
  return map;
}

type CurriculumFrameworkWizardProps = {
  curriculumId: string;
  curriculum: AdminCurriculumRow;
};

export function CurriculumFrameworkWizard({
  curriculumId,
  curriculum,
}: CurriculumFrameworkWizardProps) {
  const router = useRouter();
  const patch = useAdminCurriculumPatch();
  const createSubject = useAdminCurriculumSubjectCreate(curriculumId);
  const deleteSubject = useAdminCurriculumSubjectDelete();

  const [currentStep, setCurrentStep] = React.useState<StepId>("overview");
  const [completedSteps, setCompletedSteps] = React.useState<Set<StepId>>(new Set());

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  const [title, setTitle] = React.useState(curriculum.title);
  const [code, setCode] = React.useState(curriculum.code);
  const [description, setDescription] = React.useState(curriculum.description ?? "");
  const [schoolCurriculumCode, setSchoolCurriculumCode] = React.useState(
    curriculum.schoolCurriculumCode ?? ""
  );

  React.useEffect(() => {
    setTitle(curriculum.title);
    setCode(curriculum.code);
    setDescription(curriculum.description ?? "");
    setSchoolCurriculumCode(curriculum.schoolCurriculumCode ?? "");
  }, [
    curriculum.title,
    curriculum.code,
    curriculum.description,
    curriculum.schoolCurriculumCode,
  ]);

  const { data: subjectPicklist = [], isLoading: subjectsLoading } = useQuery({
    queryKey: ["admin-picklist-subjects"],
    queryFn: async () => {
      const res = await fetch("/api/admin/subjects?isActive=true", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as
        | { success: boolean; data?: Array<{ id: string; name: string }>; error?: string }
        | null;
      if (!res.ok || !json?.success || !json.data) throw new Error(json?.error || "Subjects failed");
      return json.data;
    },
    staleTime: 60_000,
  });

  const { data: gradePicklist = [], isLoading: gradesLoading } = useQuery({
    queryKey: ["admin-picklist-grades"],
    queryFn: async () => {
      const res = await fetch("/api/admin/grades?active=1", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as
        | { success: boolean; data?: Array<{ id: string; name: string }>; error?: string }
        | null;
      if (!res.ok || !json?.success || !json.data) throw new Error(json?.error || "Grades failed");
      return json.data;
    },
    staleTime: 60_000,
  });

  const { data: curriculumSubjects = [], isLoading: csLoading } =
    useAdminCurriculumSubjects(curriculumId);

  const [selectedSubjectRowId, setSelectedSubjectRowId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!selectedSubjectRowId && curriculumSubjects.length > 0) {
      setSelectedSubjectRowId(curriculumSubjects[0].id);
    }
    if (
      selectedSubjectRowId &&
      !curriculumSubjects.some((s) => s.id === selectedSubjectRowId)
    ) {
      setSelectedSubjectRowId(curriculumSubjects[0]?.id ?? null);
    }
  }, [curriculumSubjects, selectedSubjectRowId]);

  const activeCsId = selectedSubjectRowId ?? curriculumSubjects[0]?.id ?? "";

  const { data: nodes = [], isLoading: nodesLoading } = useAdminCurriculumNodes(
    curriculumId,
    activeCsId || undefined
  );
  const createNode = useAdminCurriculumNodeCreate(curriculumId, activeCsId);
  const deleteNode = useAdminCurriculumNodeDelete(curriculumId, activeCsId);

  const [addSubjectId, setAddSubjectId] = React.useState("");
  const [addGradeId, setAddGradeId] = React.useState<string>("any");

  const [nodeKind, setNodeKind] = React.useState<AdminCurriculumNodeRow["kind"]>("strand");
  const [nodeTitle, setNodeTitle] = React.useState("");
  const [nodeCode, setNodeCode] = React.useState("");
  const [nodeParentId, setNodeParentId] = React.useState<string>("root");

  const byParent = React.useMemo(() => groupNodesByParent(nodes), [nodes]);

  const validateStep = (step: StepId): { valid: boolean; message?: string } => {
    if (step === "overview") {
      if (title.trim().length < 2) return { valid: false, message: "Title is required" };
      if (code.trim().length < 2) return { valid: false, message: "Code is required" };
      return { valid: true };
    }
    if (step === "subjects") {
      return { valid: true };
    }
    if (step === "structure") {
      if (curriculumSubjects.length === 0) {
        return { valid: false, message: "Add at least one subject before mapping structure" };
      }
      if (!activeCsId) return { valid: false, message: "Select a subject row" };
      return { valid: true };
    }
    return { valid: true };
  };

  const currentValidation = validateStep(currentStep);
  const canProceed = currentValidation.valid;

  const persistOverview = async () => {
    await patch.mutateAsync({
      id: curriculumId,
      body: {
        title: title.trim(),
        code: code.trim(),
        description: description.trim() ? description.trim() : null,
        schoolCurriculumCode:
          schoolCurriculumCode && schoolCurriculumCode !== "any"
            ? schoolCurriculumCode
            : null,
      },
    });
  };

  const goNext = async () => {
    if (!canProceed) return;
    if (currentStep === "overview") {
      try {
        await persistOverview();
        toast.success("Framework details saved");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save");
        return;
      }
    }
    setCompletedSteps((prev) => new Set(prev).add(currentStep));
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
    }
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
    }
  };

  const goToStep = (id: StepId) => {
    setCurrentStep(id);
  };

  async function handleAddSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!addSubjectId) return;
    try {
      await createSubject.mutateAsync({
        subjectId: addSubjectId,
        gradeId: addGradeId === "any" ? null : addGradeId,
      });
      toast.success("Subject added to framework");
      setAddSubjectId("");
      setAddGradeId("any");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add subject");
    }
  }

  async function handleRemoveSubject(row: AdminCurriculumSubjectRow) {
    try {
      await deleteSubject.mutateAsync({ id: row.id, curriculumId });
      toast.success("Removed from framework");
      if (selectedSubjectRowId === row.id) setSelectedSubjectRowId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove");
    }
  }

  async function handleAddNode(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCsId || !nodeTitle.trim()) return;
    try {
      await createNode.mutateAsync({
        kind: nodeKind,
        title: nodeTitle.trim(),
        code: nodeCode.trim() || null,
        parentNodeId: nodeParentId === "root" ? null : nodeParentId,
      });
      toast.success("Node added");
      setNodeTitle("");
      setNodeCode("");
      setNodeParentId("root");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add node");
    }
  }

  function renderNodeTree(parentId: string | null, depth: number) {
    const list = byParent.get(parentId) ?? [];
    return (
      <ul className={cn("space-y-1", depth > 0 && "ml-4 border-l border-white/10 pl-3")}>
        {list.map((n) => (
          <li key={n.id} className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-white/15 bg-white/5 text-[10px] uppercase tracking-wide text-white/55"
                  >
                    {KIND_LABELS[n.kind]}
                  </Badge>
                  {n.code ? (
                    <code className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 text-[11px] text-cyan-100/90">
                      {n.code}
                    </code>
                  ) : null}
                </div>
                <p className="mt-1 text-sm font-medium text-white">{n.title}</p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 text-white/45 hover:bg-rose-500/15 hover:text-rose-200"
                disabled={deleteNode.isPending}
                onClick={() =>
                  void deleteNode
                    .mutateAsync(n.id)
                    .then(() => toast.success("Node removed"))
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {renderNodeTree(n.id, depth + 1)}
          </li>
        ))}
      </ul>
    );
  }

  const renderStepContent = () => {
    if (currentStep === "overview") {
      return (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-white/45">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="border-white/10 bg-white/5 text-white placeholder:text-white/35"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-white/45">Code</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="border-white/10 bg-white/5 text-white placeholder:text-white/35"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-white/45">Match school programme</Label>
            <PremiumSelect
              value={schoolCurriculumCode || "any"}
              onValueChange={(v) => setSchoolCurriculumCode(v === "any" ? "" : v)}
            >
              <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white">
                <PremiumSelectValue placeholder="Any / not linked" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="any">Any / not linked</PremiumSelectItem>
                {PROGRAMME_ENTRIES.map(([key, profile]) => (
                  <PremiumSelectItem key={key} value={key}>
                    {profile.label}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-white/45">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="resize-none border-white/10 bg-white/5 text-white placeholder:text-white/35"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-white/15 bg-white/5 capitalize text-white/70">
              Status: {curriculum.status}
            </Badge>
            <Badge variant="outline" className="border-cyan-300/20 bg-cyan-400/10 text-cyan-100">
              {curriculum.schoolCurriculumCode
                ? curriculumProgrammeLabel(curriculum.schoolCurriculumCode as CurriculumCode) ||
                  "Programme linked"
                : "No programme link"}
            </Badge>
          </div>
        </div>
      );
    }

    if (currentStep === "subjects") {
      return (
        <div className="space-y-6">
          <p className="text-sm leading-6 text-white/55">
            Map school subjects (and optionally grades) into this framework. Teachers align schemes to
            these rows when building Leo plans.
          </p>

          <form onSubmit={handleAddSubject} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-white/45">Subject</Label>
                <PremiumSelect
                  value={addSubjectId || "pick"}
                  onValueChange={(v) => setAddSubjectId(v === "pick" ? "" : v)}
                  disabled={subjectsLoading}
                >
                  <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white">
                    <PremiumSelectValue placeholder="Choose a subject" />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    <PremiumSelectItem value="pick">Choose a subject</PremiumSelectItem>
                    {subjectPicklist.map((s) => (
                      <PremiumSelectItem key={s.id} value={s.id}>
                        {s.name}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-white/45">Grade (optional)</Label>
                <PremiumSelect
                  value={addGradeId}
                  onValueChange={setAddGradeId}
                  disabled={gradesLoading}
                >
                  <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white">
                    <PremiumSelectValue placeholder="All grades / not specified" />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    <PremiumSelectItem value="any">All grades / not specified</PremiumSelectItem>
                    {gradePicklist.map((g) => (
                      <PremiumSelectItem key={g.id} value={g.id}>
                        {g.name}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>
            </div>
            <Button
              type="submit"
              className="mt-4 gap-2 bg-linear-to-r from-cyan-500 to-teal-600 text-white shadow-lg shadow-cyan-500/15"
              disabled={!addSubjectId || createSubject.isPending}
            >
              {createSubject.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add subject row
            </Button>
          </form>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-white/45">Framework subjects</Label>
            {csLoading ? (
              <div className="flex items-center gap-2 text-sm text-white/45">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : curriculumSubjects.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-8 text-center text-sm text-white/45">
                No subjects yet. Add at least one to continue to structure.
              </p>
            ) : (
              <div className="space-y-2">
                {curriculumSubjects.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-white">{row.subjectName ?? "Subject"}</p>
                      <p className="text-xs text-white/45">
                        {row.gradeName ? row.gradeName : "All grades / not specified"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-rose-300/90 hover:bg-rose-500/10 hover:text-rose-100"
                      disabled={deleteSubject.isPending}
                      onClick={() => void handleRemoveSubject(row)}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (currentStep === "structure") {
      return (
        <div className="space-y-6">
          <p className="text-sm leading-6 text-white/55">
            Add strands, topics, and objectives under each subject row. Child nodes inherit planning
            context for schemes of work.
          </p>

          {curriculumSubjects.length === 0 ? (
            <p className="rounded-xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              Go back to Subjects and add at least one subject row.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-white/45">
                  Subject row
                </Label>
                <PremiumSelect
                  value={activeCsId || "pick"}
                  onValueChange={(v) => setSelectedSubjectRowId(v === "pick" ? null : v)}
                >
                  <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white">
                    <PremiumSelectValue placeholder="Select subject row" />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    <PremiumSelectItem value="pick">Select subject row</PremiumSelectItem>
                    {curriculumSubjects.map((row) => (
                      <PremiumSelectItem key={row.id} value={row.id}>
                        {(row.subjectName ?? "Subject") +
                          (row.gradeName ? ` · ${row.gradeName}` : "")}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>

              {activeCsId ? (
                <>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                      <TreeDeciduous className="h-4 w-4 text-emerald-300" />
                      Curriculum tree
                    </h4>
                    {nodesLoading ? (
                      <div className="flex items-center gap-2 py-6 text-sm text-white/45">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading nodes…
                      </div>
                    ) : nodes.length === 0 ? (
                      <p className="py-4 text-sm text-white/45">
                        No nodes yet. Add a strand or topic below.
                      </p>
                    ) : (
                      renderNodeTree(null, 0)
                    )}
                  </div>

                  <form
                    onSubmit={handleAddNode}
                    className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <h4 className="text-sm font-semibold text-white">Add node</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-white/45">Kind</Label>
                        <PremiumSelect
                          value={nodeKind}
                          onValueChange={(v) => setNodeKind(v as AdminCurriculumNodeRow["kind"])}
                        >
                          <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white">
                            <PremiumSelectValue />
                          </PremiumSelectTrigger>
                          <PremiumSelectContent>
                            {(Object.keys(KIND_LABELS) as AdminCurriculumNodeRow["kind"][]).map(
                              (k) => (
                                <PremiumSelectItem key={k} value={k}>
                                  {KIND_LABELS[k]}
                                </PremiumSelectItem>
                              )
                            )}
                          </PremiumSelectContent>
                        </PremiumSelect>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-white/45">
                          Under (parent)
                        </Label>
                        <PremiumSelect value={nodeParentId} onValueChange={setNodeParentId}>
                          <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white">
                            <PremiumSelectValue />
                          </PremiumSelectTrigger>
                          <PremiumSelectContent>
                            <PremiumSelectItem value="root">Top level</PremiumSelectItem>
                            {nodes.map((n) => (
                              <PremiumSelectItem key={n.id} value={n.id}>
                                {KIND_LABELS[n.kind]}: {n.title}
                              </PremiumSelectItem>
                            ))}
                          </PremiumSelectContent>
                        </PremiumSelect>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-xs uppercase tracking-wide text-white/45">Title</Label>
                        <Input
                          value={nodeTitle}
                          onChange={(e) => setNodeTitle(e.target.value)}
                          placeholder="e.g. Forces and motion"
                          className="border-white/10 bg-white/5 text-white placeholder:text-white/35"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-white/45">
                          Code (optional)
                        </Label>
                        <Input
                          value={nodeCode}
                          onChange={(e) => setNodeCode(e.target.value)}
                          className="border-white/10 bg-white/5 text-white placeholder:text-white/35"
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="gap-2 bg-indigo-500/25 text-indigo-100 ring-1 ring-indigo-400/40 hover:bg-indigo-500/35"
                      disabled={!nodeTitle.trim() || createNode.isPending || !activeCsId}
                    >
                      {createNode.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      Add node
                    </Button>
                  </form>
                </>
              ) : null}
            </>
          )}
        </div>
      );
    }

    if (currentStep === "review") {
      return (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className={cn(glassPanel, "p-4")}>
              <PanelChrome />
              <div className="relative z-10">
                <p className="text-xs uppercase tracking-wide text-white/45">Framework</p>
                <p className="mt-1 text-lg font-semibold text-white">{title}</p>
                <p className="mt-1 font-mono text-sm text-cyan-100/90">{code}</p>
              </div>
            </div>
            <div className={cn(glassPanel, "p-4")}>
              <PanelChrome />
              <div className="relative z-10">
                <p className="text-xs uppercase tracking-wide text-white/45">Subject rows</p>
                <p className="mt-1 text-3xl font-semibold text-white">{curriculumSubjects.length}</p>
                <p className="mt-1 text-sm text-white/45">Mapped into this framework</p>
              </div>
            </div>
          </div>
          <div className={cn(glassPanel, "p-4")}>
            <PanelChrome />
            <div className="relative z-10 space-y-2">
              <p className="text-xs uppercase tracking-wide text-white/45">Programme</p>
              <p className="text-sm text-white/80">
                {schoolCurriculumCode
                  ? curriculumProgrammeLabel(schoolCurriculumCode as CurriculumCode) ||
                    schoolCurriculumCode
                  : "Not linked to a specific programme"}
              </p>
              <p className="text-xs text-white/45">
                Set status to active from the library when teachers should use this framework.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-400/10">
            <BookMarked className="h-5 w-5 text-cyan-200" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-white/45">Framework builder</p>
            <h2 className="text-lg font-semibold text-white">{curriculum.title}</h2>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          asChild
          className="border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
        >
          <Link href="/admin/curricula">Back to library</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {STEPS.map((step, index) => {
          const isCompleted = completedSteps.has(step.id);
          const isCurrent = currentStep === step.id;
          const isPast = index < currentStepIndex;

          return (
            <React.Fragment key={step.id}>
              {index > 0 && (
                <div
                  className={cn(
                    "h-px w-6 transition-colors sm:w-8",
                    isPast || isCompleted ? "bg-emerald-500" : "bg-white/10"
                  )}
                />
              )}
              <button
                type="button"
                onClick={() => goToStep(step.id)}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                  isCurrent
                    ? "bg-indigo-500/30 text-indigo-200 ring-1 ring-indigo-400/50"
                    : isCompleted || isPast
                      ? "bg-emerald-500/20 text-emerald-200"
                      : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                )}
              >
                {isCompleted ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[10px]">
                    {index + 1}
                  </span>
                )}
                <span className="hidden sm:inline">{step.label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardContent className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {currentStepIndex > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
              className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/admin/curricula")}
              className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            >
              Cancel
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {currentStep === "review" ? (
            <Button
              type="button"
              onClick={() => router.push("/admin/curricula")}
              className="bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
            >
              <Layers3 className="mr-1 h-4 w-4" />
              Done
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => void goNext()}
              disabled={!canProceed || patch.isPending}
              className="bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30 disabled:opacity-50"
            >
              {patch.isPending && currentStep === "overview" ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : null}
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {!canProceed && currentValidation.message ? (
        <p className="text-center text-sm text-amber-400/80">{currentValidation.message}</p>
      ) : null}
    </div>
  );
}
