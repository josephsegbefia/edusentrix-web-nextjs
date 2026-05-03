"use client";

import * as React from "react";
import Link from "next/link";
import {
  Archive,
  BookOpen,
  CheckCircle2,
  FilePlus2,
  Hammer,
  Layers3,
  Loader2,
  RotateCcw,
  Sparkles,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import {
  CURRICULUM_PROFILES,
  type CurriculumCode,
} from "@/constants/curriculum-profiles";
import { curriculumProgrammeLabel } from "@/lib/curricula/programme-label";
import {
  useAdminCurricula,
  useAdminCurriculumCreate,
  useAdminCurriculumPatch,
  type AdminCurriculumRow,
} from "@/hooks/admin/useAdminCurricula";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const PROGRAMME_ENTRIES = Object.entries(CURRICULUM_PROFILES) as [
  CurriculumCode,
  (typeof CURRICULUM_PROFILES)["ghana_nacca"],
][];

const glassPanel =
  "relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/35 backdrop-blur-xl";

function PanelChrome({ corner = "top" }: { corner?: "top" | "bottom" }) {
  return (
    <>
      <div
        className={cn(
          "pointer-events-none absolute inset-0 via-transparent to-transparent",
          corner === "top"
            ? "bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-cyan-500/8"
            : "bg-[radial-gradient(ellipse_at_bottom_left,var(--tw-gradient-stops))] from-teal-500/8"
        )}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
        aria-hidden="true"
      />
    </>
  );
}

function programmeTableLabel(code: string | null | undefined): string {
  if (!code) return "Any programme";
  return curriculumProgrammeLabel(code) || "Any programme";
}

function statusTone(status: AdminCurriculumRow["status"]) {
  if (status === "active") {
    return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
  }
  if (status === "draft") {
    return "border-amber-300/25 bg-amber-400/10 text-amber-100";
  }
  return "border-white/15 bg-white/5 text-white/55";
}

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "cyan" | "emerald" | "amber";
}) {
  const tones = {
    cyan: "border-cyan-300/20 bg-cyan-400/10 text-cyan-200",
    emerald: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200",
    amber: "border-amber-300/20 bg-amber-400/10 text-amber-200",
  };

  return (
    <Card className={glassPanel}>
      <PanelChrome />
      <CardContent className="relative z-10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-white/45">
              {label}
            </p>
            <div className="mt-2 text-3xl font-semibold text-white">{value}</div>
          </div>
          <div className={cn("rounded-xl border p-2", tones[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-3 text-sm leading-5 text-white/50">{helper}</p>
      </CardContent>
    </Card>
  );
}

export default function AdminCurriculaPage() {
  const { data, isLoading, error } = useAdminCurricula();
  const create = useAdminCurriculumCreate();
  const patch = useAdminCurriculumPatch();

  const [title, setTitle] = React.useState("");
  const [code, setCode] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [schoolCurriculumCode, setSchoolCurriculumCode] = React.useState("");

  const rows = React.useMemo(() => data ?? [], [data]);
  const activeCount = rows.filter((row) => row.status === "active").length;
  const draftCount = rows.filter((row) => row.status === "draft").length;
  const linkedCount = rows.filter((row) => row.schoolCurriculumCode).length;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !code.trim()) return;

    try {
      await create.mutateAsync({
        title: title.trim(),
        code: code.trim(),
        description: description.trim() || undefined,
        schoolCurriculumCode: schoolCurriculumCode || null,
      });
      toast.success("Framework draft created");
      setTitle("");
      setCode("");
      setDescription("");
      setSchoolCurriculumCode("");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not create framework"
      );
    }
  }

  async function updateStatus(
    row: AdminCurriculumRow,
    status: AdminCurriculumRow["status"]
  ) {
    try {
      await patch.mutateAsync({ id: row.id, body: { status } });
      toast.success(`Framework ${status === "active" ? "activated" : status}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not update framework"
      );
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-slate-900/95 via-slate-950 to-black p-5 shadow-2xl shadow-black/40 sm:p-8">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-teal-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 shadow-lg shadow-cyan-500/10">
              <Workflow className="h-6 w-6 text-cyan-200" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-white/55">Curriculum operations</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Curriculum Frameworks
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
                Structured subjects, strands, and nodes for schemes of work and
                Leo. This is separate from the school&apos;s{" "}
                <Link
                  href="/admin/settings/curriculum"
                  className="font-medium text-cyan-200 hover:text-cyan-100"
                >
                  programme settings
                </Link>
                .
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="w-fit border-white/15 bg-white/5 px-3 py-1.5 text-white/70"
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5 text-cyan-200" />
            Teacher schemes source
          </Badge>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Frameworks"
          value={isLoading ? "..." : rows.length}
          helper="Total curriculum structures available to the school."
          icon={Layers3}
          tone="cyan"
        />
        <StatCard
          label="Active"
          value={isLoading ? "..." : activeCount}
          helper="Visible to teachers for lesson and scheme alignment."
          icon={CheckCircle2}
          tone="emerald"
        />
        <StatCard
          label="Drafts"
          value={isLoading ? "..." : draftCount}
          helper={`${linkedCount} framework${linkedCount === 1 ? "" : "s"} linked to a programme.`}
          icon={FilePlus2}
          tone="amber"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <Card className={glassPanel}>
          <PanelChrome />
          <CardHeader className="relative z-10 border-b border-white/5">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
              <BookOpen className="h-5 w-5 text-cyan-200" />
              New Framework
            </CardTitle>
            <p className="text-sm leading-5 text-white/50">
              Create a draft, then open the builder to add subjects, strands, and
              nodes in a guided flow.
            </p>
          </CardHeader>
          <CardContent className="relative z-10 p-4 sm:p-6">
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-white/45">
                  Title
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="border-white/10 bg-white/5 text-white placeholder:text-white/35 focus-visible:border-cyan-400 focus-visible:ring-cyan-400/30"
                  placeholder="e.g. NaCCA JHS Science outline"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-white/45">
                  Code
                </Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  className="border-white/10 bg-white/5 text-white placeholder:text-white/35 focus-visible:border-cyan-400 focus-visible:ring-cyan-400/30"
                  placeholder="unique short code"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-white/45">
                  Match school programme
                </Label>
                <PremiumSelect
                  value={schoolCurriculumCode || "any"}
                  onValueChange={(value) =>
                    setSchoolCurriculumCode(value === "any" ? "" : value)
                  }
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
                <p className="text-xs leading-5 text-white/45">
                  Linked frameworks are prioritised for teachers whose school
                  uses that programme.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-white/45">
                  Description
                </Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="resize-none border-white/10 bg-white/5 text-white placeholder:text-white/35 focus-visible:border-cyan-400 focus-visible:ring-cyan-400/30"
                  placeholder="What grades, subjects, or strands does this framework cover?"
                />
              </div>

              <Button
                type="submit"
                disabled={create.isPending}
                className="w-full gap-2 bg-linear-to-r from-cyan-500 to-teal-600 text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-600 hover:to-teal-700"
              >
                {create.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FilePlus2 className="h-4 w-4" />
                )}
                Create draft framework
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className={glassPanel}>
          <PanelChrome corner="bottom" />
          <CardHeader className="relative z-10 border-b border-white/5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
                  <Layers3 className="h-5 w-5 text-cyan-200" />
                  Framework Library
                </CardTitle>
                <p className="mt-1 text-sm text-white/50">
                  Activate frameworks when teachers should be able to use them.
                </p>
              </div>
              <Badge
                variant="outline"
                className="w-fit border-white/10 bg-white/5 text-white/60"
              >
                {rows.length} total
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="relative z-10 p-0">
            {error ? (
              <div className="m-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-100">
                {error.message}
              </div>
            ) : null}

            {isLoading ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-white/55">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-200" />
                <p className="text-sm">Loading frameworks...</p>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <Layers3 className="h-7 w-7 text-white/35" />
                </div>
                <div>
                  <p className="font-medium text-white">No frameworks yet</p>
                  <p className="mt-1 text-sm text-white/50">
                    Create a draft framework to start building curriculum
                    structures for schemes of work.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 bg-white/5 hover:bg-white/5">
                      <TableHead className="text-white/55">Framework</TableHead>
                      <TableHead className="text-white/55">Code</TableHead>
                      <TableHead className="text-white/55">Programme</TableHead>
                      <TableHead className="text-white/55">Status</TableHead>
                      <TableHead className="text-white/55">Updated</TableHead>
                      <TableHead className="text-right text-white/55">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow
                        key={row.id}
                        className="border-white/5 transition-colors hover:bg-white/[0.03]"
                      >
                        <TableCell className="min-w-[260px]">
                          <div>
                            <p className="font-medium text-white">{row.title}</p>
                            {row.description ? (
                              <p className="mt-1 line-clamp-2 max-w-md text-xs leading-5 text-white/45">
                                {row.description}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-white/70">
                          <code className="rounded-md border border-white/10 bg-black/25 px-2 py-1 text-xs text-cyan-100">
                            {row.code}
                          </code>
                        </TableCell>
                        <TableCell className="min-w-[180px] text-white/65">
                          {programmeTableLabel(row.schoolCurriculumCode)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn("capitalize", statusTone(row.status))}
                          >
                            {row.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-white/55">
                          {new Date(row.updatedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              asChild
                              className="gap-1.5 border-cyan-300/25 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"
                            >
                              <Link href={`/admin/curricula/${row.id}`}>
                                <Hammer className="h-3.5 w-3.5" />
                                Build
                              </Link>
                            </Button>
                            {row.status === "draft" ? (
                              <Button
                                type="button"
                                size="sm"
                                disabled={patch.isPending}
                                onClick={() => void updateStatus(row, "active")}
                                className="gap-1.5 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Activate
                              </Button>
                            ) : null}
                            {row.status === "active" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={patch.isPending}
                                onClick={() => void updateStatus(row, "archived")}
                                className="gap-1.5 border-amber-300/25 bg-amber-400/10 text-amber-100 hover:bg-amber-400/15"
                              >
                                <Archive className="h-3.5 w-3.5" />
                                Archive
                              </Button>
                            ) : null}
                            {row.status === "archived" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={patch.isPending}
                                onClick={() => void updateStatus(row, "draft")}
                                className="gap-1.5 border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Restore
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
