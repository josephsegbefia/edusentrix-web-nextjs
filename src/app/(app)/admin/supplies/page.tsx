"use client";

import * as React from "react";
import {
  ClipboardList,
  Loader2,
  Plus,
  Trash2,
  ChevronRight,
  BookOpen,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
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
import Link from "next/link";
import { SupplyProgramWizard } from "@/components/admin/supply-programs/SupplyProgramWizard";

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

export default function AdminSupplyProgramsPage() {
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
    if (!confirm(`Delete program "${p.name}"?`)) return;
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
    if (!confirm("Remove this line?")) return;
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
      <div className="flex min-h-[30vh] items-center justify-center gap-2 text-white/60">
        <Loader2 className="h-6 w-6 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-8 w-8 text-brand" />
          <div>
            <h1 className="text-2xl font-semibold text-white">Supply programs</h1>
            <p className="text-sm text-white/60">
              Target lists by grade, class, or student; link store products and subjects.
              Parents pay via the same Paystack checkout.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!showWizard ? (
            <Button
              type="button"
              onClick={() => setShowWizard(true)}
              className="bg-brand text-black hover:bg-brand/90"
            >
              <Wand2 className="mr-2 h-4 w-4" />
              New program wizard
            </Button>
          ) : null}
          <Button
            asChild
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
          >
            <Link href="/admin/store">
              <BookOpen className="mr-2 h-4 w-4" />
              School store
            </Link>
          </Button>
        </div>
      </div>

      {showWizard ? (
        <SupplyProgramWizard
          options={{
            grades: options.grades,
            classGroups: options.classGroups,
          }}
          onComplete={handleWizardComplete}
          onCancel={() => setShowWizard(false)}
        />
      ) : null}

      <Card className="border-white/10 bg-white/5">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-white text-base">Programs</CardTitle>
          {!showWizard ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-white/15 text-white/80 hover:bg-white/10"
              onClick={() => setShowWizard(true)}
            >
              <Wand2 className="mr-2 h-4 w-4" />
              New program
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-white/70">Name</TableHead>
                <TableHead className="text-white/70">Period</TableHead>
                <TableHead className="text-white/70">Audience</TableHead>
                <TableHead className="text-white/70">Status</TableHead>
                <TableHead className="text-white/70 w-[220px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {programs.length === 0 ? (
                <TableRow className="border-white/10">
                  <TableCell colSpan={5} className="text-white/50">
                    No programs yet. Use the wizard to create your first draft.
                  </TableCell>
                </TableRow>
              ) : (
                programs.map((p) => (
                  <TableRow key={p.id} className="border-white/10">
                    <TableCell className="text-white">
                      <button
                        type="button"
                        className="text-left font-medium hover:text-brand flex items-center gap-1"
                        onClick={() =>
                          setSelectedId((cur) => (cur === p.id ? null : p.id))
                        }
                      >
                        {p.name}
                        <ChevronRight
                          className={`h-4 w-4 transition-transform ${
                            selectedId === p.id ? "rotate-90 text-brand" : ""
                          }`}
                        />
                      </button>
                    </TableCell>
                    <TableCell className="text-white/70 text-sm">
                      {p.periodLabel || "—"}
                    </TableCell>
                    <TableCell className="text-white/70 text-sm capitalize">
                      {p.audienceMode.replace("_", " ")}
                    </TableCell>
                    <TableCell className="text-sm capitalize text-white/80">
                      {p.status}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {p.status === "draft" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-emerald-500/40 text-emerald-300"
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
                            className="border-white/20"
                            onClick={() => void archiveProgram(p)}
                          >
                            Archive
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-red-300"
                          onClick={() => void deleteProgram(p)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedId ? (
        <Card className="border-brand/30 bg-brand/5">
          <CardHeader>
            <CardTitle className="text-white text-base">Lines & products</CardTitle>
            <p className="text-sm text-white/60">
              Map each requirement to a store product. Add subject links for textbooks.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={addLine} className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2 md:col-span-2">
                <Label className="text-white/80">Store product</Label>
                <PremiumSelect
                  value={newLineProductId || undefined}
                  onValueChange={(v) => setNewLineProductId(v)}
                >
                  <PremiumSelectTrigger className="w-full bg-white/5 border-white/10 text-white">
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
                  <PremiumSelectTrigger className="w-full bg-white/5 border-white/10 text-white">
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
                  className="bg-white/5 border-white/10"
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
                <Button type="submit" className="bg-brand text-black hover:bg-brand/90">
                  <Plus className="mr-2 h-4 w-4" />
                  Add line
                </Button>
              </div>
            </form>

            {linesLoading ? (
              <p className="text-white/50 text-sm">Loading lines…</p>
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
                      <TableCell colSpan={6} className="text-white/50">
                        No lines yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    lines.map((ln) => (
                      <TableRow key={ln.id} className="border-white/10">
                        <TableCell className="text-white">
                          <div className="font-medium">{ln.productName}</div>
                          {ln.notes ? (
                            <div className="text-xs text-white/50">{ln.notes}</div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-white/70 text-sm">
                          {ln.subjectName || "—"}
                        </TableCell>
                        <TableCell className="text-white/80">{ln.quantity}</TableCell>
                        <TableCell className="text-white/80">
                          {ln.required ? "Yes" : "No"}
                        </TableCell>
                        <TableCell className="text-brand">
                          {formatMoney(ln.productPriceMinor)}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="text-red-300"
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
    </div>
  );
}
