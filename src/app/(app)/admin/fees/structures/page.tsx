// src/app/(app)/admin/fees/structures/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useFeeStructures,
  useCreateFeeStructure,
  useDeleteFeeStructure,
  useUpdateFeeStructure,
  type FeeStructure,
} from "@/hooks/admin/useFeeStructures";
import { formatMoney } from "@/lib/fees/money";
import {
  PlusCircle,
  Edit,
  Trash2,
  Layers,
  ShieldCheck,
  Zap,
  ChevronRight,
  Receipt,
} from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { useFeesSSE } from "@/hooks/admin/useFeesSSE";
import { ResponsiveModal } from "@/components/modals/ResponsiveModal";
import CreateFeeStructureModal from "@/components/modals/CreateFeeStructureModal";
import { useBusyToast } from "@/hooks/useBusyToast";
import type { CreateFeeStructureInput } from "@/schemas/fee";
import type { UpdateFeeStructureInput } from "@/hooks/admin/useFeeStructures";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { cn } from "@/lib/utils";
import { WorkspaceScope } from "@/components/theme/workspace-scope";

type FeeModalState =
  | { intent: "closed" }
  | { intent: "create" }
  | { intent: "edit"; structure: FeeStructure };

export default function FeeStructuresPage() {
  const toast = useToast();
  const busy = useBusyToast();
  const { data, isLoading } = useFeeStructures();
  const createStructure = useCreateFeeStructure();
  const updateStructure = useUpdateFeeStructure();
  const deleteStructure = useDeleteFeeStructure();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  useFeesSSE();

  const [modal, setModal] = useState<FeeModalState>({ intent: "closed" });

  const structures = data?.structures || [];
  const activeCount = structures.filter((s) => s.isActive).length;
  const installmentCount = structures.filter((s) => s.allowsInstallments).length;
  const totalDefaultMinor = structures.reduce(
    (sum, s) => sum + (s.defaultAmountMinor || 0),
    0
  );

  const categoryTone: Record<string, string> = {
    tuition: "bg-amber-500/15 text-amber-100 border-amber-500/35",
    library: "bg-indigo-500/15 text-indigo-100 border-indigo-500/35",
    sports: "bg-emerald-500/15 text-emerald-100 border-emerald-500/35",
    uniform: "bg-sky-500/15 text-sky-100 border-sky-500/35",
    other: "bg-slate-500/15 text-slate-100 border-slate-500/35",
  };

  const sortedStructures = useMemo(
    () => [...structures].sort((a, b) => a.name.localeCompare(b.name)),
    [structures]
  );

  const normalizeCreatePayload = (payload: CreateFeeStructureInput) => ({
    ...payload,
    description: payload.description?.trim() ? payload.description : undefined,
    defaultAmount: payload.defaultAmount ?? undefined,
    maxInstallments: payload.allowsInstallments ? payload.maxInstallments ?? undefined : undefined,
    isActive: payload.isActive ?? true,
  });

  const handleCreate = async (payload: CreateFeeStructureInput) => {
    const normalizedPayload = normalizeCreatePayload(payload);
    await busy.promise(createStructure.mutateAsync(normalizedPayload), {
      loading: "Creating fee structure…",
      success: "Fee structure created",
      error: "Could not create fee structure",
    });
  };

  const handleUpdate = async (payload: UpdateFeeStructureInput) => {
    if (modal.intent !== "edit") return;
    const id = modal.structure._id;
    await busy.promise(
      updateStructure.mutateAsync({
        id,
        data: {
          ...payload,
          description: payload.description?.trim() ? payload.description : null,
          maxInstallments: payload.allowsInstallments ? payload.maxInstallments ?? null : null,
        } satisfies UpdateFeeStructureInput,
      }),
      {
        loading: "Saving fee structure…",
        success: "Fee structure updated",
        error: "Could not update fee structure",
      }
    );
  };

  const handleDelete = async (id: string) => {
    const decision = await confirm({
      title: "Deactivate fee structure?",
      description:
        "This template will no longer be offered for new bills. Existing records are unchanged.",
      confirmLabel: "Deactivate",
      cancelLabel: "Cancel",
      intent: "warning",
    });
    if (decision !== "confirm") return;

    try {
      await deleteStructure.mutateAsync(id);
      toast.success("Structure deactivated", {
        description: "You can create a new template if needed.",
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to deactivate fee structure";
      toast.error("Something went wrong", { description: message });
    }
  };

  const modalOpen = modal.intent !== "closed";
  const modalTitle =
    modal.intent === "edit" ? "Edit fee structure" : "Create fee structure";

  return (
    <WorkspaceScope>
    <div className="relative min-h-full">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-linear-to-b from-brand/15 via-transparent to-transparent"
        aria-hidden
      />
      <div className="relative space-y-8 p-6">
        {/* Header */}
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-(--ws-fg-50)">
              <Link
                href="/admin/fees"
                className="text-(--ws-fg-50) transition-colors hover:text-(--ws-fg)"
              >
                Fees
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-(--ws-fg-40)" aria-hidden />
              <span className="text-(--ws-fg-80)">Structures</span>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-(--ws-fg) sm:text-4xl">
                Fee structures
              </h1>
              <p className="max-w-2xl text-base text-(--ws-fg-60)">
                Reusable fee templates with default amounts, categories, and installment rules for
                invoicing.
              </p>
            </div>
          </div>
          <Button
            size="lg"
            onClick={() => setModal({ intent: "create" })}
            className="shrink-0 gap-2 shadow-lg shadow-brand/20"
          >
            <PlusCircle className="h-4 w-4" />
            New structure
          </Button>
        </header>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div
            className={cn(
              "relative overflow-hidden rounded-2xl border border-(--ws-line)",
              "bg-linear-to-br from-(--ws-fill) to-transparent p-5 shadow-lg shadow-black/15 backdrop-blur"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--ws-fg-50)">
                  Active
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-(--ws-fg)">{activeCount}</p>
                <p className="mt-1 text-sm text-(--ws-fg-50)">of {structures.length} templates</p>
              </div>
              <div className="rounded-xl bg-(--ws-fill) p-2.5 text-(--ws-fg-40)">
                <Layers className="h-5 w-5" />
              </div>
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-(--ws-shine-strong) to-transparent" />
          </div>

          <div
            className={cn(
              "relative overflow-hidden rounded-2xl border border-(--ws-line)",
              "bg-linear-to-br from-emerald-500/15 via-transparent to-transparent p-5 shadow-lg shadow-black/15"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/80">
                  Installment-ready
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-(--ws-fg)">
                  {installmentCount}
                </p>
                <p className="mt-1 text-sm text-(--ws-fg-50)">templates allow splits</p>
              </div>
              <div className="rounded-xl bg-emerald-500/15 p-2.5 text-emerald-200/90">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div
            className={cn(
              "relative overflow-hidden rounded-2xl border border-(--ws-line)",
              "bg-linear-to-br from-amber-500/12 via-transparent to-transparent p-5 shadow-lg shadow-black/15 sm:col-span-2 lg:col-span-1"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                  Default total
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-(--ws-fg)">
                  {structures.length === 0 ? "—" : formatMoney(totalDefaultMinor)}
                </p>
                <p className="mt-1 text-sm text-(--ws-fg-50)">sum of default amounts</p>
              </div>
              <div className="rounded-xl bg-amber-500/15 p-2.5 text-amber-200/90">
                <Zap className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>

        {/* List */}
        <Card className="overflow-hidden border-(--ws-line) bg-linear-to-b from-(--ws-fill) to-transparent shadow-xl shadow-black/20">
          <CardHeader className="flex flex-col gap-2 border-b border-(--ws-line) px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-lg bg-brand/15 p-2 text-brand">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">All templates</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Used when creating invoices and bulk billing runs.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="w-fit border-(--ws-line-strong) bg-(--ws-fill) px-3 py-1 text-(--ws-fg-80)">
              {structures.length} total
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="grid gap-3 p-6 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-40 rounded-xl border border-(--ws-line) bg-(--ws-fill) animate-pulse"
                  />
                ))}
              </div>
            ) : structures.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
                <div className="rounded-full border border-(--ws-line) bg-(--ws-fill) p-4">
                  <Layers className="h-8 w-8 text-(--ws-fg-40)" />
                </div>
                <div className="max-w-md space-y-2">
                  <p className="text-lg font-semibold text-(--ws-fg)">No fee structures yet</p>
                  <p className="text-sm text-(--ws-fg-50)">
                    Add your first template for tuition, ICT, exams, or other charges—defaults help
                    your team issue invoices faster.
                  </p>
                </div>
                <Button onClick={() => setModal({ intent: "create" })} className="gap-2">
                  <PlusCircle className="h-4 w-4" />
                  Create fee structure
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-(--ws-line)">
                {sortedStructures.map((structure) => (
                  <li
                    key={structure._id}
                    className="group transition-colors hover:bg-(--ws-fill)"
                  >
                    <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6 lg:px-6">
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-base font-semibold text-(--ws-fg)">
                            {structure.name}
                          </span>
                          <code className="rounded-md border border-(--ws-line) bg-(--ws-fill) px-2 py-0.5 text-xs font-medium text-(--ws-fg-80)">
                            {structure.code}
                          </code>
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                              categoryTone[structure.category] || categoryTone.other
                            )}
                          >
                            {structure.category}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "border-(--ws-line-strong)",
                              structure.isActive
                                ? "bg-emerald-500/15 text-emerald-100"
                                : "bg-(--ws-fill) text-(--ws-fg-50)"
                            )}
                          >
                            {structure.isActive ? "Active" : "Inactive"}
                          </Badge>
                          {structure.allowsInstallments && (
                            <Badge className="border-0 bg-sky-500/20 text-sky-100">
                              Installments
                              {structure.maxInstallments
                                ? ` · max ${structure.maxInstallments}`
                                : ""}
                            </Badge>
                          )}
                        </div>
                        {structure.description && (
                          <p className="text-sm leading-relaxed text-(--ws-fg-50) line-clamp-2">
                            {structure.description}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-row items-center justify-between gap-4 sm:flex-col sm:items-end">
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-[0.16em] text-(--ws-fg-40)">
                            Default
                          </p>
                          <p className="text-lg font-semibold tabular-nums text-(--ws-fg)">
                            {structure.defaultAmountMinor
                              ? formatMoney(structure.defaultAmountMinor)
                              : "—"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-(--ws-fg-70) hover:bg-(--ws-fill-strong) hover:text-(--ws-fg)"
                            onClick={() => setModal({ intent: "edit", structure })}
                            aria-label={`Edit ${structure.name}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-(--ws-fg-70) hover:bg-rose-500/15 hover:text-rose-200"
                            onClick={() => handleDelete(structure._id)}
                            disabled={deleteStructure.isPending}
                            aria-label={`Deactivate ${structure.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <ResponsiveModal
        open={modalOpen}
        onClose={() => setModal({ intent: "closed" })}
        title={modalTitle}
        widthClass="max-w-lg"
      >
        {modal.intent === "create" && (
          <CreateFeeStructureModal
            key="create"
            onClose={() => setModal({ intent: "closed" })}
            onSubmit={handleCreate}
            isLoading={createStructure.isPending}
          />
        )}
        {modal.intent === "edit" && (
          <CreateFeeStructureModal
            key={modal.structure._id}
            mode="edit"
            structure={modal.structure}
            onClose={() => setModal({ intent: "closed" })}
            onSubmit={handleUpdate}
            isLoading={updateStructure.isPending}
          />
        )}
      </ResponsiveModal>
      {confirmationDialog}
    </div>
    </WorkspaceScope>
  );
}
