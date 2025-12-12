"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { GuardianForm } from "./GuardianForm";
import { GuardianList } from "./GuardianList";
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

type Props = {
  studentId: string;
  onClose: () => void;
};

type ViewMode = "list" | "create" | "edit";

export function ManageGuardiansContent({
  studentId,
  onClose,
}: Props) {
  const busy = useBusyToast();
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
        error: "Failed to create guardian",
      }
    );
    setViewMode("list");
  };

  const handleUpdate = async (data: UpdateGuardianInput) => {
    if (!editingGuardian) return;
    await busy.promise(
      updateGuardian.mutateAsync({
        guardianId: editingGuardian.id,
        input: data,
      }),
      {
        loading: "Updating guardian...",
        success: "Guardian updated successfully",
        error: "Failed to update guardian",
      }
    );
    setViewMode("list");
    setEditingGuardian(null);
  };

  const handleDelete = async (guardianId: string) => {
    const guardian = guardians.find((g) => g.id === guardianId);
    if (
      !confirm(
        `Are you sure you want to remove ${guardian?.fullName || "this guardian"}?`
      )
    ) {
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
              <Button
                type="button"
                onClick={() => setViewMode("create")}
                disabled={isLoading}
                className="gap-2 bg-primary text-black hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4" />
                Add Guardian
              </Button>
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
    </div>
  );
}
