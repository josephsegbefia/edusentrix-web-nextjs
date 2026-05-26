"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/responsive-modal";
import { cn } from "@/lib/utils";

export type ConfirmationDialogIntent = "default" | "warning" | "destructive";

type ConfirmationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  intent?: ConfirmationDialogIntent;
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
  zIndexClass?: string;
};

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  intent = "default",
  onConfirm,
  onCancel,
  className,
  zIndexClass = "z-[100]",
}: ConfirmationDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      className={cn("sm:max-w-md", className)}
      zIndexClass={zIndexClass}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            className={cn(
              "text-white",
              intent === "destructive" && "bg-rose-600 hover:bg-rose-700",
              intent === "warning" && "bg-amber-600 hover:bg-amber-700",
              intent === "default" && "bg-brand text-black hover:opacity-90"
            )}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
