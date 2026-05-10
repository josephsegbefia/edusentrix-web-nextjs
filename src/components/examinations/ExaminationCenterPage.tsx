"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpenCheck,
  Brain,
  ClipboardList,
  FileQuestion,
  LibraryBig,
  Plus,
  Printer,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ExamPaperRow = {
  id: string;
  title: string;
  status: string;
  scope: "class_group" | "grade_wide";
  totalMarks: number;
  durationMinutes?: number | null;
  updatedAt?: string | null;
};

type QuestionBankRow = {
  id: string;
  prompt: string;
  type: string;
  marks: number;
  status: string;
  topic?: string | null;
  usedCount: number;
};

type Props = {
  role: "admin" | "teacher";
};

type SetupOption = {
  id: string;
  name?: string;
  label?: string;
  academicYearId?: string;
  isCurrent?: boolean;
  gradeId?: string;
  subjectIds?: string[];
};

type SetupOptions = {
  periods: SetupOption[];
  examTypes: SetupOption[];
  grades: SetupOption[];
  classGroups: SetupOption[];
  subjects: SetupOption[];
};

type CreatePaperState = {
  title: string;
  examTypeId: string;
  academicPeriodId: string;
  gradeId: string;
  scope: "class_group" | "grade_wide";
  classGroupIds: string[];
  subjectId: string;
  totalMarks: string;
  durationMinutes: string;
  candidateInstructions: string;
};

function statusTone(status: string) {
  if (status === "approved" || status === "curated") return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
  if (status === "submitted") return "border-sky-400/25 bg-sky-400/10 text-sky-100";
  if (status === "needs_revision") return "border-amber-400/25 bg-amber-400/10 text-amber-100";
  if (status === "archived") return "border-white/10 bg-white/5 text-white/50";
  return "border-white/10 bg-white/8 text-white/70";
}

function formatDate(value?: string | null) {
  if (!value) return "Recently updated";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently updated";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function labelFor(option: SetupOption) {
  return option.name ?? option.label ?? option.id;
}

function CreateExamPaperDialog({ role }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [state, setState] = React.useState<CreatePaperState>({
    title: "",
    examTypeId: "",
    academicPeriodId: "",
    gradeId: "",
    scope: "class_group",
    classGroupIds: [],
    subjectId: "",
    totalMarks: "100",
    durationMinutes: "120",
    candidateInstructions: "Answer all questions in the answer booklet provided.",
  });

  const optionsQuery = useQuery({
    queryKey: ["examination-setup-options", role],
    queryFn: async () => {
      const res = await fetch("/api/examinations/setup-options", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as { success?: boolean; data?: SetupOptions; error?: string } | null;
      if (!res.ok || !json?.success || !json.data) throw new Error(json?.error ?? "Failed to load setup options");
      return json.data;
    },
    enabled: open,
    staleTime: 60_000,
  });

  const options = optionsQuery.data;

  React.useEffect(() => {
    if (!open || !options) return;
    setState((prev) => ({
      ...prev,
      examTypeId: prev.examTypeId || options.examTypes[0]?.id || "",
      academicPeriodId:
        prev.academicPeriodId ||
        options.periods.find((period) => period.isCurrent)?.id ||
        options.periods[0]?.id ||
        "",
      gradeId: prev.gradeId || options.grades[0]?.id || "",
    }));
  }, [open, options]);

  const gradeClassGroups = React.useMemo(
    () => (options?.classGroups ?? []).filter((group) => group.gradeId === state.gradeId),
    [options?.classGroups, state.gradeId]
  );

  const availableSubjects = React.useMemo(() => {
    if (!options) return [];
    const selectedGroups = gradeClassGroups.filter((group) =>
      state.classGroupIds.includes(group.id)
    );
    if (role === "teacher" || selectedGroups.length > 0) {
      const subjectIds = new Set(selectedGroups.flatMap((group) => group.subjectIds ?? []));
      const filtered = options.subjects.filter((subject) => subjectIds.has(subject.id));
      if (filtered.length > 0) return filtered;
    }
    return options.subjects;
  }, [gradeClassGroups, options, role, state.classGroupIds]);

  React.useEffect(() => {
    if (!open) return;
    if (state.scope === "grade_wide" && state.gradeId && state.classGroupIds.length === 0) {
      setState((prev) => ({ ...prev, classGroupIds: gradeClassGroups.map((group) => group.id) }));
      return;
    }
    if (state.scope === "class_group" && state.classGroupIds.length > 1) {
      setState((prev) => ({ ...prev, classGroupIds: [prev.classGroupIds[0]] }));
    }
  }, [gradeClassGroups, open, state.classGroupIds.length, state.gradeId, state.scope]);

  React.useEffect(() => {
    if (!open || !availableSubjects.length) return;
    if (!state.subjectId || !availableSubjects.some((subject) => subject.id === state.subjectId)) {
      setState((prev) => ({ ...prev, subjectId: availableSubjects[0]?.id ?? "" }));
    }
  }, [availableSubjects, open, state.subjectId]);

  const createMutation = useMutation({
    mutationFn: async () => {
      setError(null);
      const selectedPeriod = options?.periods.find((period) => period.id === state.academicPeriodId);
      const classGroupIds = state.classGroupIds.filter(Boolean);
      if (!state.title.trim()) throw new Error("Enter a paper title.");
      if (!state.examTypeId) throw new Error("Choose an exam type.");
      if (!state.academicPeriodId) throw new Error("Choose an academic period.");
      if (!state.gradeId) throw new Error("Choose a grade.");
      if (!state.subjectId) throw new Error("Choose a subject.");
      if (classGroupIds.length === 0) throw new Error("Choose at least one class group.");

      const res = await fetch(role === "admin" ? "/api/admin/examinations" : "/api/teacher/examinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: state.title.trim(),
          examTypeId: state.examTypeId,
          academicYearId: selectedPeriod?.academicYearId ?? state.academicPeriodId,
          academicPeriodId: state.academicPeriodId,
          termId: null,
          scope: state.scope,
          gradeId: state.gradeId,
          classGroupId: state.scope === "class_group" ? classGroupIds[0] : null,
          classGroupIds,
          subjectId: state.subjectId,
          totalMarks: Number(state.totalMarks) || 0,
          durationMinutes: state.durationMinutes ? Number(state.durationMinutes) : null,
          candidateInstructions: state.candidateInstructions.trim() || null,
          sourceMode: "manual",
        }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; data?: ExamPaperRow; error?: string } | null;
      if (!res.ok || !json?.success || !json.data) throw new Error(json?.error ?? "Failed to create exam paper");
      return json.data;
    },
    onSuccess: (paper) => {
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["examination-papers", role] });
      router.push(`${role === "admin" ? "/admin" : "/teacher"}/examinations/${paper.id}`);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to create exam paper");
    },
  });

  const toggleClassGroup = (classGroupId: string) => {
    setState((prev) => {
      if (prev.scope === "class_group") return { ...prev, classGroupIds: [classGroupId] };
      const selected = new Set(prev.classGroupIds);
      if (selected.has(classGroupId)) selected.delete(classGroupId);
      else selected.add(classGroupId);
      return { ...prev, classGroupIds: Array.from(selected) };
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-cyan-400 text-slate-950 hover:bg-cyan-300">
          <Plus className="h-4 w-4" />
          New paper
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-white/10 bg-slate-950 text-white sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create exam paper</DialogTitle>
          <DialogDescription className="text-white/55">
            Tie the paper to the correct period, grade, class group, subject, and exam type before adding questions.
          </DialogDescription>
        </DialogHeader>

        {optionsQuery.isLoading ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-white/55">
            Loading setup options...
          </div>
        ) : (
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              createMutation.mutate();
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/38">Paper title</span>
                <Input
                  value={state.title}
                  onChange={(event) => setState((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="e.g. Basic 7 English End of Term Exam"
                  className="border-white/10 bg-white/[0.04] text-white placeholder:text-white/35"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/38">Exam type</span>
                <Select value={state.examTypeId || undefined} onValueChange={(value) => setState((prev) => ({ ...prev, examTypeId: value }))}>
                  <SelectTrigger className="w-full border-white/10 bg-white/[0.04] text-white">
                    <SelectValue placeholder="Choose exam type" />
                  </SelectTrigger>
                  <SelectContent>
                    {(options?.examTypes ?? []).map((item) => (
                      <SelectItem key={item.id} value={item.id}>{labelFor(item)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/38">Academic period</span>
                <Select value={state.academicPeriodId || undefined} onValueChange={(value) => setState((prev) => ({ ...prev, academicPeriodId: value }))}>
                  <SelectTrigger className="w-full border-white/10 bg-white/[0.04] text-white">
                    <SelectValue placeholder="Choose period" />
                  </SelectTrigger>
                  <SelectContent>
                    {(options?.periods ?? []).map((item) => (
                      <SelectItem key={item.id} value={item.id}>{labelFor(item)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/38">Grade</span>
                <Select
                  value={state.gradeId || undefined}
                  onValueChange={(value) =>
                    setState((prev) => ({ ...prev, gradeId: value, classGroupIds: [], subjectId: "" }))
                  }
                >
                  <SelectTrigger className="w-full border-white/10 bg-white/[0.04] text-white">
                    <SelectValue placeholder="Choose grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {(options?.grades ?? []).map((item) => (
                      <SelectItem key={item.id} value={item.id}>{labelFor(item)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/38">Subject</span>
                <Select value={state.subjectId || undefined} onValueChange={(value) => setState((prev) => ({ ...prev, subjectId: value }))}>
                  <SelectTrigger className="w-full border-white/10 bg-white/[0.04] text-white">
                    <SelectValue placeholder="Choose subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubjects.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{labelFor(item)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-3 flex flex-wrap gap-2">
                {(["class_group", "grade_wide"] as const).map((scope) => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        scope,
                        classGroupIds: scope === "grade_wide" ? gradeClassGroups.map((group) => group.id) : [],
                        subjectId: "",
                      }))
                    }
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                      state.scope === scope
                        ? "border-cyan-300/35 bg-cyan-300/15 text-cyan-100"
                        : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10"
                    )}
                  >
                    {scope === "grade_wide" ? "Grade-wide paper" : "Single class group"}
                  </button>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {gradeClassGroups.map((group) => {
                  const checked = state.classGroupIds.includes(group.id);
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => toggleClassGroup(group.id)}
                      className={cn(
                        "flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition",
                        checked
                          ? "border-cyan-300/35 bg-cyan-300/12 text-white"
                          : "border-white/10 bg-white/[0.025] text-white/55 hover:bg-white/[0.055]"
                      )}
                    >
                      <span>{labelFor(group)}</span>
                      <span className={cn("h-2.5 w-2.5 rounded-full", checked ? "bg-cyan-300" : "bg-white/15")} />
                    </button>
                  );
                })}
                {state.gradeId && gradeClassGroups.length === 0 ? (
                  <p className="text-sm text-white/45">No class groups are available for this grade.</p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/38">Total marks</span>
                <Input
                  value={state.totalMarks}
                  onChange={(event) => setState((prev) => ({ ...prev, totalMarks: event.target.value }))}
                  inputMode="numeric"
                  className="border-white/10 bg-white/[0.04] text-white"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/38">Duration minutes</span>
                <Input
                  value={state.durationMinutes}
                  onChange={(event) => setState((prev) => ({ ...prev, durationMinutes: event.target.value }))}
                  inputMode="numeric"
                  className="border-white/10 bg-white/[0.04] text-white"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/38">Candidate instructions</span>
                <Textarea
                  value={state.candidateInstructions}
                  onChange={(event) => setState((prev) => ({ ...prev, candidateInstructions: event.target.value }))}
                  className="min-h-24 border-white/10 bg-white/[0.04] text-white placeholder:text-white/35"
                />
              </label>
            </div>

            {error || optionsQuery.isError ? (
              <p className="rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                {error || (optionsQuery.error instanceof Error ? optionsQuery.error.message : "Failed to load options")}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-white/10 bg-white/5 text-white hover:bg-white/10">
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">
                {createMutation.isPending ? "Creating..." : "Create paper"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ExaminationCenterPage({ role }: Props) {
  const [paperSearch, setPaperSearch] = React.useState("");
  const [bankSearch, setBankSearch] = React.useState("");
  const paperEndpoint = role === "admin" ? "/api/admin/examinations" : "/api/teacher/examinations";

  const papersQuery = useQuery({
    queryKey: ["examination-papers", role, paperSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "30" });
      if (paperSearch.trim()) params.set("q", paperSearch.trim());
      const res = await fetch(`${paperEndpoint}?${params.toString()}`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as { success?: boolean; data?: ExamPaperRow[] } | null;
      if (!res.ok || !json?.success) throw new Error("Failed to fetch exam papers");
      return json.data ?? [];
    },
    staleTime: 20_000,
  });

  const bankQuery = useQuery({
    queryKey: ["question-bank", bankSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "30" });
      if (bankSearch.trim()) params.set("q", bankSearch.trim());
      const res = await fetch(`/api/question-bank?${params.toString()}`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as { success?: boolean; data?: QuestionBankRow[] } | null;
      if (!res.ok || !json?.success) throw new Error("Failed to fetch question bank");
      return json.data ?? [];
    },
    staleTime: 20_000,
  });

  const papers = papersQuery.data ?? [];
  const bankItems = bankQuery.data ?? [];
  const basePath = role === "admin" ? "/admin" : "/teacher";

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-4 md:p-6">
      <section className="rounded-3xl border border-white/10 bg-linear-to-br from-slate-950 via-slate-900 to-black p-5 shadow-2xl shadow-black/35 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
              <BookOpenCheck className="h-3.5 w-3.5" />
              Examinations
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Exam papers and question bank
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/62">
              Set formal exam papers, review readiness, print question-only PDFs, and reuse
              school-owned questions without mixing them into classroom assignments.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CreateExamPaperDialog role={role} />
            <Link href={`${basePath}/question-bank`}>
              <Button variant="outline" className="gap-2 border-white/12 bg-white/5 text-white hover:bg-white/10">
                <LibraryBig className="h-4 w-4" />
                Question bank
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Papers", value: papers.length, icon: ClipboardList },
          { label: "Submitted", value: papers.filter((row) => row.status === "submitted").length, icon: FileQuestion },
          { label: "Approved", value: papers.filter((row) => row.status === "approved").length, icon: Printer },
          { label: "Bank items", value: bankItems.length, icon: LibraryBig },
        ].map((item) => (
          <Card key={item.label} className="border-white/10 bg-white/[0.03] text-white">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-white/42">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold">{item.value}</p>
              </div>
              <item.icon className="h-5 w-5 text-cyan-200" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="papers" className="space-y-4">
        <TabsList className="border border-white/10 bg-white/[0.04]">
          <TabsTrigger value="papers">Exam papers</TabsTrigger>
          <TabsTrigger value="bank">Question bank</TabsTrigger>
          <TabsTrigger value="leo">Leo assistant</TabsTrigger>
        </TabsList>

        <TabsContent value="papers" className="space-y-4">
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <Search className="h-4 w-4 text-white/40" />
            <Input
              value={paperSearch}
              onChange={(event) => setPaperSearch(event.target.value)}
              placeholder="Search papers"
              className="border-0 bg-transparent text-white placeholder:text-white/35 focus-visible:ring-0"
            />
          </div>
          <div className="grid gap-3">
            {papers.map((paper) => (
              <Link key={paper.id} href={`${basePath}/examinations/${paper.id}`} className="group">
                <Card className="border-white/10 bg-white/[0.035] text-white transition hover:border-cyan-300/35 hover:bg-white/[0.055]">
                  <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{paper.title}</h2>
                        <Badge className={cn("border", statusTone(paper.status))}>{paper.status.replace("_", " ")}</Badge>
                        <Badge variant="outline" className="border-white/10 text-white/55">
                          {paper.scope === "grade_wide" ? "Grade-wide" : "Class paper"}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-white/50">
                        {paper.totalMarks} marks
                        {paper.durationMinutes ? ` · ${paper.durationMinutes} minutes` : ""} · {formatDate(paper.updatedAt)}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
                      Open
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            ))}
            {!papersQuery.isLoading && papers.length === 0 ? (
              <Card className="border-white/10 bg-white/[0.03] text-white">
                <CardContent className="p-6 text-sm text-white/55">No exam papers yet.</CardContent>
              </Card>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="bank" className="space-y-4">
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <Search className="h-4 w-4 text-white/40" />
            <Input
              value={bankSearch}
              onChange={(event) => setBankSearch(event.target.value)}
              placeholder="Search question bank"
              className="border-0 bg-transparent text-white placeholder:text-white/35 focus-visible:ring-0"
            />
          </div>
          <div className="grid gap-3">
            {bankItems.map((item) => (
              <Card key={item.id} className="border-white/10 bg-white/[0.035] text-white">
                <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={cn("border", statusTone(item.status))}>{item.status}</Badge>
                      <Badge variant="outline" className="border-white/10 text-white/55">{item.type}</Badge>
                      <span className="text-xs text-white/40">{item.marks} marks · reused {item.usedCount}x</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-white/72">{item.prompt}</p>
                    {item.topic ? <p className="mt-1 text-xs text-white/40">{item.topic}</p> : null}
                  </div>
                </CardContent>
              </Card>
            ))}
            {!bankQuery.isLoading && bankItems.length === 0 ? (
              <Card className="border-white/10 bg-white/[0.03] text-white">
                <CardContent className="p-6 text-sm text-white/55">No question bank items yet.</CardContent>
              </Card>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="leo">
          <Card className="border-cyan-300/15 bg-cyan-300/[0.04] text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-cyan-200" />
                Leo for examinations
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-white/62 md:grid-cols-2">
              <p>Generate blueprints, draft questions, estimate difficulty, and check paper readiness.</p>
              <p>Leo never approves or prints papers automatically. Student PDFs remain question-only.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
