// src/app/(app)/admin/fees/structures/page.tsx
"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useFeeStructures,
  useCreateFeeStructure,
  useDeleteFeeStructure,
} from "@/hooks/admin/useFeeStructures";
import { formatMoney } from "@/lib/fees/money";
import { PlusCircle, Edit, Trash2, Layers, ShieldCheck, Zap } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { useFeesSSE } from "@/hooks/admin/useFeesSSE";
import { ResponsiveModal } from "@/components/modals/ResponsiveModal";
import CreateFeeStructureModal from "@/components/modals/CreateFeeStructureModal";
import { useBusyToast } from "@/hooks/useBusyToast";
import type { CreateFeeStructureInput } from "@/schemas/fee";

export default function FeeStructuresPage() {
  const toast = useToast();
  const busy = useBusyToast();
  const { data, isLoading } = useFeeStructures();
  const createStructure = useCreateFeeStructure();
  const deleteStructure = useDeleteFeeStructure();
  useFeesSSE();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const structures = data?.structures || [];
  const activeCount = structures.filter((s: any) => s.isActive).length;
  const installmentCount = structures.filter((s: any) => s.allowsInstallments).length;
  const totalDefaultMinor = structures.reduce(
    (sum: number, s: any) => sum + (s.defaultAmountMinor || 0),
    0
  );

  const categoryTone: Record<string, string> = {
    tuition: "bg-amber-500/15 text-amber-100 border-amber-500/30",
    library: "bg-indigo-500/15 text-indigo-100 border-indigo-500/30",
    sports: "bg-emerald-500/15 text-emerald-100 border-emerald-500/30",
    uniform: "bg-sky-500/15 text-sky-100 border-sky-500/30",
    other: "bg-slate-500/15 text-slate-100 border-slate-500/30",
  };

  const handleCreate = async (payload: CreateFeeStructureInput) => {
    // Normalize payload: convert null to undefined for optional fields
    const normalizedPayload = {
      ...payload,
      description: payload.description ?? undefined,
      defaultAmount: payload.defaultAmount ?? undefined,
      maxInstallments: payload.maxInstallments ?? undefined,
    };
    await busy.promise(
      createStructure.mutateAsync(normalizedPayload),
      {
        loading: "Creating fee structure...",
        success: "Fee structure created successfully",
        error: "Failed to create fee structure",
      }
    );
    setShowCreateModal(false);
  };

  const handleEdit = (structure: any) => {
    setEditingId(structure._id);
    // TODO: Open edit modal
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to deactivate this fee structure?")) return;

    try {
      await deleteStructure.mutateAsync(id);
      toast.success("Success", {
        description: "Fee structure deactivated",
      });
    } catch (error: any) {
      toast.error("Error", {
        description: error.message || "Failed to delete fee structure",
      });
    }
  };

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Billing</p>
          <h1 className="text-3xl font-bold">Fee Structures</h1>
          <p className="text-muted-foreground max-w-2xl">
            Build reusable fee templates with minor-unit defaults, categories, and installment
            rules.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="gap-2">
          <PlusCircle className="h-4 w-4" />
          Create Fee Structure
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="relative overflow-hidden border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted-foreground">Active structures</CardTitle>
            <Layers className="h-4 w-4 text-white/50" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{activeCount}</p>
            <p className="text-sm text-muted-foreground">of {structures.length} total</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-white/10 bg-linear-to-br from-emerald-500/10 to-transparent shadow-lg shadow-black/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted-foreground">Installment-ready</CardTitle>
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{installmentCount}</p>
            <p className="text-sm text-muted-foreground">allow structured payments</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-white/10 bg-linear-to-br from-amber-500/10 to-transparent shadow-lg shadow-black/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted-foreground">Default billing</CardTitle>
            <Zap className="h-4 w-4 text-amber-300" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {structures.length === 0 ? "—" : formatMoney(totalDefaultMinor)}
            </p>
            <p className="text-sm text-muted-foreground">sum of defaults</p>
          </CardContent>
        </Card>
      </div>

      {/* Structures List */}
      <Card className="border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/10">
        <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Fee Structures</CardTitle>
            <p className="text-sm text-muted-foreground">
              Append-only templates powering invoices and installments.
            </p>
          </div>
          <Badge variant="outline" className="px-3 py-1">
            {structures.length} total
          </Badge>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="h-32 rounded-xl border border-white/10 bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : structures.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <p className="text-lg font-semibold">No fee structures yet</p>
              <p className="text-sm text-muted-foreground">
                Create templates for tuition, library, sports, and other charges.
              </p>
              <Button onClick={() => setShowCreateModal(true)} className="gap-2">
                <PlusCircle className="h-4 w-4" />
                Create Fee Structure
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {structures.map((structure: any) => (
                <div
                  key={structure._id}
                  className="relative rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-sm transition-all duration-150 hover:translate-y-[-2px] hover:shadow-lg hover:shadow-black/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold leading-tight">{structure.name}</p>
                        <Badge variant="outline">{structure.code}</Badge>
                        <Badge
                          className={
                            structure.isActive
                              ? "bg-green-500/20 text-green-200"
                              : "bg-slate-500/20 text-slate-300"
                          }
                        >
                          {structure.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      {structure.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {structure.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(structure)}
                        disabled={editingId !== null}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDelete(structure._id)}
                        disabled={deleteStructure.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                          categoryTone[structure.category] || categoryTone.other
                        }`}
                      >
                        {structure.category}
                      </span>
                      {structure.allowsInstallments && (
                        <Badge className="bg-emerald-500/20 text-emerald-200">
                          Installments {structure.maxInstallments ? `· up to ${structure.maxInstallments}` : "allowed"}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Default amount</span>
                      <span className="font-semibold">
                        {structure.defaultAmountMinor
                          ? formatMoney(structure.defaultAmountMinor)
                          : "Not set"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      <ResponsiveModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Fee Structure"
      >
        <CreateFeeStructureModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreate}
          isLoading={createStructure.isPending}
        />
      </ResponsiveModal>
    </div>
  );
}
