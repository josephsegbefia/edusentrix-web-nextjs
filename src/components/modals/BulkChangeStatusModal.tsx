// src/components/modals/BulkChangeStatusModal.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBulkChangeStatus } from "@/hooks/admin/useTeacherBulkOperations";
import { premiumSelectContent, premiumMenuItem } from "@/components/ui/premium";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherIds: string[];
  teacherCount: number;
};

export function BulkChangeStatusModal({
  open,
  onOpenChange,
  teacherIds,
  teacherCount,
}: Props) {
  const [status, setStatus] = React.useState<"active" | "inactive" | "on_leave" | "terminated">("active");
  const bulkChangeStatusMutation = useBulkChangeStatus();

  const handleSubmit = async () => {
    if (!teacherIds.length) return;

    try {
      await bulkChangeStatusMutation.mutateAsync({
        teacherIds,
        status,
      });
      toast.success(`Status changed to "${status}" for ${teacherCount} teacher(s)`);
      onOpenChange(false);
    } catch (e: unknown) {
      const error = e as { message?: string };
      toast.error(error.message || "Failed to change status");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] border border-white/10 bg-linear-to-br from-white/10 to-transparent shadow-2xl shadow-black/30 backdrop-blur">
        <DialogHeader>
          <DialogTitle className="text-xl">Change Status</DialogTitle>
          <DialogDescription className="text-sm">
            Change status for {teacherCount} selected teacher{teacherCount !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">New Status</label>
            <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
              <SelectTrigger className="border-white/10 bg-white/5">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent className={premiumSelectContent}>
                <SelectItem value="active" className={premiumMenuItem}>
                  Active
                </SelectItem>
                <SelectItem value="inactive" className={premiumMenuItem}>
                  Inactive
                </SelectItem>
                <SelectItem value="on_leave" className={premiumMenuItem}>
                  On Leave
                </SelectItem>
                <SelectItem value="terminated" className={premiumMenuItem}>
                  Terminated
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={bulkChangeStatusMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={bulkChangeStatusMutation.isPending}
          >
            {bulkChangeStatusMutation.isPending ? "Changing..." : "Change Status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
