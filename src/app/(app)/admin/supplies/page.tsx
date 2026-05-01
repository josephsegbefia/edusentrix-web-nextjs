"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  BookOpen,
  Boxes,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Layers3,
  Loader2,
  Plus,
  School,
  Sparkles,
  Store,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
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
import { formatMoney } from "@/lib/fees/money";
import { SupplyProgramWizard } from "@/components/admin/supply-programs/SupplyProgramWizard";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { cn } from "@/lib/utils";

type ProgramRow = {
  id: string;
  name: string;
  periodLabel: string;
  status: string;
  audienceMode: string;
  updatedAt: string | null;
};

type LineRow = {
  id: string;
  storeProductId: string;
  productName: string;
  productPriceMinor: number;
  imageUrl: string | null;
  subjectId: string | null;
  subjectName: string | null;
  required: boolean;
  quantity: number;
  sortOrder: number;
  notes: string;
};

type FormOptions = {
  grades: { id: string; name: string }[];
  classGroups: { id: string; name: string; gradeId: string }[];
  subjects: { id: string; name: string }[];
  products: { id: string; name: string; priceMinor: number; isActive: boolean }[];
};

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
  tone: "cyan" | "emerald" | "amber" | "violet";
}) {
  const tones = {
    cyan: "border-cyan-300/20 bg-cyan-400/10 text-cyan-200",
    emerald: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200",
    amber: "border-amber-300/20 bg-amber-400/10 text-amber-200",
    violet: "border-violet-300/20 bg-violet-400/10 text-violet-200",
  };

  return (
    <Card className={glassPanel}>
      <PanelChrome />
      <CardContent className="relative z-10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-white/45">{label}</p>
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

function statusTone(status: string) {
  if (status === "published") return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
  if (status === "draft") return "border-amber-300/25 bg-amber-400/10 text-amber-100";
  if (status === "archived") return "border-white/15 bg-white/5 text-white/55";
  return "border-cyan-300/20 bg-cyan-400/10 text-cyan-100";
}

function audienceLabel(value: string) {
  return value.replaceAll("_", " ");
}

export default function AdminSupplyProgramsPage() {
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [programs, setPrograms] = React.useState<ProgramRow[]>([]);
  const [options, setOptions] = React.useState<FormOptions | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [lines, setLines] = React.useState<LineRow[]>([]);
  const [linesLoading, setLinesLoading] = React.useState(false);
  const [showWizard, setShowWizard] = React.useState(false);

  const [newLineProductId, setNewLineProductId] = React.useState("");
  const [newLineSubjectId, setNewLineSubjectId] = React.useState<string>("");
  const [newLineQty, setNewLineQty] = React.useState("1");
  const [newLineRequired, setNewLineRequired] = React.useState(true);

  const loadPrograms = React.useCallback(async () => {
    const res = await fetch("/api/admin/supply-programs", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (json?.success && Array.isArray(json.data)) setPrograms(json.data);
  }, []);

  const loadOptions = React.useCallback(async () => {
    const res = await fetch("/api/admin/supply-programs/form-options", {
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    if (json?.success && json.data) setOptions(json.data);
  }, []);

  const loadLines = React.useCallback(async (programId: string) => {
    setLinesLoading(true);
    try {
      const res = await fetch(`/api/admin/supply-programs/${programId}/lines`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (json?.success && Array.isArray(json.data)) setLines(json.data);
    } finally {
      setLinesLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadPrograms(), loadOptions()]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPrograms, loadOptions]);

  React.useEffect(() => {
    if (selectedId) void loadLines(selectedId);
    else setLines([]);
  }, [selectedId, loadLines]);

  function handleWizardComplete(programId: string) {
    setShowWizard(false);
    void loadPrograms();
    setSelectedId(programId);
    toast.success("Add products below, then publish when ready.");
  }

  async function publishProgram(p: ProgramRow) {
    try {
      const res = await fetch(`/api/admin/supply-programs/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed");
      toast.success("Published");
      await loadPrograms();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function archiveProgram(p: ProgramRow) {
    try {
      const res = await fetch(`/api/admin/supply-programs/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed");
      toast.success("Archived");
      await loadPrograms();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function deleteProgram(p: ProgramRow) {
    const decision = await confirm({
      title: "Delete supply program?",
      description: `Delete "${p.name}" and remove it from this setup? This cannot be undone.`,
      confirmLabel: "Delete program",
      intent: "destructive",
    });
    if (decision !== "confirm") return;
    try {
      const res = await fetch(`/api/admin/supply-programs/${p.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed");
      toast.success("Deleted");
      if (selectedId === p.id) setSelectedId(null);
      await loadPrograms();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function addLine(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !newLineProductId) {
      toast.error("Select a product");
      return;
    }
    const qty = Number.parseInt(newLineQty, 10);
    if (!Number.isFinite(qty) || qty < 1) {
      toast.error("Invalid quantity");
      return;
    }
    try {
      const res = await fetch(`/api/admin/supply-programs/${selectedId}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeProductId: newLineProductId,
          subjectId: newLineSubjectId || null,
          quantity: qty,
          required: newLineRequired,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed");
      toast.success("Line added");
      await loadLines(selectedId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function deleteLine(line: LineRow) {
    if (!selectedId) return;
    const decision = await confirm({
      title: "Remove supply line?",
      description: `Remove "${line.productName}" from this supply program.`,
      confirmLabel: "Remove line",
      intent: "destructive",
    });
    if (decision !== "confirm") return;
    try {
      const res = await fetch(
        `/api/admin/supply-programs/${selectedId}/lines/${line.id}`,
        { method: "DELETE" }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed");
      await loadLines(selectedId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  if (loading || !options) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-2xl border border-white/10 bg-slate-950/80 text-white/60">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          Loading supply programs…
        </div>
      </div>
    );
  }

  const selectedProgram = programs.find((program) => program.id === selectedId) ?? null;
  const publishedPrograms = programs.filter((program) => program.status === "published").length;
  const draftPrograms = programs.filter((program) => program.status === "draft").length;
  const selectedLinesValueMinor = lines.reduce(
    (sum, line) => sum + line.productPriceMinor * line.quantity,
    0
  );
  const requiredLines = lines.filter((line) => line.required).length;

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
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 shadow-lg shadow-cyan-500/10">
              <ClipboardList className="h-6 w-6 text-cyan-200" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-white/55">Store programs</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Supply programs
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
                Build targeted supply lists by grade, class, or student, then connect each
                requirement to store products and parent checkout.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => setShowWizard(true)}
              className="bg-linear-to-r from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/25 hover:from-teal-600 hover:to-cyan-700"
            >
              <Wand2 className="mr-2 h-4 w-4" />
              New program wizard
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-white/15 bg-white/5 text-white/80 hover:border-white/25 hover:bg-white/10 hover:text-white"
            >
              <Link href="/admin/store">
                <Store className="mr-2 h-4 w-4" />
                School store
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Programs"
          value={programs.length}
          helper="Supply list campaigns across all periods."
          icon={Layers3}
          tone="cyan"
        />
        <StatCard
          label="Published"
          value={publishedPrograms}
          helper="Visible and ready for parent action."
          icon={BadgeCheck}
          tone="emerald"
        />
        <StatCard
          label="Drafts"
          value={draftPrograms}
          helper="Programs still being prepared."
          icon={Wand2}
          tone="amber"
        />
        <StatCard
          label="Products"
          value={options.products.length}
          helper="Store products available for mapping."
          icon={Boxes}
          tone="violet"
        />
      </div>

      {showWizard ? (
        <div className={glassPanel}>
          <PanelChrome />
          <div className="relative z-10 p-4 sm:p-5">
            <SupplyProgramWizard
              options={{
                grades: options.grades,
                classGroups: options.classGroups,
              }}
              onComplete={handleWizardComplete}
              onCancel={() => setShowWizard(false)}
            />
          </div>
        </div>
      ) : null}

      <Card className={glassPanel}>
        <PanelChrome corner="bottom" />
        <CardHeader className="relative z-10 border-b border-white/5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base text-white">Programs</CardTitle>
              <p className="mt-1 text-sm text-white/50">
                Select a program to manage its product requirements.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit border-white/15 bg-white/5 text-white/80 hover:border-white/25 hover:bg-white/10"
              onClick={() => setShowWizard(true)}
            >
              <Wand2 className="mr-2 h-4 w-4" />
              New program
            </Button>
          </div>
        </CardHeader>
        <CardContent className="relative z-10 p-5">
          {programs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center">
              <ClipboardList className="mx-auto h-9 w-9 text-white/30" />
              <p className="mt-3 font-semibold text-white">No programs yet</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-white/50">
                Use the wizard to create a targeted supply program draft.
              </p>
            </div>
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {programs.map((p) => (
                <li
                  key={p.id}
                  className={cn(
                    "rounded-xl border bg-black/25 p-4 transition-colors",
                    selectedId === p.id
                      ? "border-cyan-300/35 bg-cyan-400/10"
                      : "border-white/10 hover:border-cyan-400/25 hover:bg-black/35"
                  )}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <button
                        type="button"
                        className="flex min-w-0 items-center gap-2 text-left font-medium text-white hover:text-cyan-200"
                        onClick={() =>
                          setSelectedId((cur) => (cur === p.id ? null : p.id))
                        }
                      >
                        <span className="truncate">{p.name}</span>
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 shrink-0 text-white/35 transition-transform",
                            selectedId === p.id && "rotate-90 text-cyan-200"
                          )}
                        />
                      </button>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="outline" className={cn("border capitalize", statusTone(p.status))}>
                          {p.status}
                        </Badge>
                        <Badge variant="outline" className="border-white/15 bg-white/5 capitalize text-white/65">
                          <School className="mr-1.5 h-3.5 w-3.5 text-white/45" />
                          {audienceLabel(p.audienceMode)}
                        </Badge>
                        <Badge variant="outline" className="border-white/15 bg-white/5 text-white/65">
                          {p.periodLabel || "No period"}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                        {p.status === "draft" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-emerald-500/30 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/15"
                            onClick={() => void publishProgram(p)}
                          >
                            Publish
                          </Button>
                        ) : null}
                        {p.status === "published" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                            onClick={() => void archiveProgram(p)}
                          >
                            Archive
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-red-300 hover:bg-red-400/10 hover:text-red-200"
                          onClick={() => void deleteProgram(p)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {selectedId ? (
        <Card className={glassPanel}>
          <PanelChrome />
          <CardHeader className="relative z-10 border-b border-white/5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <Boxes className="h-4 w-4 text-cyan-200" />
                  Lines & products
                </CardTitle>
                <p className="mt-1 text-sm text-white/50">
                  {selectedProgram
                    ? `Managing ${selectedProgram.name}.`
                    : "Map each requirement to a store product."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-cyan-300/20 bg-cyan-400/10 text-cyan-100">
                  {lines.length} lines
                </Badge>
                <Badge variant="outline" className="border-emerald-300/20 bg-emerald-400/10 text-emerald-100">
                  {requiredLines} required
                </Badge>
                <Badge variant="outline" className="border-violet-300/20 bg-violet-400/10 text-violet-100">
                  {formatMoney(selectedLinesValueMinor)}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative z-10 space-y-6 p-5">
            <form
              onSubmit={addLine}
              className="grid gap-4 rounded-xl border border-white/10 bg-black/25 p-4 md:grid-cols-2 lg:grid-cols-4"
            >
              <div className="space-y-2 md:col-span-2">
                <Label className="text-white/80">Store product</Label>
                <PremiumSelect
                  value={newLineProductId || undefined}
                  onValueChange={(v) => setNewLineProductId(v)}
                >
                  <PremiumSelectTrigger className="w-full border-white/10 bg-black/30 text-white">
                    <PremiumSelectValue placeholder="Select product" />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    {(options?.products || []).map((pr) => (
                      <PremiumSelectItem
                        key={pr.id}
                        value={pr.id}
                        description={formatMoney(pr.priceMinor)}
                      >
                        {pr.name}
                        {!pr.isActive ? " (inactive)" : ""}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Subject (optional)</Label>
                <PremiumSelect
                  value={newLineSubjectId || "__none__"}
                  onValueChange={(v) => setNewLineSubjectId(v === "__none__" ? "" : v)}
                >
                  <PremiumSelectTrigger className="w-full border-white/10 bg-black/30 text-white">
                    <PremiumSelectValue placeholder="None" />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    <PremiumSelectItem value="__none__">None</PremiumSelectItem>
                    {(options?.subjects || []).map((s) => (
                      <PremiumSelectItem key={s.id} value={s.id}>
                        {s.name}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Qty / student</Label>
                <Input
                  value={newLineQty}
                  onChange={(e) => setNewLineQty(e.target.value)}
                  className="border-white/10 bg-black/30 text-white"
                  inputMode="numeric"
                />
              </div>
              <div className="flex items-end gap-2 md:col-span-2 lg:col-span-4">
                <label className="flex items-center gap-2 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={newLineRequired}
                    onChange={(e) => setNewLineRequired(e.target.checked)}
                    className="rounded border-white/20"
                  />
                  Required
                </label>
                <Button
                  type="submit"
                  className="bg-linear-to-r from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/25 hover:from-teal-600 hover:to-cyan-700"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add line
                </Button>
              </div>
            </form>

            {linesLoading ? (
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/50">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading lines…
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-white/70">Product</TableHead>
                    <TableHead className="text-white/70">Subject</TableHead>
                    <TableHead className="text-white/70">Qty</TableHead>
                    <TableHead className="text-white/70">Req</TableHead>
                    <TableHead className="text-white/70">Price</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 ? (
                    <TableRow className="border-white/10">
                      <TableCell colSpan={6} className="py-8 text-center text-white/50">
                        No lines yet. Add a product requirement above.
                      </TableCell>
                    </TableRow>
                  ) : (
                    lines.map((ln) => (
                      <TableRow key={ln.id} className="border-white/10">
                        <TableCell className="text-white">
                          <div className="flex items-center gap-3">
                            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/5">
                              {ln.imageUrl ? (
                                <Image
                                  src={ln.imageUrl}
                                  alt=""
                                  fill
                                  sizes="44px"
                                  className="object-cover"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center">
                                  <BookOpen className="h-4 w-4 text-white/25" />
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="font-medium">{ln.productName}</div>
                              {ln.notes ? (
                                <div className="text-xs text-white/50">{ln.notes}</div>
                              ) : null}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-white/70 text-sm">
                          {ln.subjectName || "—"}
                        </TableCell>
                        <TableCell className="text-white/80">{ln.quantity}</TableCell>
                        <TableCell className="text-white/80">
                          {ln.required ? (
                            <Badge variant="outline" className="border-emerald-300/20 bg-emerald-400/10 text-emerald-100">
                              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                              Yes
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-white/15 bg-white/5 text-white/55">
                              Optional
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-semibold text-cyan-200">
                          {formatMoney(ln.productPriceMinor)}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="text-red-300 hover:bg-red-400/10 hover:text-red-200"
                            onClick={() => void deleteLine(ln)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}
      {confirmationDialog}
    </div>
  );
}
