"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Link2, Plus } from "lucide-react";
import { GuardianForm } from "./GuardianForm";
import { GuardianList } from "./GuardianList";
import { ExistingGuardianLinker } from "./ExistingGuardianLinker";
import {
  useGuardians,
  useCreateGuardian,
  useUpdateGuardian,
  useDeleteGuardian,
  useSetPrimaryGuardian,
  type GuardianData,
  type CreateGuardianInput,
  type UpdateGuardianInput,
} from "@/hooks/admin/useGuardians";
import { useBusyToast } from "@/hooks/useBusyToast";
import { AnimatePresence, motion } from "framer-motion";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";

type Props = {
  studentId: string;
};

type ViewMode = "list" | "create" | "edit" | "link-existing";

export function ManageGuardiansContent({
  studentId,
}: Props) {
  const busy = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [viewMode, setViewMode] = React.useState<ViewMode>("list");
  const [editingGuardian, setEditingGuardian] =
    React.useState<GuardianData | null>(null);

  const { data: guardians = [], isLoading: loadingGuardians } =
    useGuardians(studentId);
  const createGuardian = useCreateGuardian(studentId);
  const updateGuardian = useUpdateGuardian(studentId);
  const deleteGuardian = useDeleteGuardian(studentId);
  const setPrimaryGuardian = useSetPrimaryGuardian(studentId);

  const handleCreate = async (data: CreateGuardianInput) => {
    await busy.promise(
      createGuardian.mutateAsync(data),
      {
        loading: "Creating guardian...",
        success: "Guardian created successfully",
        error: (error: Error) => error.message || "Failed to create guardian",
      }
    );
    setViewMode("list");
  };

  const handleUpdate = async (data: CreateGuardianInput) => {
    if (!editingGuardian) return;
    const updateInput: UpdateGuardianInput = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone ?? null,
      relationship: data.relationship,
      occupation: data.occupation ?? null,
      photoUrl: data.photoUrl ?? null,
      isPrimary: data.isPrimary,
    };
    await busy.promise(
      updateGuardian.mutateAsync({
        guardianId: editingGuardian.id,
        input: updateInput,
      }),
      {
        loading: "Updating guardian...",
        success: "Guardian updated successfully",
        error: (error: Error) => error.message || "Failed to update guardian",
      }
    );
    setViewMode("list");
    setEditingGuardian(null);
  };

  const handleDelete = async (guardianId: string) => {
    const guardian = guardians.find((g) => g.id === guardianId);
    const decision = await confirm({
      title: "Remove Guardian?",
      description: `Are you sure you want to remove ${
        guardian?.fullName || "this guardian"
      }?`,
      confirmLabel: "Remove Guardian",
      cancelLabel: "Keep Guardian",
      intent: "destructive",
      zIndexClass: "z-[90]",
    });
    if (decision !== "confirm") {
      return;
    }

    await busy.promise(
      deleteGuardian.mutateAsync(guardianId),
      {
        loading: "Removing guardian...",
        success: "Guardian removed successfully",
        error: "Failed to remove guardian",
      }
    );
  };

  const handleSetPrimary = async (guardianId: string) => {
    await busy.promise(
      setPrimaryGuardian.mutateAsync(guardianId),
      {
        loading: "Setting primary guardian...",
        success: "Primary guardian updated",
        error: "Failed to set primary guardian",
      }
    );
  };

  const handleExistingLinked = (result: {
    guardian: GuardianData;
    siblingCandidates: Array<{ studentName: string; classGroupName: string | null }>;
  }) => {
    const siblingCount = result.siblingCandidates.length;
    busy.success(
      siblingCount > 0
        ? `Linked ${result.guardian.fullName}. Found ${siblingCount} possible sibling${siblingCount === 1 ? "" : "s"} already connected to this parent.`
        : `Linked ${result.guardian.fullName}.`
    );
    setViewMode("list");
  };

  const handleEdit = (guardian: GuardianData) => {
    setEditingGuardian(guardian);
    setViewMode("edit");
  };

  const handleCancel = () => {
    setViewMode("list");
    setEditingGuardian(null);
  };

  const isLoading =
    createGuardian.isPending ||
    updateGuardian.isPending ||
    deleteGuardian.isPending ||
    setPrimaryGuardian.isPending;

  return (
    <div className="space-y-4">
      <AnimatePresence mode="wait">
        {viewMode === "list" && (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground/80">
                {guardians.length === 0
                  ? "No guardians added yet"
                  : `${guardians.length} guardian${guardians.length === 1 ? "" : "s"} linked`}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setViewMode("link-existing")}
                  disabled={isLoading}
                  className="gap-2 border-white/15 bg-white/5 text-white hover:bg-white/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Link2 className="h-4 w-4" />
                  Link Existing Parent
                </Button>
                <Button
                  type="button"
                  onClick={() => setViewMode("create")}
                  disabled={isLoading}
                  className="gap-2 bg-primary text-black hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="h-4 w-4" />
                  Add New Parent
                </Button>
              </div>
            </div>

            {loadingGuardians ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-sm text-white/50">Loading...</div>
              </div>
            ) : (
              <GuardianList
                guardians={guardians}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onSetPrimary={handleSetPrimary}
                isLoading={isLoading}
              />
            )}
          </motion.div>
        )}

        {viewMode === "link-existing" && (
          <motion.div
            key="link-existing"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <ExistingGuardianLinker
              studentId={studentId}
              onLinked={handleExistingLinked}
              onCancel={handleCancel}
            />
          </motion.div>
        )}

        {(viewMode === "create" || viewMode === "edit") && (
          <motion.div
            key="form"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <GuardianForm
              guardian={editingGuardian}
              onSubmit={
                viewMode === "create" ? handleCreate : handleUpdate
              }
              onCancel={handleCancel}
              isLoading={isLoading}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {confirmationDialog}
    </div>
  );
}
